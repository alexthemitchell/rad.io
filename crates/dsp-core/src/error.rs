use thiserror::Error;

use crate::{rds::RdsBankError, vfo::VfoError};

#[derive(Debug, Error, PartialEq)]
pub enum DspError {
    #[error("sample rate must be finite and greater than zero")]
    InvalidSampleRate,
    #[error("frame rate must be finite and between 1 and 60 frames per second")]
    InvalidFrameRate,
    #[error("FFT size must be a power of two between 256 and 16384")]
    InvalidFftSize,
    #[error("waveform preview must contain at least one point")]
    InvalidWaveformPoints,
    #[error("tone frequency must be finite and within the Nyquist interval")]
    ToneOutsideNyquist,
    #[error("FM+RDS generation requires at least 500 kS/s and 150 kHz of channel-edge headroom")]
    FmRdsOutsideNyquist,
    #[error("AM generation requires at least 50 kS/s and 15 kHz of channel-edge headroom")]
    AmOutsideNyquist,
    #[error("NBFM generation requires at least 100 kS/s and 25 kHz of channel-edge headroom")]
    NbfmOutsideNyquist,
    #[error("center frequency must be finite and non-negative")]
    InvalidCenterFrequency,
    #[error("minimum detection SNR must be finite and between 0 and 120 dB, got {0}")]
    InvalidDetectionSnr(f32),
    #[error("maximum detected signals must be between 1 and 64, got {0}")]
    InvalidDetectionLimit(usize),
    #[error("{field} must be finite and between -160 and 0 dBFS, got {value}")]
    InvalidLevel { field: &'static str, value: f32 },
    #[error("IQ buffer length must be {expected} interleaved values, got {actual}")]
    InvalidIqLength { expected: usize, actual: usize },
    #[error("IQ sample at index {index} contains a non-finite component")]
    InvalidIqSample { index: usize },
    #[error(transparent)]
    Rds(#[from] RdsBankError),
    #[error(transparent)]
    Vfo(#[from] VfoError),
}
