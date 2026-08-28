use num_complex::Complex32;
use serde::Serialize;
use thiserror::Error;

use super::{RdsDecodeError, RdsDecoder, RdsDecoderSnapshot};

pub const MAX_RDS_TARGETS: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RdsDecodeTarget {
    pub channel_center_hz: f64,
    pub frequency_offset_hz: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RdsChannelSnapshot {
    pub channel_center_hz: u64,
    pub reception: RdsDecoderSnapshot,
}

#[derive(Debug, Clone, Error, PartialEq)]
pub enum RdsBankError {
    #[error("RDS decoder supports at most {MAX_RDS_TARGETS} concurrent targets")]
    TooManyTargets,
    #[error("RDS target channel center must be a positive integer frequency")]
    InvalidChannelCenter,
    #[error("RDS target channel centers must be unique")]
    DuplicateChannel,
    #[error(transparent)]
    Decoder(#[from] RdsDecodeError),
}

pub struct RdsDecoderBank {
    sample_rate_hz: Option<u32>,
    entries: Vec<DecoderEntry>,
}

impl RdsDecoderBank {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            sample_rate_hz: None,
            entries: Vec::new(),
        }
    }

    pub fn set_targets(
        &mut self,
        sample_rate_hz: u32,
        targets: &[RdsDecodeTarget],
    ) -> Result<(), RdsBankError> {
        if targets.len() > MAX_RDS_TARGETS {
            return Err(RdsBankError::TooManyTargets);
        }
        for (index, target) in targets.iter().enumerate() {
            if !target.channel_center_hz.is_finite()
                || target.channel_center_hz <= 0.0
                || target.channel_center_hz.fract() != 0.0
                || target.channel_center_hz > u64::MAX as f64
            {
                return Err(RdsBankError::InvalidChannelCenter);
            }
            if targets[..index]
                .iter()
                .any(|previous| previous.channel_center_hz == target.channel_center_hz)
            {
                return Err(RdsBankError::DuplicateChannel);
            }
        }

        let mut validated = Vec::with_capacity(targets.len());
        for target in targets {
            validated.push(DecoderEntry {
                target: *target,
                decoder: RdsDecoder::new(sample_rate_hz, target.frequency_offset_hz)?,
            });
        }

        if self.sample_rate_hz == Some(sample_rate_hz) {
            for entry in &mut validated {
                if let Some(position) = self.entries.iter().position(|existing| {
                    existing.target.channel_center_hz == entry.target.channel_center_hz
                        && existing.target.frequency_offset_hz == entry.target.frequency_offset_hz
                }) {
                    entry.decoder = self.entries.swap_remove(position).decoder;
                }
            }
        }
        self.sample_rate_hz = Some(sample_rate_hz);
        self.entries = validated;
        Ok(())
    }

    pub fn process_f32(&mut self, iq: &[f32], timestamp_us: u64) -> Result<bool, RdsBankError> {
        if self.entries.is_empty() {
            return Ok(false);
        }
        if !iq.len().is_multiple_of(2) {
            return Err(RdsDecodeError::InvalidIqLength.into());
        }
        let sample_rate_hz = u64::from(self.sample_rate_hz.expect("configured decoder bank"));
        let mut changed = false;
        for (index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            if !sample[0].is_finite() || !sample[1].is_finite() {
                return Err(RdsDecodeError::InvalidSample.into());
            }
            let sample_timestamp_us =
                timestamp_us.saturating_add(index as u64 * 1_000_000 / sample_rate_hz);
            let sample = Complex32::new(sample[0], sample[1]);
            for entry in &mut self.entries {
                changed |= entry.decoder.process_sample(sample, sample_timestamp_us);
            }
        }
        Ok(changed)
    }

    pub fn process_i8(&mut self, iq: &[i8], timestamp_us: u64) -> Result<bool, RdsBankError> {
        if self.entries.is_empty() {
            return Ok(false);
        }
        if !iq.len().is_multiple_of(2) {
            return Err(RdsDecodeError::InvalidIqLength.into());
        }
        let sample_rate_hz = u64::from(self.sample_rate_hz.expect("configured decoder bank"));
        let mut changed = false;
        for (index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            let sample_timestamp_us =
                timestamp_us.saturating_add(index as u64 * 1_000_000 / sample_rate_hz);
            let sample = Complex32::new(f32::from(sample[0]) / 128.0, f32::from(sample[1]) / 128.0);
            for entry in &mut self.entries {
                changed |= entry.decoder.process_sample(sample, sample_timestamp_us);
            }
        }
        Ok(changed)
    }

    #[must_use]
    pub fn snapshots(&self) -> Vec<RdsChannelSnapshot> {
        self.entries
            .iter()
            .filter_map(|entry| {
                entry
                    .decoder
                    .snapshot()
                    .map(|reception| RdsChannelSnapshot {
                        channel_center_hz: entry.target.channel_center_hz as u64,
                        reception,
                    })
            })
            .collect()
    }

    pub fn reset(&mut self) {
        self.sample_rate_hz = None;
        self.entries.clear();
    }

    pub fn reset_decoders(&mut self) {
        for entry in &mut self.entries {
            entry.decoder.reset();
        }
    }
}

impl Default for RdsDecoderBank {
    fn default() -> Self {
        Self::new()
    }
}

struct DecoderEntry {
    target: RdsDecodeTarget,
    decoder: RdsDecoder,
}

