mod filter;
mod fm_stereo;

use std::{collections::VecDeque, f32::consts::TAU};

use filter::{
    BiquadLowPass, CicDecimator, DcBlocker, FirDecimator, LinearResampler, OnePoleLowPass,
    Oscillator,
};
use fm_stereo::WbfmStereoDemodulator;
use num_complex::Complex32;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const MAX_VFOS: usize = 4;
const MAX_PENDING_BLOCKS_PER_VFO: usize = 4;
const MIN_OUTPUT_RATE_HZ: u32 = 8_000;
const MAX_OUTPUT_RATE_HZ: u32 = 192_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum VfoMode {
    Wbfm,
    Am,
    Nbfm,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VfoConfig {
    pub id: String,
    pub frequency_hz: f64,
    pub mode: VfoMode,
    pub bandwidth_hz: f32,
    pub squelch_dbfs: f32,
    pub revision: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VfoAudioBlock {
    pub vfo_id: String,
    pub revision: u32,
    pub source_timestamp_us: u64,
    pub sample_rate_hz: u32,
    pub channel_count: u8,
    pub signal_level_dbfs: f32,
    pub squelched: bool,
    pub stereo_locked: bool,
    pub samples: Vec<f32>,
}

#[derive(Debug, Clone, Error, PartialEq)]
pub enum VfoError {
    #[error("VFO bank supports at most {MAX_VFOS} receivers")]
    TooManyVfos,
    #[error("VFO IDs must be non-empty and unique")]
    InvalidId,
    #[error("VFO input sample rate must be an integer from 250 kS/s to 20 MS/s")]
    InvalidSampleRate,
    #[error("VFO output sample rate must be from 8 kHz to 192 kHz")]
    InvalidOutputRate,
    #[error("source center frequency must be finite and non-negative")]
    InvalidCenterFrequency,
    #[error("VFO frequency must be an integer from 0 Hz to 6 GHz")]
    InvalidFrequency,
    #[error("VFO bandwidth is invalid for its demodulation mode")]
    InvalidBandwidth,
    #[error("VFO squelch must be finite and from -120 to 0 dBFS")]
    InvalidSquelch,
    #[error("VFO revision must be greater than zero")]
    InvalidRevision,
    #[error("VFO channel and filter transition must fit within the source passband")]
    TargetOutsideCapture,
    #[error("VFO input must contain complete interleaved I/Q pairs")]
    InvalidIqLength,
    #[error("VFO input contains a non-finite sample")]
    InvalidSample,
}

pub struct VfoBank {
    sample_rate_hz: Option<u32>,
    center_frequency_hz: f64,
    output_sample_rate_hz: u32,
    entries: Vec<VfoEntry>,
    pending_blocks: VecDeque<VfoAudioBlock>,
}

impl VfoBank {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            sample_rate_hz: None,
            center_frequency_hz: 0.0,
            output_sample_rate_hz: 48_000,
            entries: Vec::new(),
            pending_blocks: VecDeque::new(),
        }
    }

    pub fn set_vfos(
        &mut self,
        sample_rate_hz: u32,
        center_frequency_hz: f64,
        output_sample_rate_hz: u32,
        configs: &[VfoConfig],
    ) -> Result<(), VfoError> {
        validate_bank_config(
            sample_rate_hz,
            center_frequency_hz,
            output_sample_rate_hz,
            configs,
        )?;

        let mut validated = configs
            .iter()
            .map(|config| {
                VfoEntry::new(
                    config.clone(),
                    sample_rate_hz,
                    center_frequency_hz,
                    output_sample_rate_hz,
                )
            })
            .collect::<Result<Vec<_>, _>>()?;

        if self.sample_rate_hz == Some(sample_rate_hz)
            && self.center_frequency_hz == center_frequency_hz
            && self.output_sample_rate_hz == output_sample_rate_hz
        {
            for entry in &mut validated {
                if let Some(position) = self
                    .entries
                    .iter()
                    .position(|existing| existing.config == entry.config)
                {
                    entry.processor = self.entries.swap_remove(position).processor;
                }
            }
        }

        self.sample_rate_hz = Some(sample_rate_hz);
        self.center_frequency_hz = center_frequency_hz;
        self.output_sample_rate_hz = output_sample_rate_hz;
        self.entries = validated;
        self.pending_blocks.clear();
        Ok(())
    }

    pub fn process_f32(&mut self, iq: &[f32], timestamp_us: u64) -> Result<bool, VfoError> {
        if self.entries.is_empty() {
            return Ok(false);
        }
        if !iq.len().is_multiple_of(2) {
            return Err(VfoError::InvalidIqLength);
        }
        for (sample_index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            if !sample[0].is_finite() || !sample[1].is_finite() {
                return Err(VfoError::InvalidSample);
            }
            self.process_sample(
                Complex32::new(sample[0], sample[1]),
                sample_index,
                timestamp_us,
            );
        }
        Ok(!self.pending_blocks.is_empty())
    }

    pub fn process_i8(&mut self, iq: &[i8], timestamp_us: u64) -> Result<bool, VfoError> {
        if self.entries.is_empty() {
            return Ok(false);
        }
        if !iq.len().is_multiple_of(2) {
            return Err(VfoError::InvalidIqLength);
        }
        for (sample_index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            self.process_sample(
                Complex32::new(f32::from(sample[0]) / 128.0, f32::from(sample[1]) / 128.0),
                sample_index,
                timestamp_us,
            );
        }
        Ok(!self.pending_blocks.is_empty())
    }

    #[must_use]
    pub fn drain_audio(&mut self) -> Vec<VfoAudioBlock> {
        self.pending_blocks.drain(..).collect()
    }

    pub fn reset_decoders(&mut self) {
        for entry in &mut self.entries {
            entry.processor.reset();
        }
        self.pending_blocks.clear();
    }

    pub fn reset(&mut self) {
        self.sample_rate_hz = None;
        self.entries.clear();
        self.pending_blocks.clear();
    }

    fn process_sample(&mut self, sample: Complex32, source_sample_index: usize, timestamp_us: u64) {
        let sample_rate_hz = self.sample_rate_hz.expect("configured VFO bank");
        let pending_block_limit = self.entries.len() * MAX_PENDING_BLOCKS_PER_VFO;
        for entry in &mut self.entries {
            if let Some(block) = entry.processor.process_sample(
                sample,
                source_sample_index,
                timestamp_us,
                sample_rate_hz,
            ) {
                if self.pending_blocks.len() == pending_block_limit {
                    self.pending_blocks.pop_front();
                }
                self.pending_blocks.push_back(block);
            }
        }
    }
}

