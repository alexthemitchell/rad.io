use std::{collections::VecDeque, f32::consts::TAU};

use num_complex::Complex32;
use serde::Serialize;
use thiserror::Error;

use super::{MetadataAccumulator, RdsMetadata, RdsSynchronizer, SynchronizerStats};

const CHANNEL_SAMPLE_RATE_HZ: u32 = 250_000;
const RDS_SAMPLE_RATE_HZ: u32 = 19_000;
const RDS_SUBCARRIER_HZ: f32 = 57_000.0;
const SAMPLES_PER_SYMBOL: usize = 16;
const HALF_SYMBOL_SAMPLES: usize = SAMPLES_PER_SYMBOL / 2;

#[derive(Debug, Clone, Error, PartialEq)]
pub enum RdsDecodeError {
    #[error("RDS input must contain complete interleaved I/Q pairs")]
    InvalidIqLength,
    #[error("RDS input sample rate must be an integer multiple of 250 kS/s")]
    UnsupportedSampleRate,
    #[error("RDS target must leave 120 kHz of capture-edge headroom")]
    TargetOutsideCapture,
    #[error("RDS input contains a non-finite sample")]
    InvalidSample,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RdsDecoderSnapshot {
    pub metadata: RdsMetadata,
    pub statistics: SynchronizerStats,
}

pub struct RdsDecoder {
    sample_rate_hz: u32,
    decimation: u32,
    mixer: Complex32,
    mixer_step: Complex32,
    mixer_samples: u32,
    channel_accumulator: Complex32,
    channel_accumulator_count: u32,
    previous_channel_sample: Option<Complex32>,
    discriminator_dc: f32,
    subcarrier: Complex32,
    subcarrier_step: Complex32,
    rds_low_pass_1: Complex32,
    rds_low_pass_2: Complex32,
    resample_phase: u32,
    symbol_window: VecDeque<Complex32>,
    rds_sample_index: usize,
    hypotheses: Vec<TimingHypothesis>,
    active_hypothesis: Option<usize>,
}

impl RdsDecoder {
    pub fn new(sample_rate_hz: u32, frequency_offset_hz: f32) -> Result<Self, RdsDecodeError> {
        if sample_rate_hz < CHANNEL_SAMPLE_RATE_HZ
            || !sample_rate_hz.is_multiple_of(CHANNEL_SAMPLE_RATE_HZ)
        {
            return Err(RdsDecodeError::UnsupportedSampleRate);
        }
        if !frequency_offset_hz.is_finite()
            || frequency_offset_hz.abs() + 120_000.0 >= sample_rate_hz as f32 / 2.0
        {
            return Err(RdsDecodeError::TargetOutsideCapture);
        }
        let mixer_step = oscillator_step(-frequency_offset_hz, sample_rate_hz as f32);
        let subcarrier_step = oscillator_step(-RDS_SUBCARRIER_HZ, CHANNEL_SAMPLE_RATE_HZ as f32);
        Ok(Self {
            sample_rate_hz,
            decimation: sample_rate_hz / CHANNEL_SAMPLE_RATE_HZ,
            mixer: Complex32::new(1.0, 0.0),
            mixer_step,
            mixer_samples: 0,
            channel_accumulator: Complex32::new(0.0, 0.0),
            channel_accumulator_count: 0,
            previous_channel_sample: None,
            discriminator_dc: 0.0,
            subcarrier: Complex32::new(1.0, 0.0),
            subcarrier_step,
            rds_low_pass_1: Complex32::new(0.0, 0.0),
            rds_low_pass_2: Complex32::new(0.0, 0.0),
            resample_phase: 0,
            symbol_window: VecDeque::with_capacity(SAMPLES_PER_SYMBOL),
            rds_sample_index: 0,
            hypotheses: (0..SAMPLES_PER_SYMBOL)
                .map(|_| TimingHypothesis::new())
                .collect(),
            active_hypothesis: None,
        })
    }

