pub mod analyzer;
pub mod detector;
pub mod error;
pub mod generator;
pub mod rds;
pub mod types;

use analyzer::SpectrumAnalyzer;
use error::DspError;
use generator::ComplexToneGenerator;
use rds::{RdsChannelSnapshot, RdsDecodeTarget, RdsDecoderBank};
use types::{AnalysisFrame, AnalyzerConfig, DetectionConfig, GeneratorConfig, GeneratorMode};

pub const PROTOCOL_VERSION: u32 = 3;

pub struct DspEngine {
    generator: ComplexToneGenerator,
    analyzer: SpectrumAnalyzer,
    rds_decoder: RdsDecoderBank,
    detection_config: DetectionConfig,
    sequence: u32,
    elapsed_samples: u64,
}

impl DspEngine {
    #[must_use]
    pub fn new() -> Self {
        Self {
            generator: ComplexToneGenerator::new(GeneratorConfig::default())
                .expect("default generator config is valid"),
            analyzer: SpectrumAnalyzer::new(AnalyzerConfig::default())
                .expect("default analyzer config is valid"),
            rds_decoder: RdsDecoderBank::new(),
            detection_config: DetectionConfig::default(),
            sequence: 0,
            elapsed_samples: 0,
        }
    }

    #[must_use]
    pub const fn protocol_version(&self) -> u32 {
        PROTOCOL_VERSION
    }

    #[must_use]
    pub const fn sequence(&self) -> u32 {
        self.sequence
    }

    pub fn configure(
        &mut self,
        generator_config: GeneratorConfig,
        analyzer_config: AnalyzerConfig,
    ) -> Result<(), DspError> {
        let mut analyzer = SpectrumAnalyzer::new(analyzer_config)?;
        analyzer.configure_detection(self.detection_config)?;
        self.generator.configure(generator_config)?;
        self.analyzer = analyzer;
        self.rds_decoder.reset();
        if generator_config.mode == GeneratorMode::FmRds {
            self.rds_decoder.set_targets(
                generator_config.sample_rate_hz.round() as u32,
                &[RdsDecodeTarget {
                    channel_center_hz: generator_config.center_frequency_hz
                        + f64::from(generator_config.tone_frequency_hz),
                    frequency_offset_hz: generator_config.tone_frequency_hz,
                }],
            )?;
        }
        Ok(())
    }

    pub fn configure_detection(&mut self, config: DetectionConfig) -> Result<(), DspError> {
        self.analyzer.configure_detection(config)?;
        self.detection_config = config;
        self.rds_decoder.reset_decoders();
        Ok(())
    }

    pub fn generate_and_analyze(&mut self) -> Result<AnalysisFrame, DspError> {
        let fft_size = self.analyzer.fft_size();
        let sample_rate_hz = self.generator.sample_rate_hz();
        let center_frequency_hz = self.generator.center_frequency_hz();
        let sample_count = self.generator.samples_per_frame().max(fft_size);
        let frame_start_samples = self.elapsed_samples;
        let iq = self.generator.generate(sample_count);
        if self.generator.mode() == GeneratorMode::FmRds {
            let timestamp_us = ((u128::from(frame_start_samples) * 1_000_000)
                / u128::from(sample_rate_hz.round() as u64)) as u64;
            self.rds_decoder.process_f32(&iq, timestamp_us)?;
        }
        let analysis_start = (sample_count - fft_size) * 2;
        let rds_snapshots = self.rds_decoder.snapshots();
        self.analyze(
            &iq[analysis_start..],
            sample_rate_hz,
            center_frequency_hz,
            sample_count,
            rds_snapshots,
        )
    }

    pub fn analyze_external(
        &mut self,
        iq: &[f32],
        sample_rate_hz: f32,
        center_frequency_hz: f64,
    ) -> Result<AnalysisFrame, DspError> {
        self.analyze(
            iq,
            sample_rate_hz,
            center_frequency_hz,
            iq.len() / 2,
            Vec::new(),
        )
    }

    pub fn reset(&mut self) {
        self.generator.reset();
        self.rds_decoder.reset_decoders();
        self.sequence = 0;
        self.elapsed_samples = 0;
    }

    pub fn reset_rds(&mut self) {
        self.rds_decoder.reset_decoders();
    }

    fn analyze(
        &mut self,
        iq: &[f32],
        sample_rate_hz: f32,
        center_frequency_hz: f64,
        elapsed_sample_count: usize,
        rds_snapshots: Vec<RdsChannelSnapshot>,
    ) -> Result<AnalysisFrame, DspError> {
        if !center_frequency_hz.is_finite() || center_frequency_hz < 0.0 {
            return Err(DspError::InvalidCenterFrequency);
        }
        let result = self.analyzer.analyze(iq, sample_rate_hz)?;
        self.sequence = self.sequence.wrapping_add(1);
        self.elapsed_samples = self
            .elapsed_samples
            .wrapping_add(elapsed_sample_count as u64);

        Ok(AnalysisFrame {
            waveform: result.waveform,
            spectrum_db: result.spectrum_db,
            noise_floor_dbfs: result.noise_floor_dbfs,
            detections: result.detections,
            sequence: self.sequence,
            sample_rate_hz,
            center_frequency_hz,
            peak_frequency_hz: result.peak_frequency_hz,
            peak_power_dbfs: result.peak_power_dbfs,
            elapsed_samples: self.elapsed_samples,
            rds_snapshots,
        })
    }
}