impl Default for VfoBank {
    fn default() -> Self {
        Self::new()
    }
}

struct VfoEntry {
    config: VfoConfig,
    processor: VfoProcessor,
}

impl VfoEntry {
    fn new(
        config: VfoConfig,
        sample_rate_hz: u32,
        center_frequency_hz: f64,
        output_sample_rate_hz: u32,
    ) -> Result<Self, VfoError> {
        let processor = VfoProcessor::new(
            &config,
            sample_rate_hz,
            center_frequency_hz,
            output_sample_rate_hz,
        )?;
        Ok(Self { config, processor })
    }
}

struct VfoProcessor {
    id: String,
    revision: u32,
    output_sample_rate_hz: u32,
    oscillator: Oscillator,
    cic: CicDecimator,
    channel_filter: FirDecimator,
    demodulator: Demodulator,
    channel_count: u8,
    audio_resampler: LinearResampler,
    right_audio_resampler: Option<LinearResampler>,
    power_alpha: f32,
    signal_power: f32,
    squelch_threshold_dbfs: f32,
    squelch_open: bool,
    squelch_hang_samples: u32,
    squelch_hang_remaining: u32,
    block_size: usize,
    block_start_timestamp_us: Option<u64>,
    block_signal_level_dbfs: f32,
    block_was_squelched: bool,
    stereo_locked: bool,
    block_samples: Vec<f32>,
}

impl VfoProcessor {
    fn new(
        config: &VfoConfig,
        sample_rate_hz: u32,
        center_frequency_hz: f64,
        output_sample_rate_hz: u32,
    ) -> Result<Self, VfoError> {
        let offset_hz = (config.frequency_hz - center_frequency_hz) as f32;
        let coarse_decimation = (sample_rate_hz / 500_000).max(1);
        let coarse_rate_hz = sample_rate_hz as f32 / coarse_decimation as f32;
        let (channel_decimation, filter_taps) = match config.mode {
            VfoMode::Wbfm => ((coarse_rate_hz / 250_000.0).floor().max(1.0) as u32, 63),
            VfoMode::Am | VfoMode::Nbfm => {
                ((coarse_rate_hz / 50_000.0).round().max(1.0) as u32, 127)
            }
        };
        let channel_rate_hz = coarse_rate_hz / channel_decimation as f32;
        let cutoff_hz = (config.bandwidth_hz * 0.475).min(channel_rate_hz * 0.42);
        let demodulator =
            Demodulator::new(config.mode, channel_rate_hz, output_sample_rate_hz as f32);
        let channel_count = if config.mode == VfoMode::Wbfm { 2 } else { 1 };
        let block_size = (output_sample_rate_hz as usize / 50).max(1);
        Ok(Self {
            id: config.id.clone(),
            revision: config.revision,
            output_sample_rate_hz,
            oscillator: Oscillator::new(-offset_hz, sample_rate_hz as f32),
            cic: CicDecimator::new(coarse_decimation),
            channel_filter: FirDecimator::new(
                coarse_rate_hz,
                cutoff_hz,
                channel_decimation,
                filter_taps,
            ),
            demodulator,
            channel_count,
            audio_resampler: LinearResampler::new(channel_rate_hz, output_sample_rate_hz),
            right_audio_resampler: (channel_count == 2)
                .then(|| LinearResampler::new(channel_rate_hz, output_sample_rate_hz)),
            power_alpha: 1.0 - (-1.0 / (channel_rate_hz * 0.01)).exp(),
            signal_power: 0.0,
            squelch_threshold_dbfs: config.squelch_dbfs,
            squelch_open: config.squelch_dbfs <= -120.0,
            squelch_hang_samples: (channel_rate_hz * 0.15).round() as u32,
            squelch_hang_remaining: 0,
            block_size,
            block_start_timestamp_us: None,
            block_signal_level_dbfs: -120.0,
            block_was_squelched: false,
            stereo_locked: false,
            block_samples: Vec::with_capacity(block_size * usize::from(channel_count)),
        })
    }