    pub fn process_f32(&mut self, iq: &[f32], timestamp_us: u64) -> Result<bool, RdsDecodeError> {
        if !iq.len().is_multiple_of(2) {
            return Err(RdsDecodeError::InvalidIqLength);
        }
        let mut changed = false;
        for (index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            if !sample[0].is_finite() || !sample[1].is_finite() {
                return Err(RdsDecodeError::InvalidSample);
            }
            let sample_timestamp_us = timestamp_us
                .saturating_add(index as u64 * 1_000_000 / u64::from(self.sample_rate_hz));
            changed |=
                self.process_sample(Complex32::new(sample[0], sample[1]), sample_timestamp_us);
        }
        Ok(changed)
    }

    pub fn process_i8(&mut self, iq: &[i8], timestamp_us: u64) -> Result<bool, RdsDecodeError> {
        if !iq.len().is_multiple_of(2) {
            return Err(RdsDecodeError::InvalidIqLength);
        }
        let mut changed = false;
        for (index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            let sample_timestamp_us = timestamp_us
                .saturating_add(index as u64 * 1_000_000 / u64::from(self.sample_rate_hz));
            changed |= self.process_sample(
                Complex32::new(f32::from(sample[0]) / 128.0, f32::from(sample[1]) / 128.0),
                sample_timestamp_us,
            );
        }
        Ok(changed)
    }

    #[must_use]
    pub fn snapshot(&self) -> Option<RdsDecoderSnapshot> {
        let index = self.best_hypothesis()?;
        let hypothesis = &self.hypotheses[index];
        (hypothesis.synchronizer.stats().valid_groups > 0).then(|| RdsDecoderSnapshot {
            metadata: hypothesis.metadata.metadata().clone(),
            statistics: hypothesis.synchronizer.stats(),
        })
    }

    pub fn reset(&mut self) {
        self.mixer = Complex32::new(1.0, 0.0);
        self.mixer_samples = 0;
        self.channel_accumulator = Complex32::new(0.0, 0.0);
        self.channel_accumulator_count = 0;
        self.previous_channel_sample = None;
        self.discriminator_dc = 0.0;
        self.subcarrier = Complex32::new(1.0, 0.0);
        self.rds_low_pass_1 = Complex32::new(0.0, 0.0);
        self.rds_low_pass_2 = Complex32::new(0.0, 0.0);
        self.resample_phase = 0;
        self.symbol_window.clear();
        self.rds_sample_index = 0;
        for hypothesis in &mut self.hypotheses {
            hypothesis.reset();
        }
        self.active_hypothesis = None;
    }

    fn process_sample(&mut self, sample: Complex32, timestamp_us: u64) -> bool {
        self.channel_accumulator += sample * self.mixer;
        self.channel_accumulator_count += 1;
        self.mixer *= self.mixer_step;
        self.mixer_samples += 1;
        if self.mixer_samples == 4096 {
            self.mixer = self.mixer / self.mixer.norm().max(f32::EPSILON);
            self.mixer_samples = 0;
        }
        if self.channel_accumulator_count < self.decimation {
            return false;
        }

        let channel_sample = self.channel_accumulator / self.decimation as f32;
        self.channel_accumulator = Complex32::new(0.0, 0.0);
        self.channel_accumulator_count = 0;
        let Some(previous) = self.previous_channel_sample.replace(channel_sample) else {
            return false;
        };
        let phase_difference = channel_sample * previous.conj();
        let discriminator = phase_difference.im.atan2(phase_difference.re);
        self.discriminator_dc += 0.001 * (discriminator - self.discriminator_dc);
        let baseband = discriminator - self.discriminator_dc;

        let mixed = self.subcarrier * baseband;
        self.subcarrier *= self.subcarrier_step;
        let low_pass_alpha = 0.08;
        self.rds_low_pass_1 += (mixed - self.rds_low_pass_1) * low_pass_alpha;
        self.rds_low_pass_2 += (self.rds_low_pass_1 - self.rds_low_pass_2) * low_pass_alpha;
        self.resample_phase += RDS_SAMPLE_RATE_HZ;
        if self.resample_phase < CHANNEL_SAMPLE_RATE_HZ {
            return false;
        }
        self.resample_phase -= CHANNEL_SAMPLE_RATE_HZ;
        self.process_rds_sample(self.rds_low_pass_2, timestamp_us)
    }

