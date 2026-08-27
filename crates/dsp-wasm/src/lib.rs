use dsp_core::types::{AnalysisFrame as CoreAnalysisFrame, AnalyzerConfig, GeneratorConfig};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DspEngine {
    inner: dsp_core::DspEngine,
}

#[wasm_bindgen]
impl DspEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: dsp_core::DspEngine::new(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn protocol_version(&self) -> u32 {
        self.inner.protocol_version()
    }

    #[wasm_bindgen(getter)]
    pub fn sequence(&self) -> u32 {
        self.inner.sequence()
    }

    #[allow(clippy::too_many_arguments)]
    pub fn configure(
        &mut self,
        sample_rate_hz: f32,
        tone_frequency_hz: f32,
        tone_level_dbfs: f32,
        noise_enabled: bool,
        noise_level_dbfs: f32,
        fft_size: u32,
        seed: u64,
    ) -> Result<(), JsError> {
        self.inner
            .configure(
                GeneratorConfig {
                    sample_rate_hz,
                    tone_frequency_hz,
                    tone_level_dbfs,
                    noise_enabled,
                    noise_level_dbfs,
                    seed,
                },
                AnalyzerConfig {
                    fft_size: fft_size as usize,
                    waveform_points: 1024,
                },
            )
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn generate_and_analyze(&mut self) -> Result<AnalysisFrame, JsError> {
        self.inner
            .generate_and_analyze()
            .map(AnalysisFrame::from)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn analyze_external(
        &mut self,
        iq: &[f32],
        sample_rate_hz: f32,
        center_frequency_hz: f64,
    ) -> Result<AnalysisFrame, JsError> {
        self.inner
            .analyze_external(iq, sample_rate_hz, center_frequency_hz)
            .map(AnalysisFrame::from)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

impl Default for DspEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub struct AnalysisFrame {
    inner: CoreAnalysisFrame,
}

impl From<CoreAnalysisFrame> for AnalysisFrame {
    fn from(inner: CoreAnalysisFrame) -> Self {
        Self { inner }
    }
}

#[wasm_bindgen]
impl AnalysisFrame {
    #[wasm_bindgen(getter)]
    pub fn waveform(&self) -> Vec<f32> {
        self.inner.waveform.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn spectrum_db(&self) -> Vec<f32> {
        self.inner.spectrum_db.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn sequence(&self) -> u32 {
        self.inner.sequence
    }

    #[wasm_bindgen(getter)]
    pub fn sample_rate_hz(&self) -> f32 {
        self.inner.sample_rate_hz
    }

    #[wasm_bindgen(getter)]
    pub fn center_frequency_hz(&self) -> f64 {
        self.inner.center_frequency_hz
    }

    #[wasm_bindgen(getter)]
    pub fn peak_frequency_hz(&self) -> f32 {
        self.inner.peak_frequency_hz
    }

    #[wasm_bindgen(getter)]
    pub fn peak_power_dbfs(&self) -> f32 {
        self.inner.peak_power_dbfs
    }

    #[wasm_bindgen(getter)]
    pub fn elapsed_samples(&self) -> u64 {
        self.inner.elapsed_samples
    }
}