    fn process_sample(
        &mut self,
        sample: Complex32,
        source_sample_index: usize,
        source_timestamp_us: u64,
        source_sample_rate_hz: u32,
    ) -> Option<VfoAudioBlock> {
        let mixed = self.oscillator.mix(sample);
        let coarse = self.cic.process(mixed)?;
        let channel = self.channel_filter.process(coarse)?;
        self.signal_power += self.power_alpha * (channel.norm_sqr() - self.signal_power);
        let signal_level_dbfs = 10.0 * self.signal_power.max(1.0e-12).log10();
        self.update_squelch(signal_level_dbfs);

        let mut completed_block = None;
        match self.demodulator.process(channel) {
            DemodulatedAudio::Mono(audio) => {
                let outputs = self.audio_resampler.process(audio);
                for output in outputs.iter() {
                    if let Some(block) = self.push_audio_frame(
                        output,
                        None,
                        signal_level_dbfs,
                        source_sample_index,
                        source_timestamp_us,
                        source_sample_rate_hz,
                    ) {
                        debug_assert!(completed_block.is_none());
                        completed_block = Some(block);
                    }
                }
            }
            DemodulatedAudio::Stereo {
                left,
                right,
                stereo_locked,
            } => {
                self.stereo_locked = stereo_locked;
                let left_outputs = self.audio_resampler.process(left);
                let right_outputs = self
                    .right_audio_resampler
                    .as_mut()
                    .expect("stereo VFO has a right-channel resampler")
                    .process(right);
                assert_eq!(
                    left_outputs.len(),
                    right_outputs.len(),
                    "stereo resamplers lost frame synchronization"
                );
                for (left_output, right_output) in left_outputs.iter().zip(right_outputs.iter()) {
                    if let Some(block) = self.push_audio_frame(
                        left_output,
                        Some(right_output),
                        signal_level_dbfs,
                        source_sample_index,
                        source_timestamp_us,
                        source_sample_rate_hz,
                    ) {
                        debug_assert!(completed_block.is_none());
                        completed_block = Some(block);
                    }
                }
            }
        }
        completed_block
    }

    fn push_audio_frame(
        &mut self,
        left: f32,
        right: Option<f32>,
        signal_level_dbfs: f32,
        source_sample_index: usize,
        source_timestamp_us: u64,
        source_sample_rate_hz: u32,
    ) -> Option<VfoAudioBlock> {
        debug_assert_eq!(right.is_some(), self.channel_count == 2);
        if self.block_start_timestamp_us.is_none() {
            self.block_start_timestamp_us = Some(source_timestamp_us.saturating_add(
                source_sample_index as u64 * 1_000_000 / u64::from(source_sample_rate_hz),
            ));
            self.block_signal_level_dbfs = signal_level_dbfs;
            self.block_was_squelched = !self.squelch_open;
        } else {
            self.block_signal_level_dbfs = self.block_signal_level_dbfs.max(signal_level_dbfs);
            self.block_was_squelched |= !self.squelch_open;
        }
        self.block_samples
            .push(if self.squelch_open { left } else { 0.0 });
        if let Some(right) = right {
            self.block_samples
                .push(if self.squelch_open { right } else { 0.0 });
        }
        (self.block_samples.len() == self.block_size * usize::from(self.channel_count))
            .then(|| self.take_block())
    }

    fn update_squelch(&mut self, level_dbfs: f32) {
        if self.squelch_open {
            if level_dbfs >= self.squelch_threshold_dbfs - 3.0 {
                self.squelch_hang_remaining = self.squelch_hang_samples;
            } else if self.squelch_hang_remaining > 0 {
                self.squelch_hang_remaining -= 1;
            } else {
                self.squelch_open = false;
            }
        } else if level_dbfs >= self.squelch_threshold_dbfs {
            self.squelch_open = true;
            self.squelch_hang_remaining = self.squelch_hang_samples;
        }
    }

    fn take_block(&mut self) -> VfoAudioBlock {
        let samples = std::mem::replace(
            &mut self.block_samples,
            Vec::with_capacity(self.block_size * usize::from(self.channel_count)),
        );
        let block = VfoAudioBlock {
            vfo_id: self.id.clone(),
            revision: self.revision,
            source_timestamp_us: self.block_start_timestamp_us.take().unwrap_or(0),
            sample_rate_hz: self.output_sample_rate_hz,
            channel_count: self.channel_count,
            signal_level_dbfs: self.block_signal_level_dbfs,
            squelched: self.block_was_squelched,
            stereo_locked: self.stereo_locked,
            samples,
        };
        self.block_signal_level_dbfs = -120.0;
        self.block_was_squelched = false;
        block
    }

    fn reset(&mut self) {
        self.oscillator.reset();
        self.cic.reset();
        self.channel_filter.reset();
        self.demodulator.reset();
        self.audio_resampler.reset();
        if let Some(resampler) = &mut self.right_audio_resampler {
            resampler.reset();
        }
        self.signal_power = 0.0;
        self.squelch_open = self.squelch_threshold_dbfs <= -120.0;
        self.squelch_hang_remaining = 0;
        self.block_start_timestamp_us = None;
        self.block_signal_level_dbfs = -120.0;
        self.block_was_squelched = false;
        self.stereo_locked = false;
        self.block_samples.clear();
    }
}

