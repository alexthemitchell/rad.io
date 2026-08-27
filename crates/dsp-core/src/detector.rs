use crate::{
    error::DspError,
    types::{DetectionConfig, SpectralDetection},
};

const NOISE_PERCENTILE: usize = 20;
const DC_GUARD_BINS: usize = 2;
const MERGE_GAP_BINS: usize = 1;
const SIDELOBE_GUARD_BINS: usize = 24;
const SIDELOBE_REJECTION_DB: f32 = 20.0;

pub struct DetectionResult {
    pub noise_floor_dbfs: f32,
    pub detections: Vec<SpectralDetection>,
}

pub fn validate_detection_config(config: DetectionConfig) -> Result<(), DspError> {
    if !config.minimum_snr_db.is_finite() || !(0.0..=120.0).contains(&config.minimum_snr_db) {
        return Err(DspError::InvalidDetectionSnr(config.minimum_snr_db));
    }
    if !(1..=64).contains(&config.max_signals) {
        return Err(DspError::InvalidDetectionLimit(config.max_signals));
    }
    Ok(())
}

#[must_use]
pub fn detect_signals(
    spectrum_db: &[f32],
    sample_rate_hz: f32,
    config: DetectionConfig,
) -> DetectionResult {
    let noise_floor_dbfs = estimate_noise_floor(spectrum_db);
    if !config.enabled || spectrum_db.is_empty() {
        return DetectionResult {
            noise_floor_dbfs,
            detections: Vec::new(),
        };
    }

    let threshold_dbfs = noise_floor_dbfs + config.minimum_snr_db;
    let half = spectrum_db.len() / 2;
    let mut occupied: Vec<bool> = spectrum_db
        .iter()
        .map(|power_dbfs| *power_dbfs >= threshold_dbfs)
        .collect();
    suppress_isolated_dc(&mut occupied, half);
    let occupied_bins: Vec<usize> = occupied
        .iter()
        .enumerate()
        .filter_map(|(index, is_occupied)| is_occupied.then_some(index))
        .collect();

    if occupied_bins.is_empty() {
        return DetectionResult {
            noise_floor_dbfs,
            detections: Vec::new(),
        };
    }

    let bin_width_hz = sample_rate_hz / spectrum_db.len() as f32;
    let mut detections = Vec::new();
    let mut run_start = occupied_bins[0];
    let mut run_end = run_start;

    for &index in &occupied_bins[1..] {
        if index <= run_end + MERGE_GAP_BINS + 1 {
            run_end = index;
        } else {
            detections.push(build_detection(
                spectrum_db,
                run_start,
                run_end,
                bin_width_hz,
                noise_floor_dbfs,
            ));
            run_start = index;
            run_end = index;
        }
    }
    detections.push(build_detection(
        spectrum_db,
        run_start,
        run_end,
        bin_width_hz,
        noise_floor_dbfs,
    ));

    detections.sort_by(|left, right| {
        right
            .peak_power_dbfs
            .total_cmp(&left.peak_power_dbfs)
            .then_with(|| left.peak_frequency_hz.total_cmp(&right.peak_frequency_hz))
    });
    let mut retained: Vec<SpectralDetection> = Vec::with_capacity(config.max_signals);
    for detection in detections {
        let is_sidelobe = retained.iter().any(|stronger| {
            stronger.peak_power_dbfs - detection.peak_power_dbfs >= SIDELOBE_REJECTION_DB
                && detection.peak_frequency_hz
                    >= stronger.lower_frequency_hz - SIDELOBE_GUARD_BINS as f32 * bin_width_hz
                && detection.peak_frequency_hz
                    <= stronger.upper_frequency_hz + SIDELOBE_GUARD_BINS as f32 * bin_width_hz
        });
        if !is_sidelobe {
            retained.push(detection);
            if retained.len() == config.max_signals {
                break;
            }
        }
    }

    DetectionResult {
        noise_floor_dbfs,
        detections: retained,
    }
}

