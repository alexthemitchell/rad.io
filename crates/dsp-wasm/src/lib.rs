use dsp_core::rds::{RdsDecodeTarget, RdsDecoderBank as CoreRdsDecoderBank};
use dsp_core::types::{
    AnalysisFrame as CoreAnalysisFrame, AnalyzerConfig, DEFAULT_WAVEFORM_POINTS, DetectionConfig,
    GeneratorConfig, GeneratorMode,
};
use dsp_core::vfo::{VfoAudioBlock as CoreVfoAudioBlock, VfoBank as CoreVfoBank, VfoConfig};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct VfoBank {
    inner: CoreVfoBank,
}

#[wasm_bindgen]
impl VfoBank {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: CoreVfoBank::new(),
        }
    }

    pub fn set_vfos(
        &mut self,
        sample_rate_hz: u32,
        center_frequency_hz: f64,
        output_sample_rate_hz: u32,
        configs: JsValue,
    ) -> Result<(), JsError> {
        let configs: Vec<VfoConfig> = serde_wasm_bindgen::from_value(configs)
            .map_err(|error| JsError::new(&error.to_string()))?;
        self.inner
            .set_vfos(
                sample_rate_hz,
                center_frequency_hz,
                output_sample_rate_hz,
                &configs,
            )
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn process_i8(&mut self, iq: &[i8], timestamp_us: u64) -> Result<bool, JsError> {
        self.inner
            .process_i8(iq, timestamp_us)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn process_f32(&mut self, iq: &[f32], timestamp_us: u64) -> Result<bool, JsError> {
        self.inner
            .process_f32(iq, timestamp_us)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn drain_audio(&mut self) -> VfoAudioBatch {
        VfoAudioBatch::new(self.inner.drain_audio())
    }

    pub fn reset(&mut self) {
        self.inner.reset_decoders();
    }
}

impl Default for VfoBank {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub struct VfoAudioBatch {
    ids: Vec<String>,
    revisions: Vec<u32>,
    source_timestamps_us: Vec<u64>,
    sample_rates_hz: Vec<u32>,
    channel_counts: Vec<u8>,
    signal_levels_dbfs: Vec<f32>,
    squelched: Vec<u8>,
    sample_offsets: Vec<u32>,
    samples: Vec<f32>,
}

impl VfoAudioBatch {
    fn new(blocks: Vec<CoreVfoAudioBlock>) -> Self {
        let mut batch = Self {
            ids: Vec::with_capacity(blocks.len()),
            revisions: Vec::with_capacity(blocks.len()),
            source_timestamps_us: Vec::with_capacity(blocks.len()),
            sample_rates_hz: Vec::with_capacity(blocks.len()),
            channel_counts: Vec::with_capacity(blocks.len()),
            signal_levels_dbfs: Vec::with_capacity(blocks.len()),
            squelched: Vec::with_capacity(blocks.len()),
            sample_offsets: Vec::with_capacity(blocks.len() + 1),
            samples: Vec::new(),
        };
        batch.sample_offsets.push(0);
        for block in blocks {
            batch.ids.push(block.vfo_id);
            batch.revisions.push(block.revision);
            batch.source_timestamps_us.push(block.source_timestamp_us);
            batch.sample_rates_hz.push(block.sample_rate_hz);
            batch.channel_counts.push(block.channel_count);
            batch.signal_levels_dbfs.push(block.signal_level_dbfs);
            batch.squelched.push(u8::from(block.squelched));
            batch.samples.extend(block.samples);
            batch.sample_offsets.push(batch.samples.len() as u32);
        }
        batch
    }
}

#[wasm_bindgen]
impl VfoAudioBatch {
    #[wasm_bindgen(getter)]
    pub fn block_count(&self) -> u32 {
        self.ids.len() as u32
    }

    #[wasm_bindgen(getter)]
    pub fn ids(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.ids).map_err(|error| JsError::new(&error.to_string()))
    }

    #[wasm_bindgen(getter)]
    pub fn revisions(&self) -> Vec<u32> {
        self.revisions.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn source_timestamps_us(&self) -> Vec<u64> {
        self.source_timestamps_us.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn sample_rates_hz(&self) -> Vec<u32> {
        self.sample_rates_hz.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn channel_counts(&self) -> Vec<u8> {
        self.channel_counts.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn signal_levels_dbfs(&self) -> Vec<f32> {
        self.signal_levels_dbfs.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn squelched(&self) -> Vec<u8> {
        self.squelched.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn sample_offsets(&self) -> Vec<u32> {
        self.sample_offsets.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn samples(&self) -> Vec<f32> {
        self.samples.clone()
    }
}

#[wasm_bindgen]
pub struct RdsDecoderBank {
    inner: CoreRdsDecoderBank,
}

#[wasm_bindgen]
impl RdsDecoderBank {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: CoreRdsDecoderBank::new(),
        }
    }

    pub fn set_targets(
        &mut self,
        sample_rate_hz: u32,
        channel_centers_hz: &[f64],
        frequency_offsets_hz: &[f32],
    ) -> Result<(), JsError> {
        if channel_centers_hz.len() != frequency_offsets_hz.len() {
            return Err(JsError::new(
                "RDS channel-center and frequency-offset arrays must have equal lengths.",
            ));
        }
        let targets: Vec<_> = channel_centers_hz
            .iter()
            .zip(frequency_offsets_hz)
            .map(|(channel_center_hz, frequency_offset_hz)| RdsDecodeTarget {
                channel_center_hz: *channel_center_hz,
                frequency_offset_hz: *frequency_offset_hz,
            })
            .collect();
        self.inner
            .set_targets(sample_rate_hz, &targets)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn process_i8(&mut self, iq: &[i8], timestamp_us: u64) -> Result<bool, JsError> {
        self.inner
            .process_i8(iq, timestamp_us)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn process_f32(&mut self, iq: &[f32], timestamp_us: u64) -> Result<bool, JsError> {
        self.inner
            .process_f32(iq, timestamp_us)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn snapshots(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.inner.snapshots())
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

impl Default for RdsDecoderBank {
    fn default() -> Self {
        Self::new()
    }
}

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
        generator_mode: u8,
        sample_rate_hz: f32,
        frame_rate_hz: f32,
        center_frequency_hz: f64,
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
                    mode: match generator_mode {
                        0 => GeneratorMode::Tone,
                        1 => GeneratorMode::FmRds,
                        2 => GeneratorMode::Am,
                        3 => GeneratorMode::Nbfm,
                        _ => return Err(JsError::new("Unsupported generator mode.")),
                    },
                    sample_rate_hz,
                    frame_rate_hz,
                    center_frequency_hz,
                    tone_frequency_hz,
                    tone_level_dbfs,
                    noise_enabled,
                    noise_level_dbfs,
                    seed,
                },
                AnalyzerConfig {
                    fft_size: fft_size as usize,
                    waveform_points: DEFAULT_WAVEFORM_POINTS,
                },
            )
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn configure_detection(
        &mut self,
        enabled: bool,
        minimum_snr_db: f32,
        max_signals: u32,
    ) -> Result<(), JsError> {
        self.inner
            .configure_detection(DetectionConfig {
                enabled,
                minimum_snr_db,
                max_signals: max_signals as usize,
            })
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn configure_vfos(
        &mut self,
        output_sample_rate_hz: u32,
        configs: JsValue,
    ) -> Result<(), JsError> {
        let configs: Vec<VfoConfig> = serde_wasm_bindgen::from_value(configs)
            .map_err(|error| JsError::new(&error.to_string()))?;
        self.inner
            .configure_vfos(output_sample_rate_hz, configs)
            .map_err(|error| JsError::new(&error.to_string()))
    }

    pub fn drain_vfo_audio(&mut self) -> VfoAudioBatch {
        VfoAudioBatch::new(self.inner.drain_vfo_audio())
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

    pub fn reset_rds(&mut self) {
        self.inner.reset_rds();
    }

    pub fn reset_vfos(&mut self) {
        self.inner.reset_vfos();
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
    pub fn noise_floor_dbfs(&self) -> f32 {
        self.inner.noise_floor_dbfs
    }

    #[wasm_bindgen(getter)]
    pub fn detection_peak_frequencies_hz(&self) -> Vec<f32> {
        self.inner
            .detections
            .iter()
            .map(|detection| detection.peak_frequency_hz)
            .collect()
    }

    #[wasm_bindgen(getter)]
    pub fn detection_lower_frequencies_hz(&self) -> Vec<f32> {
        self.inner
            .detections
            .iter()
            .map(|detection| detection.lower_frequency_hz)
            .collect()
    }

    #[wasm_bindgen(getter)]
    pub fn detection_upper_frequencies_hz(&self) -> Vec<f32> {
        self.inner
            .detections
            .iter()
            .map(|detection| detection.upper_frequency_hz)
            .collect()
    }

    #[wasm_bindgen(getter)]
    pub fn detection_bandwidths_hz(&self) -> Vec<f32> {
        self.inner
            .detections
            .iter()
            .map(|detection| detection.bandwidth_hz)
            .collect()
    }

    #[wasm_bindgen(getter)]
    pub fn detection_peak_powers_dbfs(&self) -> Vec<f32> {
        self.inner
            .detections
            .iter()
            .map(|detection| detection.peak_power_dbfs)
            .collect()
    }

    #[wasm_bindgen(getter)]
    pub fn detection_snrs_db(&self) -> Vec<f32> {
        self.inner
            .detections
            .iter()
            .map(|detection| detection.snr_db)
            .collect()
    }

    #[wasm_bindgen(getter)]
    pub fn detection_edge_clipped(&self) -> Vec<u8> {
        self.inner
            .detections
            .iter()
            .map(|detection| u8::from(detection.edge_clipped))
            .collect()
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

    #[wasm_bindgen(getter)]
    pub fn rds_snapshots(&self) -> Result<JsValue, JsError> {
        serde_wasm_bindgen::to_value(&self.inner.rds_snapshots)
            .map_err(|error| JsError::new(&error.to_string()))
    }
}