enum Demodulator {
    Wbfm(WbfmStereoDemodulator),
    Am(AmDemodulator),
    Nbfm(FmDemodulator),
}

impl Demodulator {
    fn new(mode: VfoMode, sample_rate_hz: f32, output_sample_rate_hz: f32) -> Self {
        let output_cutoff_hz = output_sample_rate_hz * 0.45;
        match mode {
            VfoMode::Wbfm => Self::Wbfm(WbfmStereoDemodulator::new(
                sample_rate_hz,
                15_000.0_f32.min(output_cutoff_hz),
            )),
            VfoMode::Am => Self::Am(AmDemodulator::new(
                sample_rate_hz,
                5_000.0_f32.min(output_cutoff_hz),
            )),
            VfoMode::Nbfm => Self::Nbfm(FmDemodulator::new(
                sample_rate_hz,
                2_500.0,
                3_000.0_f32.min(output_cutoff_hz),
                300.0e-6,
            )),
        }
    }

    fn process(&mut self, sample: Complex32) -> DemodulatedAudio {
        match self {
            Self::Wbfm(demodulator) => {
                let output = demodulator.process(sample);
                DemodulatedAudio::Stereo {
                    left: output.left,
                    right: output.right,
                    stereo_locked: output.stereo_locked,
                }
            }
            Self::Nbfm(demodulator) => DemodulatedAudio::Mono(demodulator.process(sample)),
            Self::Am(demodulator) => DemodulatedAudio::Mono(demodulator.process(sample)),
        }
    }

    fn reset(&mut self) {
        match self {
            Self::Wbfm(demodulator) => demodulator.reset(),
            Self::Nbfm(demodulator) => demodulator.reset(),
            Self::Am(demodulator) => demodulator.reset(),
        }
    }
}

enum DemodulatedAudio {
    Mono(f32),
    Stereo {
        left: f32,
        right: f32,
        stereo_locked: bool,
    },
}

struct FmDemodulator {
    scale: f32,
    previous: Option<Complex32>,
    audio_low_pass: BiquadLowPass,
    de_emphasis: OnePoleLowPass,
    dc_blocker: DcBlocker,
}

impl FmDemodulator {
    fn new(
        sample_rate_hz: f32,
        deviation_hz: f32,
        audio_cutoff_hz: f32,
        de_emphasis_seconds: f32,
    ) -> Self {
        Self {
            scale: sample_rate_hz / (TAU * deviation_hz),
            previous: None,
            audio_low_pass: BiquadLowPass::new(sample_rate_hz, audio_cutoff_hz),
            de_emphasis: OnePoleLowPass::new(sample_rate_hz, de_emphasis_seconds),
            dc_blocker: DcBlocker::new(sample_rate_hz, 20.0),
        }
    }

    fn process(&mut self, sample: Complex32) -> f32 {
        let Some(previous) = self.previous.replace(sample) else {
            return 0.0;
        };
        let phase_difference = sample * previous.conj();
        let discriminator = phase_difference.im.atan2(phase_difference.re) * self.scale;
        let audio = self.audio_low_pass.process(discriminator);
        let audio = self.de_emphasis.process(audio);
        self.dc_blocker.process(audio)
    }

    fn reset(&mut self) {
        self.previous = None;
        self.audio_low_pass.reset();
        self.de_emphasis.reset();
        self.dc_blocker.reset();
    }
}

struct AmDemodulator {
    dc_blocker: DcBlocker,
    audio_low_pass: BiquadLowPass,
    envelope: f32,
}

impl AmDemodulator {
    fn new(sample_rate_hz: f32, audio_cutoff_hz: f32) -> Self {
        Self {
            dc_blocker: DcBlocker::new(sample_rate_hz, 20.0),
            audio_low_pass: BiquadLowPass::new(sample_rate_hz, audio_cutoff_hz),
            envelope: 0.1,
        }
    }

    fn process(&mut self, sample: Complex32) -> f32 {
        let magnitude = sample.norm();
        let coefficient = if magnitude > self.envelope {
            0.01
        } else {
            0.000_1
        };
        self.envelope += coefficient * (magnitude - self.envelope);
        let normalized = magnitude * (0.5 / self.envelope.max(0.025)).clamp(0.1, 20.0);
        self.audio_low_pass
            .process(self.dc_blocker.process(normalized))
    }

    fn reset(&mut self) {
        self.dc_blocker.reset();
        self.audio_low_pass.reset();
        self.envelope = 0.1;
    }
}

