use std::f32::consts::TAU;

use num_complex::Complex32;

use super::filter::{BiquadLowPass, DcBlocker, OnePoleLowPass, Oscillator};

const PILOT_FREQUENCY_HZ: f32 = 19_000.0;
const PILOT_FILTER_CUTOFF_HZ: f32 = 500.0;
const BLEND_START_AMPLITUDE: f32 = 0.015;
const BLEND_FULL_AMPLITUDE: f32 = 0.060;
const LOCK_ACQUIRE_AMPLITUDE: f32 = 0.040;
const LOCK_RELEASE_AMPLITUDE: f32 = 0.020;
const BLEND_ATTACK_SECONDS: f32 = 0.050;
const BLEND_RELEASE_SECONDS: f32 = 0.250;

pub(super) struct WbfmStereoOutput {
    pub(super) left: f32,
    pub(super) right: f32,
    pub(super) stereo_locked: bool,
}

pub(super) struct WbfmStereoDemodulator {
    scale: f32,
    previous: Option<Complex32>,
    sum_low_pass: BiquadLowPass,
    difference_low_pass: BiquadLowPass,
    pilot: PilotTracker,
    left_de_emphasis: OnePoleLowPass,
    right_de_emphasis: OnePoleLowPass,
    left_dc_blocker: DcBlocker,
    right_dc_blocker: DcBlocker,
}

impl WbfmStereoDemodulator {
    pub(super) fn new(sample_rate_hz: f32, audio_cutoff_hz: f32) -> Self {
        Self {
            scale: sample_rate_hz / (TAU * 75_000.0),
            previous: None,
            sum_low_pass: BiquadLowPass::new(sample_rate_hz, audio_cutoff_hz),
            difference_low_pass: BiquadLowPass::new(sample_rate_hz, audio_cutoff_hz),
            pilot: PilotTracker::new(sample_rate_hz),
            left_de_emphasis: OnePoleLowPass::new(sample_rate_hz, 75.0e-6),
            right_de_emphasis: OnePoleLowPass::new(sample_rate_hz, 75.0e-6),
            left_dc_blocker: DcBlocker::new(sample_rate_hz, 20.0),
            right_dc_blocker: DcBlocker::new(sample_rate_hz, 20.0),
        }
    }

    pub(super) fn process(&mut self, sample: Complex32) -> WbfmStereoOutput {
        let Some(previous) = self.previous.replace(sample) else {
            return WbfmStereoOutput {
                left: 0.0,
                right: 0.0,
                stereo_locked: false,
            };
        };
        let phase_difference = sample * previous.conj();
        let composite = phase_difference.im.atan2(phase_difference.re) * self.scale;
        let pilot = self.pilot.process(composite);
        let sum = self.sum_low_pass.process(composite);
        let difference = self
            .difference_low_pass
            .process(composite * 2.0 * pilot.subcarrier_38khz);
        let left = sum + pilot.blend * difference;
        let right = sum - pilot.blend * difference;
        let left = self.left_de_emphasis.process(left);
        let right = self.right_de_emphasis.process(right);

        WbfmStereoOutput {
            left: self.left_dc_blocker.process(left),
            right: self.right_dc_blocker.process(right),
            stereo_locked: pilot.stereo_locked,
        }
    }

    pub(super) fn reset(&mut self) {
        self.previous = None;
        self.sum_low_pass.reset();
        self.difference_low_pass.reset();
        self.pilot.reset();
        self.left_de_emphasis.reset();
        self.right_de_emphasis.reset();
        self.left_dc_blocker.reset();
        self.right_dc_blocker.reset();
    }
}

struct PilotState {
    subcarrier_38khz: f32,
    blend: f32,
    stereo_locked: bool,
}

struct PilotTracker {
    oscillator: Oscillator,
    low_pass_1: ComplexOnePoleLowPass,
    low_pass_2: ComplexOnePoleLowPass,
    blend_attack_alpha: f32,
    blend_release_alpha: f32,
    blend: f32,
    stereo_locked: bool,
}

impl PilotTracker {
    fn new(sample_rate_hz: f32) -> Self {
        Self {
            oscillator: Oscillator::new(-PILOT_FREQUENCY_HZ, sample_rate_hz),
            low_pass_1: ComplexOnePoleLowPass::new(sample_rate_hz, PILOT_FILTER_CUTOFF_HZ),
            low_pass_2: ComplexOnePoleLowPass::new(sample_rate_hz, PILOT_FILTER_CUTOFF_HZ),
            blend_attack_alpha: one_pole_alpha(sample_rate_hz, BLEND_ATTACK_SECONDS),
            blend_release_alpha: one_pole_alpha(sample_rate_hz, BLEND_RELEASE_SECONDS),
            blend: 0.0,
            stereo_locked: false,
        }
    }