fn estimate_noise_floor(spectrum_db: &[f32]) -> f32 {
    let half = spectrum_db.len() / 2;
    let mut noise_bins: Vec<f32> = spectrum_db
        .iter()
        .enumerate()
        .filter_map(|(index, power_dbfs)| {
            (!is_dc_guard_bin(index, half) && power_dbfs.is_finite()).then_some(*power_dbfs)
        })
        .collect();
    if noise_bins.is_empty() {
        return -120.0;
    }

    noise_bins.sort_by(f32::total_cmp);
    let percentile_index = (noise_bins.len() - 1) * NOISE_PERCENTILE / 100;
    noise_bins[percentile_index]
}

const fn is_dc_guard_bin(index: usize, half: usize) -> bool {
    index >= half.saturating_sub(DC_GUARD_BINS) && index <= half + DC_GUARD_BINS
}

fn suppress_isolated_dc(occupied: &mut [bool], half: usize) {
    let guard_start = half.saturating_sub(DC_GUARD_BINS);
    let guard_end = (half + DC_GUARD_BINS).min(occupied.len().saturating_sub(1));
    let occupied_before = guard_start
        .checked_sub(1)
        .is_some_and(|index| occupied[index]);
    let occupied_after = occupied.get(guard_end + 1).copied().unwrap_or(false);
    if !occupied_before || !occupied_after {
        occupied[guard_start..=guard_end].fill(false);
    }
}

fn build_detection(
    spectrum_db: &[f32],
    start: usize,
    end: usize,
    bin_width_hz: f32,
    noise_floor_dbfs: f32,
) -> SpectralDetection {
    let (peak_index, peak_power_dbfs) = spectrum_db[start..=end]
        .iter()
        .enumerate()
        .max_by(|(_, left), (_, right)| left.total_cmp(right))
        .map(|(relative_index, power)| (start + relative_index, *power))
        .expect("an occupied run always contains at least one bin");
    let half = spectrum_db.len() as f32 / 2.0;
    let bin_frequency = |index: usize| (index as f32 - half) * bin_width_hz;
    let nyquist_hz = bin_width_hz * half;
    let lower_frequency_hz = (bin_frequency(start) - bin_width_hz / 2.0).max(-nyquist_hz);
    let upper_frequency_hz = (bin_frequency(end) + bin_width_hz / 2.0).min(nyquist_hz);

    SpectralDetection {
        peak_frequency_hz: bin_frequency(peak_index),
        lower_frequency_hz,
        upper_frequency_hz,
        bandwidth_hz: (end - start + 1) as f32 * bin_width_hz,
        peak_power_dbfs,
        snr_db: peak_power_dbfs - noise_floor_dbfs,
        edge_clipped: start == 0 || end == spectrum_db.len() - 1,
    }
}

#[cfg(test)]
mod tests {
    use super::{DC_GUARD_BINS, detect_signals, validate_detection_config};
    use crate::{
        error::DspError,
        types::{DetectionConfig, SpectralDetection},
    };

    const SAMPLE_RATE_HZ: f32 = 16_000.0;
    const BIN_WIDTH_HZ: f32 = 1_000.0;

    fn detect(spectrum_db: &[f32]) -> Vec<SpectralDetection> {
        detect_signals(spectrum_db, SAMPLE_RATE_HZ, DetectionConfig::default()).detections
    }

    #[test]
    fn noise_only_spectrum_has_no_detections() {
        let result = detect_signals(&[-80.0; 16], SAMPLE_RATE_HZ, DetectionConfig::default());

        assert_eq!(result.noise_floor_dbfs, -80.0);
        assert!(result.detections.is_empty());
    }

    #[test]
    fn separated_runs_are_reported_strongest_first() {
        let mut spectrum = [-90.0; 16];
        spectrum[2..=4].copy_from_slice(&[-65.0, -30.0, -66.0]);
        spectrum[12..=13].copy_from_slice(&[-40.0, -60.0]);

        let detections = detect(&spectrum);

        assert_eq!(detections.len(), 2);
        assert_eq!(detections[0].peak_frequency_hz, -5_000.0);
        assert_eq!(detections[0].bandwidth_hz, 3_000.0);
        assert_eq!(detections[0].snr_db, 60.0);
        assert_eq!(detections[1].peak_frequency_hz, 4_000.0);
    }