#[cfg(test)]
mod tests {
    use super::{MAX_RDS_TARGETS, RdsBankError, RdsDecodeTarget, RdsDecoder, RdsDecoderBank};
    use crate::{
        generator::ComplexToneGenerator,
        types::{GeneratorConfig, GeneratorMode},
    };

    #[test]
    fn rejects_invalid_or_excess_target_sets_atomically() {
        let target = RdsDecodeTarget {
            channel_center_hz: 100_100_000.0,
            frequency_offset_hz: 100_000.0,
        };
        let mut bank = RdsDecoderBank::new();
        bank.set_targets(1_000_000, &[target]).unwrap();

        assert_eq!(
            bank.set_targets(1_000_000, &[target, target]),
            Err(RdsBankError::DuplicateChannel)
        );
        assert_eq!(bank.entries.len(), 1);
        assert_eq!(
            bank.set_targets(1_000_000, &[target; MAX_RDS_TARGETS + 1]),
            Err(RdsBankError::TooManyTargets)
        );
        assert_eq!(bank.entries.len(), 1);
    }

    #[test]
    fn keeps_decoder_state_when_the_same_target_is_refreshed() {
        let sample_rate_hz = 1_000_000_u32;
        let target = RdsDecodeTarget {
            channel_center_hz: 100_100_000.0,
            frequency_offset_hz: 100_000.0,
        };
        let mut bank = RdsDecoderBank::new();
        bank.set_targets(sample_rate_hz, &[target]).unwrap();
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            tone_frequency_hz: target.frequency_offset_hz,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut elapsed_samples = 0_u64;

        for chunk in 0..1_600 {
            let sample_count = if chunk % 2 == 0 { 997 } else { 3_001 };
            let iq = generator.generate(sample_count);
            bank.process_f32(&iq, elapsed_samples * 1_000_000 / u64::from(sample_rate_hz))
                .unwrap();
            elapsed_samples += sample_count as u64;
            if chunk % 37 == 0 {
                bank.set_targets(sample_rate_hz, &[target]).unwrap();
            }
            if bank
                .snapshots()
                .first()
                .and_then(|snapshot| snapshot.reception.metadata.ps.as_ref())
                .is_some_and(|ps| ps.value == "RAD.IO")
            {
                break;
            }
        }

        let snapshots = bank.snapshots();
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].channel_center_hz, 100_100_000);
        assert_eq!(
            snapshots[0].reception.metadata.ps.as_ref().unwrap().value,
            "RAD.IO"
        );
    }

    fn assert_shared_traversal_matches_independent_decoders(quantized: bool) {
        let sample_rate_hz = 2_400_000_u32;
        let targets = [
            RdsDecodeTarget {
                channel_center_hz: 100_100_000.0,
                frequency_offset_hz: 100_000.0,
            },
            RdsDecodeTarget {
                channel_center_hz: 100_300_000.0,
                frequency_offset_hz: 100_000.0,
            },
        ];
        let mut bank = RdsDecoderBank::new();
        bank.set_targets(sample_rate_hz, &targets).unwrap();
        let mut independent = targets
            .iter()
            .map(|target| RdsDecoder::new(sample_rate_hz, target.frequency_offset_hz).unwrap())
            .collect::<Vec<_>>();
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            tone_frequency_hz: targets[0].frequency_offset_hz,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut elapsed_samples = 0_u64;

        for chunk in 0..1_600 {
            let sample_count = if chunk % 2 == 0 { 997 } else { 3_001 };
            let iq = generator.generate(sample_count);
            let timestamp_us = elapsed_samples * 1_000_000 / u64::from(sample_rate_hz);
            let mut independent_changed = false;
            let bank_changed = if quantized {
                let iq = iq
                    .iter()
                    .map(|sample| (sample * 128.0).round().clamp(-128.0, 127.0) as i8)
                    .collect::<Vec<_>>();
                for decoder in &mut independent {
                    independent_changed |= decoder.process_i8(&iq, timestamp_us).unwrap();
                }
                bank.process_i8(&iq, timestamp_us).unwrap()
            } else {
                for decoder in &mut independent {
                    independent_changed |= decoder.process_f32(&iq, timestamp_us).unwrap();
                }
                bank.process_f32(&iq, timestamp_us).unwrap()
            };
            assert_eq!(bank_changed, independent_changed);
            elapsed_samples += sample_count as u64;
            if bank.snapshots().len() == targets.len() {
                break;
            }
        }

        let bank_snapshots = bank.snapshots();
        assert_eq!(bank_snapshots.len(), targets.len());
        for ((snapshot, decoder), target) in bank_snapshots.iter().zip(&independent).zip(&targets) {
            assert_eq!(snapshot.channel_center_hz, target.channel_center_hz as u64);
            assert_eq!(Some(&snapshot.reception), decoder.snapshot().as_ref());
        }
    }

    #[test]
    fn shared_f32_traversal_matches_independent_decoders() {
        assert_shared_traversal_matches_independent_decoders(false);
    }

    #[test]
    fn shared_i8_traversal_matches_independent_decoders() {
        assert_shared_traversal_matches_independent_decoders(true);
    }

    #[test]
    fn reset_decoders_preserves_targets_but_clears_snapshots() {
        let target = RdsDecodeTarget {
            channel_center_hz: 100_100_000.0,
            frequency_offset_hz: 100_000.0,
        };
        let mut bank = RdsDecoderBank::new();
        bank.set_targets(1_000_000, &[target]).unwrap();

        bank.reset_decoders();

        assert!(bank.snapshots().is_empty());
        assert_eq!(bank.entries.len(), 1);
    }
}