    fn process(&mut self, composite: f32) -> PilotState {
        let downmix_phasor = self.oscillator.phasor();
        let mixed = self.oscillator.mix(Complex32::new(composite, 0.0));
        let pilot = self.low_pass_2.process(self.low_pass_1.process(mixed));
        let pilot_amplitude = 2.0 * pilot.norm();

        if self.stereo_locked {
            if pilot_amplitude < LOCK_RELEASE_AMPLITUDE {
                self.stereo_locked = false;
            }
        } else if pilot_amplitude > LOCK_ACQUIRE_AMPLITUDE {
            self.stereo_locked = true;
        }

        let normalized_strength = ((pilot_amplitude - BLEND_START_AMPLITUDE)
            / (BLEND_FULL_AMPLITUDE - BLEND_START_AMPLITUDE))
            .clamp(0.0, 1.0);
        let blend_target =
            normalized_strength * normalized_strength * (3.0 - 2.0 * normalized_strength);
        let alpha = if blend_target > self.blend {
            self.blend_attack_alpha
        } else {
            self.blend_release_alpha
        };
        self.blend += alpha * (blend_target - self.blend);

        let normalized_pilot = if pilot_amplitude > f32::EPSILON {
            pilot / pilot.norm()
        } else {
            Complex32::new(1.0, 0.0)
        };
        let pilot_phasor = downmix_phasor.conj() * normalized_pilot;

        PilotState {
            subcarrier_38khz: (pilot_phasor * pilot_phasor).re,
            blend: self.blend,
            stereo_locked: self.stereo_locked,
        }
    }

    fn reset(&mut self) {
        self.oscillator.reset();
        self.low_pass_1.reset();
        self.low_pass_2.reset();
        self.blend = 0.0;
        self.stereo_locked = false;
    }
}

struct ComplexOnePoleLowPass {
    alpha: f32,
    state: Complex32,
}

impl ComplexOnePoleLowPass {
    fn new(sample_rate_hz: f32, cutoff_hz: f32) -> Self {
        Self {
            alpha: 1.0 - (-TAU * cutoff_hz / sample_rate_hz).exp(),
            state: Complex32::new(0.0, 0.0),
        }
    }

    fn process(&mut self, input: Complex32) -> Complex32 {
        self.state += (input - self.state) * self.alpha;
        self.state
    }

    fn reset(&mut self) {
        self.state = Complex32::new(0.0, 0.0);
    }
}

fn one_pole_alpha(sample_rate_hz: f32, time_constant_seconds: f32) -> f32 {
    1.0 - (-1.0 / (sample_rate_hz * time_constant_seconds)).exp()
}

#[cfg(test)]
mod tests {
    use super::{PILOT_FREQUENCY_HZ, PilotTracker, WbfmStereoDemodulator};
    use num_complex::Complex32;
    use std::f32::consts::TAU;

    const SAMPLE_RATE_HZ: f32 = 250_000.0;

    #[test]
    fn wbfm_stereo_tracks_pilot_phase_and_frequency_error() {
        let mut demodulator = WbfmStereoDemodulator::new(SAMPLE_RATE_HZ, 15_000.0);
        let mut carrier_phase = 0.0;
        let pilot_frequency_hz = PILOT_FREQUENCY_HZ * (1.0 + 200.0e-6);
        let mut left_audio = Vec::new();
        let mut right_audio = Vec::new();
        let mut stereo_locked = false;

        for index in 0..SAMPLE_RATE_HZ as usize {
            let time = index as f32 / SAMPLE_RATE_HZ;
            let left = (TAU * 700.0 * time).sin();
            let right = (TAU * 1_900.0 * time).sin();
            let pilot_phase = 0.73 + TAU * pilot_frequency_hz * time;
            let composite = 0.40 * (left + right) * 0.5
                + 0.40 * (left - right) * 0.5 * (2.0 * pilot_phase).cos()
                + 0.09 * pilot_phase.cos();
            let output = demodulator.process(fm_sample(&mut carrier_phase, composite));
            left_audio.push(output.left);
            right_audio.push(output.right);
            stereo_locked = output.stereo_locked;
        }

        let left = &left_audio[75_000..];
        let right = &right_audio[75_000..];
        let left_700 = tone_amplitude(left, 700.0);
        let left_1_900 = tone_amplitude(left, 1_900.0);
        let right_700 = tone_amplitude(right, 700.0);
        let right_1_900 = tone_amplitude(right, 1_900.0);
        assert!(stereo_locked);
        assert!(left_700 > 0.1, "left 700 Hz level was {left_700}");
        assert!(right_1_900 > 0.05, "right 1.9 kHz level was {right_1_900}");
        assert!(left_1_900 < left_700 * 0.1);
        assert!(right_700 < right_1_900 * 0.1);
    }

