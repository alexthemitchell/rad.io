use std::sync::Arc;

use num_complex::Complex32;
use rustfft::{Fft, FftPlanner};

use crate::{
    detector::{detect_signals, validate_detection_config},
    error::DspError,
    types::{AnalyzerConfig, DetectionConfig, SPECTRUM_FLOOR_DBFS, SpectralDetection},
};

pub struct SpectrumResult {
    pub waveform: Vec<f32>,
    pub spectrum_db: Vec<f32>,
    pub noise_floor_dbfs: f32,
    pub detections: Vec<SpectralDetection>,
    pub peak_frequency_hz: f32,
    pub peak_power_dbfs: f32,
}

pub struct SpectrumAnalyzer {
    config: AnalyzerConfig,
    fft: Arc<dyn Fft<f32>>,
    fft_buffer: Vec<Complex32>,
    window: Vec<f32>,
    window_sum: f32,
    detection_config: DetectionConfig,
}

impl SpectrumAnalyzer {
    pub fn new(config: AnalyzerConfig) -> Result<Self, DspError> {
        validate_fft_size(config.fft_size)?;
        if config.waveform_points == 0 {
            return Err(DspError::InvalidWaveformPoints);
        }
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(config.fft_size);
        let denominator = (config.fft_size - 1) as f32;
        let window: Vec<f32> = (0..config.fft_size)
            .map(|index| 0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / denominator).cos())
            .collect();
        let window_sum = window.iter().sum();

        Ok(Self {
            config,
            fft,
            fft_buffer: vec![Complex32::default(); config.fft_size],
            window,
            window_sum,
            detection_config: DetectionConfig::default(),
        })
    }

    #[must_use]
    pub const fn fft_size(&self) -> usize {
        self.config.fft_size
    }

    pub fn configure_detection(&mut self, config: DetectionConfig) -> Result<(), DspError> {
        validate_detection_config(config)?;
        self.detection_config = config;
        Ok(())
    }

    pub fn analyze(&mut self, iq: &[f32], sample_rate_hz: f32) -> Result<SpectrumResult, DspError> {
        if !sample_rate_hz.is_finite() || sample_rate_hz <= 0.0 {
            return Err(DspError::InvalidSampleRate);
        }
        let expected = self.config.fft_size * 2;
        if iq.len() != expected {
            return Err(DspError::InvalidIqLength {
                expected,
                actual: iq.len(),
            });
        }

        for (index, sample) in iq.as_chunks::<2>().0.iter().enumerate() {
            if !sample[0].is_finite() || !sample[1].is_finite() {
                return Err(DspError::InvalidIqSample { index });
            }
            self.fft_buffer[index] = Complex32::new(sample[0], sample[1]) * self.window[index];
        }
        self.fft.process(&mut self.fft_buffer);

        let half = self.config.fft_size / 2;
        let mut spectrum_db = Vec::with_capacity(self.config.fft_size);
        let mut peak_index = half;
        let mut peak_power_dbfs = SPECTRUM_FLOOR_DBFS;
        for output_index in 0..self.config.fft_size {
            let source_index = (output_index + half) % self.config.fft_size;
            let magnitude = self.fft_buffer[source_index].norm() / self.window_sum;
            let power_dbfs = (20.0 * magnitude.max(1.0e-12).log10()).max(SPECTRUM_FLOOR_DBFS);
            if power_dbfs > peak_power_dbfs {
                peak_power_dbfs = power_dbfs;
                peak_index = output_index;
            }
            spectrum_db.push(power_dbfs);
        }

        let bin_width_hz = sample_rate_hz / self.config.fft_size as f32;
        let peak_frequency_hz = (peak_index as f32 - half as f32) * bin_width_hz;
        let detection_result = detect_signals(&spectrum_db, sample_rate_hz, self.detection_config);

        Ok(SpectrumResult {
            waveform: preview_iq(iq, self.config.waveform_points),
            spectrum_db,
            noise_floor_dbfs: detection_result.noise_floor_dbfs,
            detections: detection_result.detections,
            peak_frequency_hz,
            peak_power_dbfs,
        })
    }
}