    #[test]
    fn one_bin_gap_is_merged_into_one_occupied_band() {
        let mut spectrum = [-90.0; 16];
        spectrum[2] = -40.0;
        spectrum[4] = -45.0;

        let detections = detect(&spectrum);

        assert_eq!(detections.len(), 1);
        assert_eq!(detections[0].lower_frequency_hz, -6_500.0);
        assert_eq!(detections[0].upper_frequency_hz, -3_500.0);
    }

    #[test]
    fn dc_guard_and_sub_threshold_bins_are_ignored() {
        let mut spectrum = [-90.0; 16];
        spectrum[1] = -81.0;
        spectrum[8 - DC_GUARD_BINS..=8 + DC_GUARD_BINS].fill(-10.0);

        assert!(detect(&spectrum).is_empty());
    }

    #[test]
    fn wide_signal_crossing_dc_remains_one_detection() {
        let mut spectrum = [-90.0; 64];
        spectrum[12..=51].fill(-50.0);

        let result = detect_signals(&spectrum, 64_000.0, DetectionConfig::default());

        assert_eq!(result.noise_floor_dbfs, -90.0);
        assert_eq!(result.detections.len(), 1);
        assert_eq!(result.detections[0].bandwidth_hz, 40_000.0);
        assert!(result.detections[0].lower_frequency_hz < 0.0);
        assert!(result.detections[0].upper_frequency_hz > 0.0);
    }

    #[test]
    fn edge_band_is_clipped_and_single_bin_has_nonzero_bandwidth() {
        let mut spectrum = [-90.0; 16];
        spectrum[0] = -30.0;

        let detections = detect(&spectrum);

        assert_eq!(detections.len(), 1);
        assert!(detections[0].edge_clipped);
        assert_eq!(detections[0].lower_frequency_hz, -8_000.0);
        assert_eq!(detections[0].bandwidth_hz, BIN_WIDTH_HZ);
    }

    #[test]
    fn maximum_signal_count_is_enforced() {
        let mut spectrum = [-90.0; 32];
        for (index, power) in [(1, -30.0), (5, -40.0), (25, -50.0), (29, -60.0)] {
            spectrum[index] = power;
        }
        let result = detect_signals(
            &spectrum,
            SAMPLE_RATE_HZ,
            DetectionConfig {
                max_signals: 2,
                ..DetectionConfig::default()
            },
        );

        assert_eq!(result.detections.len(), 2);
        assert_eq!(result.detections[0].peak_power_dbfs, -30.0);
        assert_eq!(result.detections[1].peak_power_dbfs, -40.0);
    }

    #[test]
    fn weak_nearby_lobe_is_suppressed_but_peer_signal_is_retained() {
        let mut spectrum = [-100.0; 128];
        spectrum[10] = -20.0;
        spectrum[25] = -55.0;
        spectrum[31] = -25.0;

        let detections =
            detect_signals(&spectrum, 128_000.0, DetectionConfig::default()).detections;

        assert_eq!(detections.len(), 2);
        assert_eq!(detections[0].peak_power_dbfs, -20.0);
        assert_eq!(detections[1].peak_power_dbfs, -25.0);
    }

    #[test]
    fn detection_config_is_bounded() {
        assert!(matches!(
            validate_detection_config(DetectionConfig {
                minimum_snr_db: f32::NAN,
                ..DetectionConfig::default()
            }),
            Err(DspError::InvalidDetectionSnr(value)) if value.is_nan()
        ));
        assert_eq!(
            validate_detection_config(DetectionConfig {
                max_signals: 0,
                ..DetectionConfig::default()
            }),
            Err(DspError::InvalidDetectionLimit(0))
        );
    }
}