impl Default for DspEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::{
        DspEngine, PROTOCOL_VERSION,
        analyzer::SpectrumAnalyzer,
        generator::ComplexToneGenerator,
        types::{AnalyzerConfig, GeneratorConfig},
    };

    #[test]
    fn engine_reports_protocol_version() {
        let engine = DspEngine::new();

        assert_eq!(engine.protocol_version(), PROTOCOL_VERSION);
        assert_eq!(engine.sequence(), 0);
    }

    #[test]
    fn generated_frames_advance_sequence_and_sample_clock() {
        let mut engine = DspEngine::new();

        let first = engine.generate_and_analyze().unwrap();
        let second = engine.generate_and_analyze().unwrap();

        assert_eq!(first.sequence, 1);
        assert_eq!(second.sequence, 2);
        assert_eq!(second.elapsed_samples, first.elapsed_samples * 2);
        assert_eq!(second.center_frequency_hz, 0.0);
    }

    #[test]
    fn generated_frames_preserve_configured_center_frequency() {
        let mut engine = DspEngine::new();
        engine
            .configure(
                GeneratorConfig {
                    center_frequency_hz: 100_000_000.0,
                    ..GeneratorConfig::default()
                },
                AnalyzerConfig::default(),
            )
            .unwrap();

        let frame = engine.generate_and_analyze().unwrap();

        assert_eq!(frame.center_frequency_hz, 100_000_000.0);
        assert!(!frame.detections.is_empty());
    }

    #[test]
    fn generated_fm_rds_frames_accumulate_station_metadata() {
        let mut engine = DspEngine::new();
        engine
            .configure(
                GeneratorConfig {
                    mode: super::types::GeneratorMode::FmRds,
                    sample_rate_hz: 1_000_000.0,
                    frame_rate_hz: 30.0,
                    center_frequency_hz: 100_000_000.0,
                    tone_frequency_hz: 100_000.0,
                    tone_level_dbfs: -6.0,
                    noise_enabled: false,
                    ..GeneratorConfig::default()
                },
                AnalyzerConfig {
                    fft_size: 4096,
                    ..AnalyzerConfig::default()
                },
            )
            .unwrap();

        let frame = (0..120)
            .map(|_| engine.generate_and_analyze().unwrap())
            .find(|frame| {
                frame
                    .rds_snapshots
                    .first()
                    .and_then(|snapshot| snapshot.reception.metadata.ps.as_ref())
                    .is_some_and(|ps| ps.value == "RAD.IO")
            })
            .expect("generated frames should decode the synthetic station");

        assert_eq!(frame.rds_snapshots[0].channel_center_hz, 100_100_000);
        assert!(frame.rds_snapshots[0].reception.statistics.synchronized);
        assert!(frame.elapsed_samples >= 1_000_000);
        assert!(!frame.detections.is_empty());
    }

    #[test]
    fn external_iq_uses_the_same_frequency_analysis() {
        let sample_rate_hz = 1_024_000.0;
        let tone_frequency_hz = 64_000.0;
        let generator_config = GeneratorConfig {
            sample_rate_hz,
            tone_frequency_hz,
            noise_enabled: false,
            ..GeneratorConfig::default()
        };
        let analyzer_config = AnalyzerConfig::default();
        let mut generator = ComplexToneGenerator::new(generator_config).unwrap();
        let analyzer = SpectrumAnalyzer::new(analyzer_config).unwrap();
        let iq = generator.generate(analyzer.fft_size());
        let mut engine = DspEngine::new();
        engine.configure(generator_config, analyzer_config).unwrap();

        let frame = engine
            .analyze_external(&iq, sample_rate_hz, 915_000_000.0)
            .unwrap();

        assert!((frame.peak_frequency_hz - tone_frequency_hz).abs() < 0.1);
        assert_eq!(frame.center_frequency_hz, 915_000_000.0);
        assert_eq!(frame.sequence, 1);
    }

    #[test]
    fn external_iq_rejects_non_finite_center_frequency() {
        let mut engine = DspEngine::new();
        let iq = vec![0.0; AnalyzerConfig::default().fft_size * 2];

        let result = engine.analyze_external(&iq, 1_000_000.0, f64::NAN);

        assert!(matches!(
            result,
            Err(super::error::DspError::InvalidCenterFrequency)
        ));
        assert_eq!(engine.sequence(), 0);
    }
}
