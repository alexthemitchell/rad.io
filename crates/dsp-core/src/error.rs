use thiserror::Error;

#[derive(Debug, Error, PartialEq)]
pub enum DspError {
    #[error("sample rate must be finite and greater than zero")]
    InvalidSampleRate,
    #[error("FFT size must be a power of two between 256 and 16384")]
    InvalidFftSize,
    #[error("waveform preview must contain at least one point")]
    InvalidWaveformPoints,
    #[error("tone frequency must be finite and within the Nyquist interval")]
    ToneOutsideNyquist,
    #[error("center frequency must be finite")]
    InvalidCenterFrequency,
    #[error("{field} must be finite and between -160 and 0 dBFS, got {value}")]
    InvalidLevel { field: &'static str, value: f32 },
    #[error("IQ buffer length must be {expected} interleaved values, got {actual}")]
    InvalidIqLength { expected: usize, actual: usize },
    #[error("IQ sample at index {index} contains a non-finite component")]
    InvalidIqSample { index: usize },
}