    fn process_rds_sample(&mut self, sample: Complex32, timestamp_us: u64) -> bool {
        if self.symbol_window.len() == SAMPLES_PER_SYMBOL {
            self.symbol_window.pop_front();
        }
        self.symbol_window.push_back(sample);
        let phase = self.rds_sample_index % SAMPLES_PER_SYMBOL;
        self.rds_sample_index = self.rds_sample_index.wrapping_add(1);
        if self.symbol_window.len() < SAMPLES_PER_SYMBOL {
            return false;
        }

        let first_half: Complex32 = self
            .symbol_window
            .iter()
            .take(HALF_SYMBOL_SAMPLES)
            .copied()
            .sum();
        let second_half: Complex32 = self
            .symbol_window
            .iter()
            .skip(HALF_SYMBOL_SAMPLES)
            .copied()
            .sum();
        let symbol = first_half - second_half;
        let changed = self.hypotheses[phase].push_symbol(symbol, timestamp_us);
        let candidate_synchronized = self.hypotheses[phase].synchronizer.stats().synchronized;
        let active_synchronized = self
            .active_hypothesis
            .is_some_and(|active| self.hypotheses[active].synchronizer.stats().synchronized);
        self.active_hypothesis = select_active_hypothesis(
            self.active_hypothesis,
            active_synchronized,
            phase,
            candidate_synchronized,
        );
        changed
    }

    fn best_hypothesis(&self) -> Option<usize> {
        if let Some(active) = self.active_hypothesis {
            return Some(active);
        }
        self.hypotheses
            .iter()
            .enumerate()
            .max_by_key(|(_, hypothesis)| {
                let stats = hypothesis.synchronizer.stats();
                (stats.synchronized, stats.valid_groups)
            })
            .map(|(index, _)| index)
    }
}

struct TimingHypothesis {
    previous_symbol: Option<Complex32>,
    synchronizer: RdsSynchronizer,
    metadata: MetadataAccumulator,
}

impl TimingHypothesis {
    fn new() -> Self {
        Self {
            previous_symbol: None,
            synchronizer: RdsSynchronizer::new(),
            metadata: MetadataAccumulator::new(),
        }
    }

    fn push_symbol(&mut self, symbol: Complex32, timestamp_us: u64) -> bool {
        let Some(previous) = self.previous_symbol.replace(symbol) else {
            return false;
        };
        let bit = (symbol * previous.conj()).re < 0.0;
        let previous_stats = self.synchronizer.stats();
        if let Some(group) = self.synchronizer.push_bit(bit) {
            self.metadata.process(&group, timestamp_us);
            true
        } else {
            self.synchronizer.stats() != previous_stats
        }
    }

    fn reset(&mut self) {
        self.previous_symbol = None;
        self.synchronizer.reset();
        self.metadata.reset();
    }
}

fn oscillator_step(frequency_hz: f32, sample_rate_hz: f32) -> Complex32 {
    let phase = TAU * frequency_hz / sample_rate_hz;
    Complex32::new(phase.cos(), phase.sin())
}

const fn select_active_hypothesis(
    active: Option<usize>,
    active_synchronized: bool,
    candidate: usize,
    candidate_synchronized: bool,
) -> Option<usize> {
    if candidate_synchronized && (active.is_none() || !active_synchronized) {
        Some(candidate)
    } else {
        active
    }
}

#[cfg(test)]
mod tests {
    use super::{RdsDecoder, select_active_hypothesis};
    use crate::{
        generator::ComplexToneGenerator,
        types::{GeneratorConfig, GeneratorMode},
    };