pub fn validate_fft_size(fft_size: usize) -> Result<(), DspError> {
    if !(256..=16_384).contains(&fft_size) || !fft_size.is_power_of_two() {
        return Err(DspError::InvalidFftSize);
    }
    Ok(())
}

fn preview_iq(iq: &[f32], maximum_points: usize) -> Vec<f32> {
    let sample_count = iq.len() / 2;
    let point_count = sample_count.min(maximum_points);
    let stride = (sample_count / point_count).max(1);
    let mut preview = Vec::with_capacity(point_count * 2);

    for sample_index in (0..sample_count).step_by(stride).take(point_count) {
        preview.extend_from_slice(&iq[sample_index * 2..sample_index * 2 + 2]);
    }
    preview
}

#[cfg(test)]
mod tests {
    use super::SpectrumAnalyzer;
    use crate::{
        error::DspError,
        generator::ComplexToneGenerator,
        types::{AnalyzerConfig, GeneratorConfig, SPECTRUM_FLOOR_DBFS},
    };

    #[test]
    fn rejects_an_empty_waveform_preview() {
        let result = SpectrumAnalyzer::new(AnalyzerConfig {
            waveform_points: 0,
            ..AnalyzerConfig::default()
        });

        assert!(matches!(result, Err(DspError::InvalidWaveformPoints)));
    }

    #[test]
    fn exact_bin_tone_has_expected_peak_and_level() {
        let sample_rate_hz = 1_024_000.0;
        let tone_frequency_hz = 128_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            sample_rate_hz,
            tone_frequency_hz,
            tone_level_dbfs: -12.0,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut analyzer = SpectrumAnalyzer::new(AnalyzerConfig::default()).unwrap();

        let result = analyzer
            .analyze(&generator.generate(analyzer.fft_size()), sample_rate_hz)
            .unwrap();

        assert!((result.peak_frequency_hz - tone_frequency_hz).abs() < 0.1);
        assert!((result.peak_power_dbfs - -12.0).abs() < 0.05);
        assert_eq!(result.detections.len(), 1);
        assert!((result.detections[0].peak_frequency_hz - tone_frequency_hz).abs() < 0.1);
    }

    #[test]
    fn shifted_spectrum_maps_negative_frequency() {
        let sample_rate_hz = 1_024_000.0;
        let tone_frequency_hz = -64_000.0;
        let mut generator = ComplexToneGenerator::new(GeneratorConfig {
            sample_rate_hz,
            tone_frequency_hz,
            noise_enabled: false,
            ..GeneratorConfig::default()
        })
        .unwrap();
        let mut analyzer = SpectrumAnalyzer::new(AnalyzerConfig::default()).unwrap();

        let result = analyzer
            .analyze(&generator.generate(analyzer.fft_size()), sample_rate_hz)
            .unwrap();

        assert!((result.peak_frequency_hz - tone_frequency_hz).abs() < 0.1);
    }

    #[test]
    fn silent_input_reports_dc_at_the_display_floor() {
        let mut analyzer = SpectrumAnalyzer::new(AnalyzerConfig::default()).unwrap();
        let iq = vec![0.0; analyzer.fft_size() * 2];

        let result = analyzer.analyze(&iq, 1_000_000.0).unwrap();

        assert_eq!(result.peak_frequency_hz, 0.0);
        assert_eq!(result.peak_power_dbfs, SPECTRUM_FLOOR_DBFS);
    }

    #[test]
    fn rejects_non_finite_iq_components() {
        let mut analyzer = SpectrumAnalyzer::new(AnalyzerConfig::default()).unwrap();
        let mut iq = vec![0.0; analyzer.fft_size() * 2];
        iq[7] = f32::NAN;

        let result = analyzer.analyze(&iq, 1_000_000.0);

        assert!(matches!(
            result,
            Err(DspError::InvalidIqSample { index: 3 })
        ));
    }
}