    #[test]
    fn wbfm_stereo_falls_back_to_identical_channels_without_pilot() {
        let mut demodulator = WbfmStereoDemodulator::new(SAMPLE_RATE_HZ, 15_000.0);
        let mut carrier_phase = 0.0;
        let mut maximum_channel_difference = 0.0_f32;
        let mut stereo_locked = false;

        for index in 0..SAMPLE_RATE_HZ as usize / 2 {
            let time = index as f32 / SAMPLE_RATE_HZ;
            let left = (TAU * 700.0 * time).sin();
            let right = (TAU * 1_900.0 * time).sin();
            let pilot_phase = TAU * PILOT_FREQUENCY_HZ * time;
            let composite = 0.40 * (left + right) * 0.5
                + 0.40 * (left - right) * 0.5 * (2.0 * pilot_phase).cos();
            let output = demodulator.process(fm_sample(&mut carrier_phase, composite));
            if index > 25_000 {
                maximum_channel_difference =
                    maximum_channel_difference.max((output.left - output.right).abs());
            }
            stereo_locked |= output.stereo_locked;
        }

        assert!(!stereo_locked);
        assert!(maximum_channel_difference < 1.0e-6);
    }

    #[test]
    fn wbfm_stereo_preserves_centered_gain_when_lock_changes() {
        let mut demodulator = WbfmStereoDemodulator::new(SAMPLE_RATE_HZ, 15_000.0);
        let mut carrier_phase = 0.0;
        let mut left_audio = Vec::new();
        let mut right_audio = Vec::new();

        for index in 0..SAMPLE_RATE_HZ as usize {
            let time = index as f32 / SAMPLE_RATE_HZ;
            let program = 0.40 * (TAU * 1_000.0 * time).sin();
            let pilot = if index >= SAMPLE_RATE_HZ as usize / 2 {
                0.09 * (TAU * PILOT_FREQUENCY_HZ * time).cos()
            } else {
                0.0
            };
            let output = demodulator.process(fm_sample(&mut carrier_phase, program + pilot));
            left_audio.push(output.left);
            right_audio.push(output.right);
        }

        for audio in [&left_audio, &right_audio] {
            let fallback_level = tone_amplitude(&audio[50_000..100_000], 1_000.0);
            let locked_level = tone_amplitude(&audio[187_500..237_500], 1_000.0);
            assert!(
                (locked_level / fallback_level - 1.0).abs() < 0.01,
                "centered level changed across lock: {fallback_level} to {locked_level}"
            );
        }
    }

    #[test]
    fn pilot_lock_is_hysteretic_and_blend_releases_smoothly() {
        let mut tracker = PilotTracker::new(SAMPLE_RATE_HZ);
        feed_pilot(&mut tracker, 0.03, 0.10, 0);
        assert!(!tracker.stereo_locked);

        feed_pilot(&mut tracker, 0.09, 0.20, 25_000);
        assert!(tracker.stereo_locked);
        assert!(tracker.blend > 0.9);

        feed_pilot(&mut tracker, 0.03, 0.05, 75_000);
        assert!(tracker.stereo_locked);
        let blend_before_loss = tracker.blend;
        tracker.process(0.0);
        assert!((tracker.blend - blend_before_loss).abs() < 1.0e-4);

        for _ in 0..SAMPLE_RATE_HZ as usize {
            tracker.process(0.0);
        }
        assert!(!tracker.stereo_locked);
        assert!(tracker.blend < 0.05);

        tracker.reset();
        assert!(!tracker.stereo_locked);
        assert_eq!(tracker.blend, 0.0);
    }

    fn feed_pilot(tracker: &mut PilotTracker, amplitude: f32, seconds: f32, start: usize) {
        let sample_count = (SAMPLE_RATE_HZ * seconds) as usize;
        for index in start..start + sample_count {
            let phase = TAU * PILOT_FREQUENCY_HZ * index as f32 / SAMPLE_RATE_HZ;
            tracker.process(amplitude * phase.cos());
        }
    }

    fn fm_sample(carrier_phase: &mut f32, composite: f32) -> Complex32 {
        *carrier_phase =
            (*carrier_phase + TAU * 75_000.0 * composite / SAMPLE_RATE_HZ).rem_euclid(TAU);
        Complex32::from_polar(0.5, *carrier_phase)
    }

    fn tone_amplitude(samples: &[f32], frequency_hz: f32) -> f32 {
        let mut in_phase = 0.0;
        let mut quadrature = 0.0;
        for (index, sample) in samples.iter().enumerate() {
            let phase = TAU * frequency_hz * index as f32 / SAMPLE_RATE_HZ;
            in_phase += sample * phase.cos();
            quadrature += sample * phase.sin();
        }
        2.0 * in_phase.hypot(quadrature) / samples.len() as f32
    }
}
