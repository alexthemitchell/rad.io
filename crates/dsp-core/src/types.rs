pub const DEFAULT_SAMPLE_RATE_HZ: f32 = 1_000_000.0;
pub const DEFAULT_FFT_SIZE: usize = 2048;
pub const DEFAULT_TONE_FREQUENCY_HZ: f32 = 100_000.0;
pub const DEFAULT_TONE_LEVEL_DBFS: f32 = -12.0;
pub const DEFAULT_NOISE_LEVEL_DBFS: f32 = -72.0;
pub const DEFAULT_SEED: u64 = 0x0052_4144_494f;
pub const SPECTRUM_FLOOR_DBFS: f32 = -120.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GeneratorConfig {
    pub sample_rate_hz: f32,
    pub tone_frequency_hz: f32,
    pub tone_level_dbfs: f32,
    pub noise_enabled: bool,
    pub noise_level_dbfs: f32,
    pub seed: u64,
}

impl Default for GeneratorConfig {
    fn default() -> Self {
        Self {
            sample_rate_hz: DEFAULT_SAMPLE_RATE_HZ,
            tone_frequency_hz: DEFAULT_TONE_FREQUENCY_HZ,
            tone_level_dbfs: DEFAULT_TONE_LEVEL_DBFS,
            noise_enabled: true,
            noise_level_dbfs: DEFAULT_NOISE_LEVEL_DBFS,
            seed: DEFAULT_SEED,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AnalyzerConfig {
    pub fft_size: usize,
    pub waveform_points: usize,
}

impl Default for AnalyzerConfig {
    fn default() -> Self {
        Self {
            fft_size: DEFAULT_FFT_SIZE,
            waveform_points: 1024,
        }
    }
}

#[derive(Debug)]
pub struct AnalysisFrame {
    pub waveform: Vec<f32>,
    pub spectrum_db: Vec<f32>,
    pub sequence: u32,
    pub sample_rate_hz: f32,
    pub center_frequency_hz: f64,
    pub peak_frequency_hz: f32,
    pub peak_power_dbfs: f32,
    pub elapsed_samples: u64,
}
