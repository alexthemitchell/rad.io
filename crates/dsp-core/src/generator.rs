use std::f64::consts::TAU;

use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use rand_distr::{Distribution, StandardNormal};

use crate::{
    error::DspError,
    rds::SyntheticFmRdsGenerator,
    types::{GeneratorConfig, GeneratorMode},
};

pub struct ComplexToneGenerator {
    config: GeneratorConfig,
    phase: f64,
    fm_rds: SyntheticFmRdsGenerator,
    rng: ChaCha8Rng,
}

impl ComplexToneGenerator {
    pub fn new(config: GeneratorConfig) -> Result<Self, DspError> {
        validate_config(config)?;

        Ok(Self {
            config,
            phase: 0.0,
            fm_rds: SyntheticFmRdsGenerator::new(),
            rng: ChaCha8Rng::seed_from_u64(config.seed),
        })
    }

    pub fn configure(&mut self, config: GeneratorConfig) -> Result<(), DspError> {
        validate_config(config)?;
        if config.seed != self.config.seed {
            self.rng = ChaCha8Rng::seed_from_u64(config.seed);
        }
        if config.mode != self.config.mode {
            self.phase = 0.0;
            self.fm_rds.reset();
        }
        self.config = config;
        Ok(())
    }

    pub fn reset(&mut self) {
        self.phase = 0.0;
        self.fm_rds.reset();
        self.rng = ChaCha8Rng::seed_from_u64(self.config.seed);
    }

    #[must_use]
    pub const fn sample_rate_hz(&self) -> f32 {
        self.config.sample_rate_hz
    }

    #[must_use]
    pub const fn mode(&self) -> GeneratorMode {
        self.config.mode
    }

    #[must_use]
    pub fn samples_per_frame(&self) -> usize {
        (self.config.sample_rate_hz / self.config.frame_rate_hz)
            .round()
            .max(1.0) as usize
    }

    #[must_use]
    pub const fn center_frequency_hz(&self) -> f64 {
        self.config.center_frequency_hz
    }

    #[must_use]
    pub fn generate(&mut self, sample_count: usize) -> Vec<f32> {
        let mut iq = Vec::with_capacity(sample_count * 2);
        let tone_amplitude = f64::from(dbfs_to_amplitude(self.config.tone_level_dbfs));
        let noise_sigma =
            f64::from(dbfs_to_amplitude(self.config.noise_level_dbfs)) / std::f64::consts::SQRT_2;

        for _ in 0..sample_count {
            let (signal_i, signal_q) = match self.config.mode {
                GeneratorMode::Tone => {
                    let (quadrature, in_phase) = self.phase.sin_cos();
                    let phase_step = TAU * f64::from(self.config.tone_frequency_hz)
                        / f64::from(self.config.sample_rate_hz);
                    self.phase = (self.phase + phase_step).rem_euclid(TAU);
                    (in_phase * tone_amplitude, quadrature * tone_amplitude)
                }
                GeneratorMode::FmRds => {
                    let (in_phase, quadrature) = self.fm_rds.sample(
                        f64::from(self.config.sample_rate_hz),
                        f64::from(self.config.tone_frequency_hz),
                        tone_amplitude,
                    );
                    (f64::from(in_phase), f64::from(quadrature))
                }
            };
            let (noise_i, noise_q) = if self.config.noise_enabled {
                let noise_i: f64 = StandardNormal.sample(&mut self.rng);
                let noise_q: f64 = StandardNormal.sample(&mut self.rng);
                (noise_i * noise_sigma, noise_q * noise_sigma)
            } else {
                (0.0, 0.0)
            };

            iq.push((signal_i + noise_i) as f32);
            iq.push((signal_q + noise_q) as f32);
        }

        iq
    }
}

#[must_use]
fn dbfs_to_amplitude(dbfs: f32) -> f32 {
    10.0_f32.powf(dbfs / 20.0)
}

fn validate_config(config: GeneratorConfig) -> Result<(), DspError> {
    if !config.sample_rate_hz.is_finite() || config.sample_rate_hz <= 0.0 {
        return Err(DspError::InvalidSampleRate);
    }
    if !config.frame_rate_hz.is_finite() || !(1.0..=60.0).contains(&config.frame_rate_hz) {
        return Err(DspError::InvalidFrameRate);
    }
    if !config.center_frequency_hz.is_finite() || config.center_frequency_hz < 0.0 {
        return Err(DspError::InvalidCenterFrequency);
    }
    if !config.tone_frequency_hz.is_finite()
        || config.tone_frequency_hz.abs() >= config.sample_rate_hz / 2.0
    {
        return Err(DspError::ToneOutsideNyquist);
    }
    if config.mode == GeneratorMode::FmRds
        && (config.sample_rate_hz < 500_000.0
            || config.tone_frequency_hz.abs() + 150_000.0 >= config.sample_rate_hz / 2.0)
    {
        return Err(DspError::FmRdsOutsideNyquist);
    }
    validate_level("tone level", config.tone_level_dbfs)?;
    validate_level("noise level", config.noise_level_dbfs)?;
    Ok(())
}

fn validate_level(field: &'static str, value: f32) -> Result<(), DspError> {
    if !value.is_finite() || !(-160.0..=0.0).contains(&value) {
        return Err(DspError::InvalidLevel { field, value });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ComplexToneGenerator;
    use crate::types::GeneratorConfig;

    #[test]
    fn phase_is_continuous_across_blocks() {
        let config = GeneratorConfig {
            noise_enabled: false,
            ..GeneratorConfig::default()
        };
        let mut blocked = ComplexToneGenerator::new(config).unwrap();
        let mut continuous = ComplexToneGenerator::new(config).unwrap();

        let mut two_blocks = blocked.generate(257);
        two_blocks.extend(blocked.generate(257));

        assert_eq!(two_blocks, continuous.generate(514));
    }

    #[test]
    fn seeded_noise_is_deterministic() {
        let config = GeneratorConfig::default();
        let mut first = ComplexToneGenerator::new(config).unwrap();
        let mut second = ComplexToneGenerator::new(config).unwrap();

        assert_eq!(first.generate(128), second.generate(128));
    }
}
