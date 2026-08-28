use std::f32::consts::{PI, TAU};

use num_complex::Complex32;

const CIC_ORDER: usize = 4;

pub(super) struct Oscillator {
    value: Complex32,
    step: Complex32,
    samples: u32,
}

impl Oscillator {
    pub(super) fn new(frequency_hz: f32, sample_rate_hz: f32) -> Self {
        let phase = TAU * frequency_hz / sample_rate_hz;
        Self {
            value: Complex32::new(1.0, 0.0),
            step: Complex32::new(phase.cos(), phase.sin()),
            samples: 0,
        }
    }

    pub(super) fn mix(&mut self, sample: Complex32) -> Complex32 {
        let mixed = sample * self.value;
        self.value *= self.step;
        self.samples += 1;
        if self.samples == 4096 {
            self.value /= self.value.norm().max(f32::EPSILON);
            self.samples = 0;
        }
        mixed
    }

    pub(super) fn reset(&mut self) {
        self.value = Complex32::new(1.0, 0.0);
        self.samples = 0;
    }
}

pub(super) struct CicDecimator {
    decimation: u32,
    count: u32,
    delay_index: usize,
    delays: Vec<Vec<Complex32>>,
    sums: [Complex32; CIC_ORDER],
}

impl CicDecimator {
    pub(super) fn new(decimation: u32) -> Self {
        Self {
            decimation,
            count: 0,
            delay_index: 0,
            delays: (0..CIC_ORDER)
                .map(|_| vec![Complex32::new(0.0, 0.0); decimation as usize])
                .collect(),
            sums: [Complex32::new(0.0, 0.0); CIC_ORDER],
        }
    }

    pub(super) fn process(&mut self, sample: Complex32) -> Option<Complex32> {
        if self.decimation == 1 {
            return Some(sample);
        }

        let mut output = sample;
        for stage in 0..CIC_ORDER {
            let delayed = self.delays[stage][self.delay_index];
            self.sums[stage] += output - delayed;
            self.delays[stage][self.delay_index] = output;
            output = self.sums[stage] / self.decimation as f32;
        }
        self.delay_index = (self.delay_index + 1) % self.decimation as usize;
        self.count += 1;
        if self.count < self.decimation {
            return None;
        }
        self.count = 0;

        Some(output)
    }

    pub(super) fn reset(&mut self) {
        self.count = 0;
        self.delay_index = 0;
        for delay in &mut self.delays {
            delay.fill(Complex32::new(0.0, 0.0));
        }
        self.sums.fill(Complex32::new(0.0, 0.0));
    }
}

pub(super) struct FirDecimator {
    coefficients: Vec<f32>,
    delay: Vec<Complex32>,
    write_index: usize,
    decimation: u32,
    count: u32,
}

impl FirDecimator {
    pub(super) fn new(
        sample_rate_hz: f32,
        cutoff_hz: f32,
        decimation: u32,
        tap_count: usize,
    ) -> Self {
        let coefficients = low_pass_coefficients(sample_rate_hz, cutoff_hz, tap_count);
        Self {
            delay: vec![Complex32::new(0.0, 0.0); coefficients.len()],
            coefficients,
            write_index: 0,
            decimation,
            count: 0,
        }
    }

    pub(super) fn process(&mut self, sample: Complex32) -> Option<Complex32> {
        self.delay[self.write_index] = sample;
        self.write_index = (self.write_index + 1) % self.delay.len();
        self.count += 1;
        if self.count < self.decimation {
            return None;
        }
        self.count = 0;

        let mut output = Complex32::new(0.0, 0.0);
        for (tap, coefficient) in self.coefficients.iter().enumerate() {
            output += self.delay[(self.write_index + tap) % self.delay.len()] * coefficient;
        }
        Some(output)
    }

    pub(super) fn reset(&mut self) {
        self.delay.fill(Complex32::new(0.0, 0.0));
        self.write_index = 0;
        self.count = 0;
    }
}

fn low_pass_coefficients(sample_rate_hz: f32, cutoff_hz: f32, tap_count: usize) -> Vec<f32> {
    debug_assert!(tap_count % 2 == 1);
    let normalized_cutoff = cutoff_hz / sample_rate_hz;
    let center = (tap_count - 1) as f32 / 2.0;
    let mut coefficients = (0..tap_count)
        .map(|index| {
            let offset = index as f32 - center;
            let sinc = if offset.abs() < f32::EPSILON {
                2.0 * normalized_cutoff
            } else {
                (2.0 * PI * normalized_cutoff * offset).sin() / (PI * offset)
            };
            let window = 0.54 - 0.46 * (TAU * index as f32 / (tap_count - 1) as f32).cos();
            sinc * window
        })
        .collect::<Vec<_>>();
    let sum: f32 = coefficients.iter().sum();
    for coefficient in &mut coefficients {
        *coefficient /= sum;
    }
    coefficients
}

