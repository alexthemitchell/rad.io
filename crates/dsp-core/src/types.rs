pub const DEFAULT_SAMPLE_RATE_HZ: f32 = 1_000_000.0;
pub const DEFAULT_FFT_SIZE: usize = 2048;
pub const DEFAULT_TONE_FREQUENCY_HZ: f32 = 100_000.0;
pub const DEFAULT_TONE_LEVEL_DBFS: f32 = -12.0;
pub const DEFAULT_NOISE_LEVEL_DBFS: f32 = -72.0;
pub const DEFAULT_SEED: u64 = 0x0052_4144_494f;
pub const DEFAULT_FRAME_RATE_HZ: f32 = 30.0;
pub const SPECTRUM_FLOOR_DBFS: f32 = -120.0;
pub const DEFAULT_DETECTION_MINIMUM_SNR_DB: f32 = 15.0;
pub const DEFAULT_DETECTION_MAX_SIGNALS: usize = 16;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum GeneratorMode {
    #[default]
    Tone,
    FmRds,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DetectionConfig {
    pub enabled: bool,
    pub minimum_snr_db: f32,
    pub max_signals: usize,
}

impl Default for DetectionConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            minimum_snr_db: DEFAULT_DETECTION_MINIMUM_SNR_DB,
            max_signals: DEFAULT_DETECTION_MAX_SIGNALS,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SpectralDetection {
    pub peak_frequency_hz: f32,
    pub lower_frequency_hz: f32,
    pub upper_frequency_hz: f32,
    pub bandwidth_hz: f32,
    pub peak_power_dbfs: f32,
    pub snr_db: f32,
    pub edge_clipped: bool,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct GeneratorConfig {
    pub mode: GeneratorMode,
    pub sample_rate_hz: f32,
    pub frame_rate_hz: f32,
    pub center_frequency_hz: f64,
    pub tone_frequency_hz: f32,
    pub tone_level_dbfs: f32,
    pub noise_enabled: bool,
    pub noise_level_dbfs: f32,
    pub seed: u64,
}

impl Default for GeneratorConfig {
    fn default() -> Self {
        Self {
            mode: GeneratorMode::Tone,
            sample_rate_hz: DEFAULT_SAMPLE_RATE_HZ,
            frame_rate_hz: DEFAULT_FRAME_RATE_HZ,
            center_frequency_hz: 0.0,
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
    pub noise_floor_dbfs: f32,
    pub detections: Vec<SpectralDetection>,
    pub sequence: u32,
    pub sample_rate_hz: f32,
    pub center_frequency_hz: f64,
    pub peak_frequency_hz: f32,
    pub peak_power_dbfs: f32,
    pub elapsed_samples: u64,
    pub rds_snapshots: Vec<crate::rds::RdsChannelSnapshot>,
}