    #[test]
    fn decodes_the_synthetic_station_across_irregular_chunks() {
        let sample_rate_hz = 1_000_000_u32;
        let frequency_offset_hz = 100_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            tone_frequency_hz: frequency_offset_hz,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut decoder = RdsDecoder::new(sample_rate_hz, frequency_offset_hz).unwrap();
        let chunk_sizes = [997, 2048, 4093, 1024, 3001];
        let mut elapsed_samples = 0_u64;

        for chunk_index in 0..1_600 {
            let sample_count = chunk_sizes[chunk_index % chunk_sizes.len()];
            let iq = generator.generate(sample_count);
            let timestamp_us = elapsed_samples * 1_000_000 / u64::from(sample_rate_hz);
            decoder.process_f32(&iq, timestamp_us).unwrap();
            elapsed_samples += sample_count as u64;
            if decoder
                .snapshot()
                .and_then(|snapshot| snapshot.metadata.ps)
                .is_some_and(|ps| ps.value == "RAD.IO")
            {
                break;
            }
        }

        let snapshot = decoder
            .snapshot()
            .expect("decoder should find valid RDS groups");
        assert!(snapshot.statistics.synchronized);
        assert_eq!(snapshot.metadata.pi.unwrap().value, 0x3ce7);
        assert_eq!(snapshot.metadata.ps.unwrap().value, "RAD.IO");
    }

    #[test]
    fn decodes_quantized_hackrf_style_iq() {
        let sample_rate_hz = 2_000_000_u32;
        let frequency_offset_hz = 100_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            tone_frequency_hz: frequency_offset_hz,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut decoder = RdsDecoder::new(sample_rate_hz, frequency_offset_hz).unwrap();
        let mut elapsed_samples = 0_u64;

        for _ in 0..900 {
            let iq: Vec<i8> = generator
                .generate(8_192)
                .into_iter()
                .map(|sample| (sample * 127.0).round().clamp(-128.0, 127.0) as i8)
                .collect();
            decoder
                .process_i8(&iq, elapsed_samples * 1_000_000 / u64::from(sample_rate_hz))
                .unwrap();
            elapsed_samples += 8_192;
            if decoder
                .snapshot()
                .and_then(|snapshot| snapshot.metadata.ps)
                .is_some_and(|ps| ps.value == "RAD.IO")
            {
                break;
            }
        }

        let snapshot = decoder.snapshot().expect("quantized IQ should decode");
        assert!(snapshot.statistics.synchronized);
        assert_eq!(snapshot.metadata.ps.unwrap().value, "RAD.IO");
    }

    #[test]
    fn synchronizes_at_all_supported_hackrf_sample_rates() {
        for sample_rate_hz in [2_000_000_u32, 5_000_000, 10_000_000, 20_000_000] {
            let frequency_offset_hz = 100_000.0;
            let mut generator = ComplexToneGenerator::new(GeneratorConfig {
                mode: GeneratorMode::FmRds,
                sample_rate_hz: sample_rate_hz as f32,
                tone_frequency_hz: frequency_offset_hz,
                tone_level_dbfs: -6.0,
                noise_enabled: false,
                ..GeneratorConfig::default()
            })
            .unwrap();
            let mut decoder = RdsDecoder::new(sample_rate_hz, frequency_offset_hz).unwrap();
            let maximum_samples = u64::from(sample_rate_hz) / 2;
            let mut elapsed_samples = 0_u64;

            while elapsed_samples < maximum_samples {
                let sample_count =
                    usize::try_from((maximum_samples - elapsed_samples).min(8_192)).unwrap();
                let iq = generator.generate(sample_count);
                decoder
                    .process_f32(&iq, elapsed_samples * 1_000_000 / u64::from(sample_rate_hz))
                    .unwrap();
                elapsed_samples += sample_count as u64;
                if decoder
                    .snapshot()
                    .is_some_and(|snapshot| snapshot.statistics.synchronized)
                {
                    break;
                }
            }

            assert!(
                decoder
                    .snapshot()
                    .is_some_and(|snapshot| snapshot.statistics.synchronized),
                "RDS did not synchronize at {sample_rate_hz} samples per second"
            );
        }
    }

    #[test]
    fn timing_hypothesis_stays_sticky_until_lock_is_lost() {
        assert_eq!(select_active_hypothesis(None, false, 4, true), Some(4));
        assert_eq!(select_active_hypothesis(Some(4), true, 7, true), Some(4));
        assert_eq!(select_active_hypothesis(Some(4), false, 7, true), Some(7));
        assert_eq!(select_active_hypothesis(Some(7), false, 4, false), Some(7));
    }
}