fn validate_bank_config(
    sample_rate_hz: u32,
    center_frequency_hz: f64,
    output_sample_rate_hz: u32,
    configs: &[VfoConfig],
) -> Result<(), VfoError> {
    if !(250_000..=20_000_000).contains(&sample_rate_hz) {
        return Err(VfoError::InvalidSampleRate);
    }
    if !(MIN_OUTPUT_RATE_HZ..=MAX_OUTPUT_RATE_HZ).contains(&output_sample_rate_hz) {
        return Err(VfoError::InvalidOutputRate);
    }
    if !center_frequency_hz.is_finite() || center_frequency_hz < 0.0 {
        return Err(VfoError::InvalidCenterFrequency);
    }
    if configs.len() > MAX_VFOS {
        return Err(VfoError::TooManyVfos);
    }
    for (index, config) in configs.iter().enumerate() {
        if config.id.trim().is_empty() || configs[..index].iter().any(|item| item.id == config.id) {
            return Err(VfoError::InvalidId);
        }
        if !config.frequency_hz.is_finite()
            || config.frequency_hz < 0.0
            || config.frequency_hz > 6_000_000_000.0
            || config.frequency_hz.fract() != 0.0
        {
            return Err(VfoError::InvalidFrequency);
        }
        let bandwidth_valid = match config.mode {
            VfoMode::Wbfm => (100_000.0..=300_000.0).contains(&config.bandwidth_hz),
            VfoMode::Am => (2_000.0..=20_000.0).contains(&config.bandwidth_hz),
            VfoMode::Nbfm => (5_000.0..=25_000.0).contains(&config.bandwidth_hz),
        };
        if !config.bandwidth_hz.is_finite() || !bandwidth_valid {
            return Err(VfoError::InvalidBandwidth);
        }
        if !config.squelch_dbfs.is_finite() || !(-120.0..=0.0).contains(&config.squelch_dbfs) {
            return Err(VfoError::InvalidSquelch);
        }
        if config.revision == 0 {
            return Err(VfoError::InvalidRevision);
        }
        let transition_hz = (config.bandwidth_hz * 0.1).max(1_000.0);
        let occupied_half_width_hz = f64::from(config.bandwidth_hz / 2.0 + transition_hz);
        let offset_hz = (config.frequency_hz - center_frequency_hz).abs();
        if offset_hz + occupied_half_width_hz >= f64::from(sample_rate_hz) / 2.0 {
            return Err(VfoError::TargetOutsideCapture);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{MAX_VFOS, VfoBank, VfoConfig, VfoError, VfoMode};
    use crate::{
        generator::ComplexToneGenerator,
        types::{GeneratorConfig, GeneratorMode},
    };

    fn config(id: &str, frequency_hz: f64, mode: VfoMode) -> VfoConfig {
        let bandwidth_hz = match mode {
            VfoMode::Wbfm => 200_000.0,
            VfoMode::Am => 10_000.0,
            VfoMode::Nbfm => 12_500.0,
        };
        VfoConfig {
            id: id.to_owned(),
            frequency_hz,
            mode,
            bandwidth_hz,
            squelch_dbfs: -120.0,
            revision: 1,
        }
    }

    #[test]
    fn rejects_invalid_target_sets_atomically() {
        let mut bank = VfoBank::new();
        let target = config("vfo-1", 100_100_000.0, VfoMode::Wbfm);
        bank.set_vfos(
            1_000_000,
            100_000_000.0,
            48_000,
            std::slice::from_ref(&target),
        )
        .unwrap();

        assert_eq!(
            bank.set_vfos(
                1_000_000,
                100_000_000.0,
                48_000,
                &[target.clone(), target.clone()],
            ),
            Err(VfoError::InvalidId)
        );
        assert_eq!(bank.entries.len(), 1);
        assert_eq!(
            bank.set_vfos(
                1_000_000,
                100_000_000.0,
                48_000,
                &vec![target; MAX_VFOS + 1],
            ),
            Err(VfoError::TooManyVfos)
        );
        assert_eq!(bank.entries.len(), 1);
    }

    #[test]
    fn recovers_wbfm_stereo_tones_across_irregular_chunks() {
        let sample_rate_hz = 1_000_000_u32;
        let center_frequency_hz = 100_000_000.0;
        let station_frequency_hz = 100_100_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            center_frequency_hz,
            tone_frequency_hz: 100_000.0,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut bank = VfoBank::new();
        bank.set_vfos(
            sample_rate_hz,
            center_frequency_hz,
            48_000,
            &[config("vfo-1", station_frequency_hz, VfoMode::Wbfm)],
        )
        .unwrap();

        let mut left_audio = Vec::new();
        let mut right_audio = Vec::new();
        let mut stereo_locked = false;
        let mut elapsed_samples = 0_u64;
        while elapsed_samples < u64::from(sample_rate_hz) {
            let sample_count = if elapsed_samples.is_multiple_of(2) {
                997
            } else {
                3_001
            };
            let iq = generator.generate(sample_count);
            bank.process_f32(&iq, elapsed_samples * 1_000_000 / u64::from(sample_rate_hz))
                .unwrap();
            elapsed_samples += sample_count as u64;
            for block in bank.drain_audio() {
                assert_eq!(block.channel_count, 2);
                stereo_locked |= block.stereo_locked;
                for frame in block.samples.as_chunks::<2>().0 {
                    left_audio.push(frame[0]);
                    right_audio.push(frame[1]);
                }
            }
        }

        assert!((46_000..=48_000).contains(&left_audio.len()));
        assert_eq!(left_audio.len(), right_audio.len());
        assert!(stereo_locked, "synthetic pilot did not acquire stereo lock");
        let left = &left_audio[8_000..];
        let right = &right_audio[8_000..];
        let left_700 = tone_amplitude(left, 48_000.0, 700.0);
        let left_1_900 = tone_amplitude(left, 48_000.0, 1_900.0);
        let right_700 = tone_amplitude(right, 48_000.0, 700.0);
        let right_1_900 = tone_amplitude(right, 48_000.0, 1_900.0);
        let pilot_19_000 =
            tone_amplitude(left, 48_000.0, 19_000.0).max(tone_amplitude(right, 48_000.0, 19_000.0));
        assert!(left_700 > 0.02, "left 700 Hz level was {left_700}");
        assert!(right_1_900 > 0.01, "right 1.9 kHz level was {right_1_900}");
        assert!(
            left_1_900 < left_700 * 0.1,
            "right tone leaked into left channel: {left_1_900} vs {left_700}"
        );
        assert!(
            right_700 < right_1_900 * 0.1,
            "left tone leaked into right channel: {right_700} vs {right_1_900}"
        );
        assert!(
            pilot_19_000 < left_700 * 0.1,
            "pilot leaked into stereo audio"
        );
    }

    #[test]
    fn recovers_wbfm_stereo_from_the_2_4_msps_source_rate() {
        let sample_rate_hz = 2_400_000_u32;
        let center_frequency_hz = 100_000_000.0;
        let station_frequency_hz = 100_100_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            center_frequency_hz,
            tone_frequency_hz: 100_000.0,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut bank = VfoBank::new();
        bank.set_vfos(
            sample_rate_hz,
            center_frequency_hz,
            48_000,
            &[config("vfo-1", station_frequency_hz, VfoMode::Wbfm)],
        )
        .unwrap();

        let mut left_audio = Vec::new();
        let mut right_audio = Vec::new();
        let mut stereo_locked = false;
        let maximum_samples = u64::from(sample_rate_hz) / 4;
        let mut elapsed_samples = 0_u64;
        while elapsed_samples < maximum_samples {
            let sample_count =
                usize::try_from((maximum_samples - elapsed_samples).min(8_192)).unwrap();
            bank.process_f32(
                &generator.generate(sample_count),
                elapsed_samples * 1_000_000 / u64::from(sample_rate_hz),
            )
            .unwrap();
            elapsed_samples += sample_count as u64;
            for block in bank.drain_audio() {
                assert_eq!(block.channel_count, 2);
                stereo_locked = block.stereo_locked;
                for frame in block.samples.as_chunks::<2>().0 {
                    left_audio.push(frame[0]);
                    right_audio.push(frame[1]);
                }
            }
        }

        assert!(stereo_locked, "2.4 MS/s source did not acquire stereo lock");
        let settled_start = left_audio.len() / 2;
        let left = &left_audio[settled_start..];
        let right = &right_audio[settled_start..];
        let left_700 = tone_amplitude(left, 48_000.0, 700.0);
        let left_1_900 = tone_amplitude(left, 48_000.0, 1_900.0);
        let right_700 = tone_amplitude(right, 48_000.0, 700.0);
        let right_1_900 = tone_amplitude(right, 48_000.0, 1_900.0);
        assert!(left_700 > 0.02, "left 700 Hz level was {left_700}");
        assert!(right_1_900 > 0.01, "right 1.9 kHz level was {right_1_900}");
        assert!(left_1_900 < left_700 * 0.1);
        assert!(right_700 < right_1_900 * 0.1);
    }

    #[test]
    fn filters_wbfm_before_resampling_to_the_minimum_output_rate() {
        let sample_rate_hz = 1_000_000_u32;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            center_frequency_hz: 100_000_000.0,
            tone_frequency_hz: 100_000.0,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut bank = VfoBank::new();
        bank.set_vfos(
            sample_rate_hz,
            100_000_000.0,
            8_000,
            &[config("vfo-1", 100_100_000.0, VfoMode::Wbfm)],
        )
        .unwrap();
        let mut left_audio = Vec::new();
        let mut right_audio = Vec::new();
        let mut elapsed_samples = 0_u64;
        while elapsed_samples < u64::from(sample_rate_hz) {
            let sample_count = 4_093;
            bank.process_f32(
                &generator.generate(sample_count),
                elapsed_samples * 1_000_000 / u64::from(sample_rate_hz),
            )
            .unwrap();
            elapsed_samples += sample_count as u64;
            for block in bank.drain_audio() {
                assert_eq!(block.channel_count, 2);
                for frame in block.samples.as_chunks::<2>().0 {
                    left_audio.push(frame[0]);
                    right_audio.push(frame[1]);
                }
            }
        }

        let left = &left_audio[1_600..];
        let right = &right_audio[1_600..];
        let left_700 = tone_amplitude(left, 8_000.0, 700.0);
        let right_1_900 = tone_amplitude(right, 8_000.0, 1_900.0);
        let aliased_pilot =
            tone_amplitude(left, 8_000.0, 3_000.0).max(tone_amplitude(right, 8_000.0, 3_000.0));
        assert!(left_700 > 0.02, "left 700 Hz level was {left_700}");
        assert!(right_1_900 > 0.005, "right 1.9 kHz level was {right_1_900}");
        assert!(
            aliased_pilot < left_700 * 0.1,
            "19 kHz pilot aliased into 3 kHz audio"
        );
    }

    #[test]
    fn recovers_am_audio() {
        let audio = demodulate_test_signal(VfoMode::Am, |index, sample_rate_hz, phase| {
            let time = index as f32 / sample_rate_hz;
            let envelope = 0.45 * (1.0 + 0.5 * (std::f32::consts::TAU * 1_000.0 * time).sin());
            ComplexSample::from_phase(envelope, phase)
        });
        let settled = &audio[8_000..];
        let fundamental = tone_amplitude(settled, 48_000.0, 1_000.0);
        let second_harmonic = tone_amplitude(settled, 48_000.0, 2_000.0);

        assert!(fundamental > 0.05, "AM 1 kHz level was {fundamental}");
        assert!(
            second_harmonic < fundamental * 0.08,
            "AM harmonic distortion was too high"
        );
    }

    #[test]
    fn am_agc_preserves_weak_modulation_after_a_quiet_carrier() {
        let sample_rate_hz = 50_000.0;
        let mut demodulator = super::AmDemodulator::new(sample_rate_hz, 5_000.0);
        for _ in 0..50_000 {
            demodulator.process(num_complex::Complex32::new(0.5, 0.0));
        }

        let audio = (0..10_000)
            .map(|index| {
                let modulation =
                    0.01 * (std::f32::consts::TAU * 1_000.0 * index as f32 / sample_rate_hz).sin();
                demodulator.process(num_complex::Complex32::new(0.5 * (1.0 + modulation), 0.0))
            })
            .collect::<Vec<_>>();
        let fundamental = tone_amplitude(&audio[2_000..], sample_rate_hz, 1_000.0);

        assert!(fundamental > 0.002, "weak AM tone was lost: {fundamental}");
        assert!(
            fundamental < 0.01,
            "AM AGC amplified program silence: {fundamental}"
        );
    }

    #[test]
    fn recovers_nbfm_audio() {
        let audio = demodulate_test_signal(VfoMode::Nbfm, |index, sample_rate_hz, phase| {
            let time = index as f32 / sample_rate_hz;
            let deviation_hz = 2_500.0 * (std::f32::consts::TAU * 1_000.0 * time).sin();
            let next_phase =
                phase + std::f32::consts::TAU * (100_000.0 + deviation_hz) / sample_rate_hz;
            ComplexSample::from_phase(0.5, next_phase)
        });
        let settled = &audio[8_000..];
        let fundamental = tone_amplitude(settled, 48_000.0, 1_000.0);
        let out_of_band = tone_amplitude(settled, 48_000.0, 8_000.0);

        assert!(fundamental > 0.05, "NBFM 1 kHz level was {fundamental}");
        assert!(
            out_of_band < fundamental * 0.01,
            "NBFM audio filter leaked out-of-band energy"
        );
    }

    #[test]
    fn separates_four_simultaneous_nbfm_vfos() {
        let sample_rate_hz = 1_000_000_u32;
        let center_frequency_hz = 100_000_000.0;
        let offsets_hz = [-37_500.0_f32, -12_500.0, 12_500.0, 37_500.0];
        let audio_frequencies_hz = [700.0_f32, 1_000.0, 1_300.0, 1_600.0];
        let configs = offsets_hz
            .iter()
            .enumerate()
            .map(|(index, offset_hz)| {
                config(
                    &format!("vfo-{}", index + 1),
                    center_frequency_hz + f64::from(*offset_hz),
                    VfoMode::Nbfm,
                )
            })
            .collect::<Vec<_>>();
        let mut bank = VfoBank::new();
        bank.set_vfos(sample_rate_hz, center_frequency_hz, 48_000, &configs)
            .unwrap();

        let mut carrier_phases = [0.0_f32; 4];
        let mut audio_by_vfo = HashMap::<String, Vec<f32>>::new();
        let mut elapsed_samples = 0_usize;
        while elapsed_samples < sample_rate_hz as usize {
            let sample_count = (sample_rate_hz as usize - elapsed_samples).min(4_093);
            let mut iq = Vec::with_capacity(sample_count * 2);
            for index in elapsed_samples..elapsed_samples + sample_count {
                let time = index as f32 / sample_rate_hz as f32;
                let mut combined = num_complex::Complex32::new(0.0, 0.0);
                for target in 0..4 {
                    let deviation_hz = 2_500.0
                        * (std::f32::consts::TAU * audio_frequencies_hz[target] * time).sin();
                    carrier_phases[target] = (carrier_phases[target]
                        + std::f32::consts::TAU * (offsets_hz[target] + deviation_hz)
                            / sample_rate_hz as f32)
                        .rem_euclid(std::f32::consts::TAU);
                    combined += num_complex::Complex32::from_polar(0.15, carrier_phases[target]);
                }
                iq.extend([combined.re, combined.im]);
            }
            bank.process_f32(
                &iq,
                elapsed_samples as u64 * 1_000_000 / u64::from(sample_rate_hz),
            )
            .unwrap();
            elapsed_samples += sample_count;
            for block in bank.drain_audio() {
                audio_by_vfo
                    .entry(block.vfo_id)
                    .or_default()
                    .extend(block.samples);
            }
        }

        assert_eq!(audio_by_vfo.len(), 4);
        for (index, audio_frequency_hz) in audio_frequencies_hz.iter().enumerate() {
            let audio = &audio_by_vfo[&format!("vfo-{}", index + 1)];
            let settled = &audio[8_000..];
            let wanted = tone_amplitude(settled, 48_000.0, *audio_frequency_hz);
            let adjacent = tone_amplitude(settled, 48_000.0, audio_frequencies_hz[(index + 1) % 4]);
            assert!(wanted > 0.03, "VFO {} wanted tone was {wanted}", index + 1);
            assert!(
                adjacent < wanted * 0.1,
                "VFO {} adjacent tone {adjacent} was not isolated from {wanted}",
                index + 1,
            );
        }
    }

    #[test]
    fn recovers_quantized_hackrf_style_wbfm_iq() {
        let sample_rate_hz = 1_000_000_u32;
        let center_frequency_hz = 100_000_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            mode: GeneratorMode::FmRds,
            sample_rate_hz: sample_rate_hz as f32,
            center_frequency_hz,
            tone_frequency_hz: 100_000.0,
            tone_level_dbfs: -6.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut bank = VfoBank::new();
        bank.set_vfos(
            sample_rate_hz,
            center_frequency_hz,
            48_000,
            &[config("vfo-1", 100_100_000.0, VfoMode::Wbfm)],
        )
        .unwrap();
        let mut left_audio = Vec::new();
        let mut right_audio = Vec::new();
        let mut elapsed_samples = 0_u64;
        while elapsed_samples < u64::from(sample_rate_hz) / 2 {
            let iq = generator.generate(4_093);
            let quantized = iq
                .into_iter()
                .map(|sample| (sample * 127.0).round().clamp(-128.0, 127.0) as i8)
                .collect::<Vec<_>>();
            bank.process_i8(
                &quantized,
                elapsed_samples * 1_000_000 / u64::from(sample_rate_hz),
            )
            .unwrap();
            elapsed_samples += 4_093;
            for block in bank.drain_audio() {
                assert_eq!(block.channel_count, 2);
                for frame in block.samples.as_chunks::<2>().0 {
                    left_audio.push(frame[0]);
                    right_audio.push(frame[1]);
                }
            }
        }

        let left = &left_audio[8_000..];
        let right = &right_audio[8_000..];
        let left_700 = tone_amplitude(left, 48_000.0, 700.0);
        let left_1_900 = tone_amplitude(left, 48_000.0, 1_900.0);
        let right_700 = tone_amplitude(right, 48_000.0, 700.0);
        let right_1_900 = tone_amplitude(right, 48_000.0, 1_900.0);
        assert!(left_700 > 0.02);
        assert!(right_1_900 > 0.01);
        assert!(left_1_900 < left_700 * 0.2);
        assert!(right_700 < right_1_900 * 0.2);
    }

    #[test]
    fn preserves_upsampled_audio_across_block_boundaries() {
        let config = config("vfo-1", 100_000_000.0, VfoMode::Nbfm);
        let mut processor =
            super::VfoProcessor::new(&config, 250_000, 100_000_000.0, 192_000).unwrap();
        let mut completed_samples = 0;

        for source_sample_index in 0..25_000 {
            if let Some(block) = processor.process_sample(
                num_complex::Complex32::new(0.5, 0.0),
                source_sample_index,
                0,
                250_000,
            ) {
                completed_samples += block.samples.len();
            }
        }

        assert_eq!(completed_samples + processor.block_samples.len(), 19_197);
    }

    #[derive(Clone, Copy)]
    struct ComplexSample {
        in_phase: f32,
        quadrature: f32,
        phase: f32,
    }

    impl ComplexSample {
        fn from_phase(amplitude: f32, phase: f32) -> Self {
            let (quadrature, in_phase) = phase.sin_cos();
            Self {
                in_phase: in_phase * amplitude,
                quadrature: quadrature * amplitude,
                phase,
            }
        }
    }

    fn demodulate_test_signal(
        mode: VfoMode,
        mut sample: impl FnMut(usize, f32, f32) -> ComplexSample,
    ) -> Vec<f32> {
        let sample_rate_hz = 1_000_000_u32;
        let center_frequency_hz = 100_000_000.0;
        let mut bank = VfoBank::new();
        bank.set_vfos(
            sample_rate_hz,
            center_frequency_hz,
            48_000,
            &[config("vfo-1", 100_100_000.0, mode)],
        )
        .unwrap();

        let mut phase = 0.0_f32;
        let mut elapsed_samples = 0_usize;
        let mut audio = Vec::new();
        while elapsed_samples < sample_rate_hz as usize {
            let sample_count = if elapsed_samples.is_multiple_of(2) {
                997
            } else {
                3_001
            };
            let mut iq = Vec::with_capacity(sample_count * 2);
            for index in elapsed_samples..elapsed_samples + sample_count {
                if mode != VfoMode::Nbfm {
                    phase += std::f32::consts::TAU * 100_000.0 / sample_rate_hz as f32;
                }
                let generated = sample(index, sample_rate_hz as f32, phase);
                phase = generated.phase.rem_euclid(std::f32::consts::TAU);
                iq.extend([generated.in_phase, generated.quadrature]);
            }
            bank.process_f32(
                &iq,
                elapsed_samples as u64 * 1_000_000 / u64::from(sample_rate_hz),
            )
            .unwrap();
            elapsed_samples += sample_count;
            audio.extend(
                bank.drain_audio()
                    .into_iter()
                    .flat_map(|block| block.samples),
            );
        }
        audio
    }

    fn tone_amplitude(samples: &[f32], sample_rate_hz: f32, frequency_hz: f32) -> f32 {
        let mut in_phase = 0.0;
        let mut quadrature = 0.0;
        for (index, sample) in samples.iter().enumerate() {
            let phase = std::f32::consts::TAU * frequency_hz * index as f32 / sample_rate_hz;
            in_phase += sample * phase.cos();
            quadrature += sample * phase.sin();
        }
        2.0 * in_phase.hypot(quadrature) / samples.len() as f32
    }
}
