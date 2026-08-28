use std::{
    f32::consts::TAU,
    hint::black_box,
    time::{Duration, Instant},
};

use dsp_core::{
    analyzer::SpectrumAnalyzer,
    rds::{RdsDecodeTarget, RdsDecoder, RdsDecoderBank},
    types::{AnalyzerConfig, DEFAULT_WAVEFORM_POINTS},
};

const MEASUREMENT_DURATION: Duration = Duration::from_millis(350);
const RDS_BLOCK_SAMPLES: usize = 32_768;

struct Measurement {
    iterations: u64,
    elapsed: Duration,
}

impl Measurement {
    fn seconds_per_iteration(&self) -> f64 {
        self.elapsed.as_secs_f64() / self.iterations as f64
    }
}

fn measure(mut operation: impl FnMut()) -> Measurement {
    operation();
    let started_at = Instant::now();
    let mut iterations = 0;
    while started_at.elapsed() < MEASUREMENT_DURATION {
        operation();
        iterations += 1;
    }
    Measurement {
        iterations,
        elapsed: started_at.elapsed(),
    }
}

fn analyzer_iq(fft_size: usize) -> Vec<f32> {
    let mut iq = Vec::with_capacity(fft_size * 2);
    for index in 0..fft_size {
        let phase = TAU * 73.0 * index as f32 / fft_size as f32;
        iq.push(phase.cos() * 0.25);
        iq.push(phase.sin() * 0.25);
    }
    iq
}

fn rds_iq(sample_rate_hz: u32) -> Vec<i8> {
    let mut iq = Vec::with_capacity(RDS_BLOCK_SAMPLES * 2);
    let mut noise_state = 0x1234_5678_u32;
    for index in 0..RDS_BLOCK_SAMPLES {
        noise_state = noise_state
            .wrapping_mul(1_664_525)
            .wrapping_add(1_013_904_223);
        let noise = ((noise_state >> 27) as i16 - 16) as f32;
        let phase = TAU * 97_000.0 * index as f32 / sample_rate_hz as f32;
        iq.push((phase.cos() * 80.0 + noise).clamp(-128.0, 127.0) as i8);
        iq.push((phase.sin() * 80.0 - noise).clamp(-128.0, 127.0) as i8);
    }
    iq
}

fn benchmark_analyzer() {
    println!("\nAnalyzer: one FFT/display frame");
    println!("| FFT size | Mean frame time | 30 FPS budget | Frames/s |");
    println!("| ---: | ---: | ---: | ---: |");

    for fft_size in [1_024, 2_048, 4_096, 8_192, 16_384] {
        let config = AnalyzerConfig {
            fft_size,
            waveform_points: fft_size.min(DEFAULT_WAVEFORM_POINTS),
        };
        let mut analyzer = SpectrumAnalyzer::new(config).expect("valid analyzer configuration");
        let iq = analyzer_iq(fft_size);
        let measurement = measure(|| {
            black_box(
                analyzer
                    .analyze(black_box(&iq), 20_000_000.0)
                    .expect("valid analyzer input"),
            );
        });
        let seconds_per_frame = measurement.seconds_per_iteration();
        println!(
            "| {fft_size} | {:.3} ms | {:.2}% | {:.0} |",
            seconds_per_frame * 1_000.0,
            seconds_per_frame * 30.0 * 100.0,
            1.0 / seconds_per_frame,
        );
    }
}

fn benchmark_rds_channels() {
    println!("\nIndependent RDS channels: continuous signed 8-bit wideband IQ");
    println!("| Sample rate | Targets | Throughput | Real-time headroom | Time / input sample |");
    println!("| ---: | ---: | ---: | ---: | ---: |");

    for sample_rate_hz in [2_400_000_u32, 10_000_000, 20_000_000] {
        let iq = rds_iq(sample_rate_hz);
        for target_count in [1_usize, 4, 8, 16, 32] {
            let mut decoders = (0..target_count)
                .map(|_| {
                    RdsDecoder::new(sample_rate_hz, 100_000.0).expect("supported RDS sample rate")
                })
                .collect::<Vec<_>>();
            let mut timestamp_us = 0_u64;
            let block_duration_us =
                RDS_BLOCK_SAMPLES as u64 * 1_000_000 / u64::from(sample_rate_hz);
            let measurement = measure(|| {
                let mut changed = false;
                for decoder in &mut decoders {
                    changed |= decoder
                        .process_i8(black_box(&iq), timestamp_us)
                        .expect("valid RDS input");
                }
                black_box(changed);
                timestamp_us = timestamp_us.saturating_add(block_duration_us);
            });
            let samples_per_second = RDS_BLOCK_SAMPLES as f64 * measurement.iterations as f64
                / measurement.elapsed.as_secs_f64();
            println!(
                "| {:.1} MS/s | {target_count} | {:.2} MS/s | {:.2}x | {:.1} ns |",
                sample_rate_hz as f64 / 1_000_000.0,
                samples_per_second / 1_000_000.0,
                samples_per_second / sample_rate_hz as f64,
                1_000_000_000.0 / samples_per_second,
            );
        }
    }
}

fn benchmark_rds_bank() {
    println!("\nShared-input production RDS bank");
    println!("| Sample rate | Targets | Throughput | Real-time headroom | Time / input sample |");
    println!("| ---: | ---: | ---: | ---: | ---: |");

    for sample_rate_hz in [2_400_000_u32, 10_000_000, 20_000_000] {
        let iq = rds_iq(sample_rate_hz);
        for target_count in [1_usize, 2, 4] {
            let targets = (0..target_count)
                .map(|index| RdsDecodeTarget {
                    channel_center_hz: 99_900_000.0 + index as f64 * 200_000.0,
                    frequency_offset_hz: 100_000.0,
                })
                .collect::<Vec<_>>();
            let mut bank = RdsDecoderBank::new();
            bank.set_targets(sample_rate_hz, &targets)
                .expect("valid RDS target set");
            let mut timestamp_us = 0_u64;
            let block_duration_us =
                RDS_BLOCK_SAMPLES as u64 * 1_000_000 / u64::from(sample_rate_hz);
            let measurement = measure(|| {
                black_box(
                    bank.process_i8(black_box(&iq), timestamp_us)
                        .expect("valid RDS input"),
                );
                timestamp_us = timestamp_us.saturating_add(block_duration_us);
            });
            let samples_per_second = RDS_BLOCK_SAMPLES as f64 * measurement.iterations as f64
                / measurement.elapsed.as_secs_f64();
            println!(
                "| {:.1} MS/s | {target_count} | {:.2} MS/s | {:.2}x | {:.1} ns |",
                sample_rate_hz as f64 / 1_000_000.0,
                samples_per_second / 1_000_000.0,
                samples_per_second / sample_rate_hz as f64,
                1_000_000_000.0 / samples_per_second,
            );
        }
    }
}

fn main() {
    println!("rad.io native DSP pipeline baseline (release profile)");
    benchmark_analyzer();
    benchmark_rds_channels();
    benchmark_rds_bank();
}