pub(super) struct BiquadLowPass {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadLowPass {
    pub(super) fn new(sample_rate_hz: f32, cutoff_hz: f32) -> Self {
        let omega = TAU * cutoff_hz / sample_rate_hz;
        let cosine = omega.cos();
        let alpha = omega.sin() / (2.0 * std::f32::consts::FRAC_1_SQRT_2);
        let a0 = 1.0 + alpha;
        Self {
            b0: (1.0 - cosine) / (2.0 * a0),
            b1: (1.0 - cosine) / a0,
            b2: (1.0 - cosine) / (2.0 * a0),
            a1: -2.0 * cosine / a0,
            a2: (1.0 - alpha) / a0,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    pub(super) fn process(&mut self, input: f32) -> f32 {
        let output = self.b0 * input + self.b1 * self.x1 + self.b2 * self.x2
            - self.a1 * self.y1
            - self.a2 * self.y2;
        self.x2 = self.x1;
        self.x1 = input;
        self.y2 = self.y1;
        self.y1 = output;
        output
    }

    pub(super) fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
}

pub(super) struct OnePoleLowPass {
    alpha: f32,
    state: f32,
}

impl OnePoleLowPass {
    pub(super) fn new(sample_rate_hz: f32, time_constant_seconds: f32) -> Self {
        Self {
            alpha: 1.0 - (-1.0 / (sample_rate_hz * time_constant_seconds)).exp(),
            state: 0.0,
        }
    }

    pub(super) fn process(&mut self, input: f32) -> f32 {
        self.state += self.alpha * (input - self.state);
        self.state
    }

    pub(super) fn reset(&mut self) {
        self.state = 0.0;
    }
}

pub(super) struct DcBlocker {
    coefficient: f32,
    previous_input: f32,
    previous_output: f32,
}

impl DcBlocker {
    pub(super) fn new(sample_rate_hz: f32, cutoff_hz: f32) -> Self {
        Self {
            coefficient: (-TAU * cutoff_hz / sample_rate_hz).exp(),
            previous_input: 0.0,
            previous_output: 0.0,
        }
    }

    pub(super) fn process(&mut self, input: f32) -> f32 {
        let output = input - self.previous_input + self.coefficient * self.previous_output;
        self.previous_input = input;
        self.previous_output = output;
        output
    }

    pub(super) fn reset(&mut self) {
        self.previous_input = 0.0;
        self.previous_output = 0.0;
    }
}

pub(super) struct LinearResampler {
    input_rate_hz: f64,
    output_rate_hz: f64,
    previous: Option<f32>,
    input_index: u64,
    next_output_time: f64,
}

impl LinearResampler {
    pub(super) fn new(input_rate_hz: f32, output_rate_hz: u32) -> Self {
        Self {
            input_rate_hz: f64::from(input_rate_hz),
            output_rate_hz: f64::from(output_rate_hz),
            previous: None,
            input_index: 0,
            next_output_time: 0.0,
        }
    }

    pub(super) fn process(&mut self, sample: f32) -> Resampled {
        let Some(previous) = self.previous.replace(sample) else {
            self.next_output_time = self.input_rate_hz / self.output_rate_hz;
            return Resampled::single(sample);
        };
        self.input_index += 1;
        let current_time = self.input_index as f64;
        let mut output = Resampled::new();
        while self.next_output_time <= current_time && output.len < output.samples.len() {
            let fraction = (self.next_output_time - (current_time - 1.0)).clamp(0.0, 1.0) as f32;
            output.push(previous + (sample - previous) * fraction);
            self.next_output_time += self.input_rate_hz / self.output_rate_hz;
        }
        output
    }

    pub(super) fn reset(&mut self) {
        self.previous = None;
        self.input_index = 0;
        self.next_output_time = 0.0;
    }
}

pub(super) struct Resampled {
    samples: [f32; 8],
    len: usize,
}

impl Resampled {
    fn new() -> Self {
        Self {
            samples: [0.0; 8],
            len: 0,
        }
    }

    fn single(sample: f32) -> Self {
        let mut output = Self::new();
        output.push(sample);
        output
    }

    fn push(&mut self, sample: f32) {
        self.samples[self.len] = sample;
        self.len += 1;
    }

    pub(super) fn iter(&self) -> impl Iterator<Item = f32> + '_ {
        self.samples[..self.len].iter().copied()
    }
}
