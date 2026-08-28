#!/usr/bin/env python3

import argparse
import json
import math
from pathlib import Path

import numpy as np
import scipy
from gnuradio import analog, blocks, filter, gr
from gnuradio.filter import firdes
from scipy import signal

CHANNEL_RATE_HZ = 250_000
AUDIO_RATE_HZ = 48_000
PILOT_HZ = 19_000.0
PILOT_BAND_HZ = (18_500.0, 19_500.0)


def decode_composite(capture: Path, sample_rate_hz: int, station_offset_hz: int) -> np.ndarray:
    flowgraph = gr.top_block("independent captured WBFM discriminator")
    source = blocks.file_source(gr.sizeof_char, str(capture), False)
    converter = blocks.interleaved_char_to_complex(False, 128.0)
    channel = filter.freq_xlating_fir_filter_ccc(
        sample_rate_hz // CHANNEL_RATE_HZ,
        firdes.low_pass(1.0, sample_rate_hz, 100_000, 25_000),
        station_offset_hz,
        sample_rate_hz,
    )
    demodulator = analog.quadrature_demod_cf(
        CHANNEL_RATE_HZ / (2 * math.pi * 75_000)
    )
    sink = blocks.vector_sink_f()
    flowgraph.connect(source, converter, channel, demodulator, sink)
    flowgraph.run()
    return np.asarray(sink.data(), dtype=np.float64)


def recover_reference_audio(composite: np.ndarray) -> tuple[np.ndarray, np.ndarray, dict]:
    pilot_sos = signal.butter(
        4,
        PILOT_BAND_HZ,
        btype="bandpass",
        fs=CHANNEL_RATE_HZ,
        output="sos",
    )
    audio_sos = signal.butter(
        6,
        15_000,
        btype="lowpass",
        fs=CHANNEL_RATE_HZ,
        output="sos",
    )
    pilot = signal.sosfiltfilt(pilot_sos, composite)
    analytic_pilot = signal.hilbert(pilot)
    pilot_phase = np.unwrap(np.angle(analytic_pilot))
    pilot_amplitude = np.abs(analytic_pilot)
    summed = signal.sosfiltfilt(audio_sos, composite)
    difference = signal.sosfiltfilt(
        audio_sos,
        composite * 2.0 * np.cos(2.0 * pilot_phase),
    )
    left = apply_de_emphasis_and_dc_block(summed + difference)
    right = apply_de_emphasis_and_dc_block(summed - difference)
    left = signal.resample_poly(left, 24, 125)
    right = signal.resample_poly(right, 24, 125)

    settle_start = min(len(composite) // 2, CHANNEL_RATE_HZ // 2)
    settled_phase = pilot_phase[settle_start:]
    settled_amplitude = pilot_amplitude[settle_start:]
    pilot_frequency_hz = float(
        np.median(np.diff(settled_phase)) * CHANNEL_RATE_HZ / (2.0 * math.pi)
    )
    metrics = {
        "pilotFrequencyHz": pilot_frequency_hz,
        "pilotAmplitude": float(np.median(settled_amplitude)),
    }
    return left, right, metrics


def apply_de_emphasis_and_dc_block(samples: np.ndarray) -> np.ndarray:
    alpha = 1.0 - math.exp(-1.0 / (CHANNEL_RATE_HZ * 75.0e-6))
    de_emphasized = signal.lfilter([alpha], [1.0, -(1.0 - alpha)], samples)
    dc_sos = signal.butter(
        2,
        20.0,
        btype="highpass",
        fs=CHANNEL_RATE_HZ,
        output="sos",
    )
    return signal.sosfilt(dc_sos, de_emphasized)


def write_stereo(path: Path, left: np.ndarray, right: np.ndarray) -> None:
    frame_count = min(len(left), len(right))
    interleaved = np.column_stack((left[:frame_count], right[:frame_count])).astype("<f4")
    path.parent.mkdir(parents=True, exist_ok=True)
    interleaved.tofile(path)


def read_stereo(path: Path) -> tuple[np.ndarray, np.ndarray]:
    samples = np.fromfile(path, dtype="<f4")
    if samples.size == 0 or samples.size % 2 != 0:
        raise ValueError("product audio must contain complete interleaved f32 stereo frames")
    return samples[0::2].astype(np.float64), samples[1::2].astype(np.float64)


def power_ratio_db(numerator: np.ndarray, denominator: np.ndarray) -> float:
    numerator_power = float(np.mean(np.square(numerator)))
    denominator_power = float(np.mean(np.square(denominator)))
    return 10.0 * math.log10(max(numerator_power, 1.0e-20) / max(denominator_power, 1.0e-20))


def stereo_content_metrics(left: np.ndarray, right: np.ndarray) -> dict:
    summed = (left + right) * 0.5
    difference = (left - right) * 0.5
    return {
        "frames": int(min(len(left), len(right))),
        "differenceToSumDb": power_ratio_db(difference, summed),
    }


def normalized_correlation(left: np.ndarray, right: np.ndarray) -> float:
    left = left - np.mean(left)
    right = right - np.mean(right)
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    return 0.0 if denominator == 0.0 else float(np.dot(left, right) / denominator)


def align_stereo(
    product_left: np.ndarray,
    product_right: np.ndarray,
    reference_left: np.ndarray,
    reference_right: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, int]:
    product_mono = (product_left + product_right) * 0.5
    reference_mono = (reference_left + reference_right) * 0.5
    frame_count = min(len(product_mono), len(reference_mono))
    product_mono = product_mono[:frame_count] - np.mean(product_mono[:frame_count])
    reference_mono = reference_mono[:frame_count] - np.mean(reference_mono[:frame_count])
    correlation = signal.correlate(product_mono, reference_mono, mode="full", method="fft")
    lags = signal.correlation_lags(len(product_mono), len(reference_mono), mode="full")
    maximum_lag = AUDIO_RATE_HZ // 5
    allowed = np.abs(lags) <= maximum_lag
    lag = int(lags[allowed][np.argmax(np.abs(correlation[allowed]))])

    if lag >= 0:
        product_slice = slice(lag, None)
        reference_slice = slice(None)
    else:
        product_slice = slice(None)
        reference_slice = slice(-lag, None)
    product_left = product_left[product_slice]
    product_right = product_right[product_slice]
    reference_left = reference_left[reference_slice]
    reference_right = reference_right[reference_slice]
    frame_count = min(
        len(product_left),
        len(product_right),
        len(reference_left),
        len(reference_right),
    )
    return (
        product_left[:frame_count],
        product_right[:frame_count],
        reference_left[:frame_count],
        reference_right[:frame_count],
        lag,
    )


def compare_product(
    product_audio: Path,
    reference_left: np.ndarray,
    reference_right: np.ndarray,
    settle_seconds: float,
) -> dict:
    product_left, product_right = read_stereo(product_audio)
    settle_frames = round(settle_seconds * AUDIO_RATE_HZ)
    if settle_frames >= min(
        len(product_left),
        len(product_right),
        len(reference_left),
        len(reference_right),
    ):
        raise ValueError("settle duration must leave product and reference audio to compare")
    product_left = product_left[settle_frames:]
    product_right = product_right[settle_frames:]
    reference_left = reference_left[settle_frames:]
    reference_right = reference_right[settle_frames:]
    (
        product_left,
        product_right,
        reference_left,
        reference_right,
        lag,
    ) = align_stereo(product_left, product_right, reference_left, reference_right)

    direct_left = normalized_correlation(product_left, reference_left)
    direct_right = normalized_correlation(product_right, reference_right)
    swapped_left = normalized_correlation(product_left, reference_right)
    swapped_right = normalized_correlation(product_right, reference_left)
    direct_score = (abs(direct_left) + abs(direct_right)) * 0.5
    swapped_score = (abs(swapped_left) + abs(swapped_right)) * 0.5
    product_content = stereo_content_metrics(product_left, product_right)
    reference_content = stereo_content_metrics(reference_left, reference_right)
    return {
        "alignmentLagFrames": lag,
        "comparedFrames": int(len(product_left)),
        "leftCorrelation": direct_left,
        "rightCorrelation": direct_right,
        "swappedLeftCorrelation": swapped_left,
        "swappedRightCorrelation": swapped_right,
        "directPairingScore": direct_score,
        "swappedPairingScore": swapped_score,
        "productDifferenceToSumDb": product_content["differenceToSumDb"],
        "referenceDifferenceToSumDb": reference_content["differenceToSumDb"],
        "differenceToSumDeltaDb": abs(
            product_content["differenceToSumDb"] - reference_content["differenceToSumDb"]
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Independently recover WBFM stereo from signed interleaved HackRF IQ."
    )
    parser.add_argument("capture", type=Path)
    parser.add_argument("--sample-rate", type=int, required=True)
    parser.add_argument("--station-offset", type=int, required=True)
    parser.add_argument("--reference-audio", type=Path)
    parser.add_argument("--product-audio", type=Path)
    parser.add_argument("--product-report", type=Path)
    parser.add_argument("--settle-seconds", type=float, default=0.5)
    parser.add_argument("--json", type=Path, dest="json_path")
    args = parser.parse_args()

    if not args.capture.is_file() or args.capture.stat().st_size == 0:
        parser.error("capture must be a non-empty file")
    if args.capture.stat().st_size % 2 != 0:
        parser.error("capture must contain complete signed interleaved I/Q samples")
    if args.sample_rate < CHANNEL_RATE_HZ or args.sample_rate % CHANNEL_RATE_HZ != 0:
        parser.error("sample rate must be an integer multiple of 250000")
    if abs(args.station_offset) + 125_000 >= args.sample_rate / 2:
        parser.error("station offset must leave more than 125 kHz of capture headroom")
    if not math.isfinite(args.settle_seconds) or args.settle_seconds < 0:
        parser.error("settle duration must be finite and non-negative")
    if args.product_audio and not args.product_audio.is_file():
        parser.error("product audio must be an existing interleaved f32 file")
    if args.product_report and not args.product_report.is_file():
        parser.error("product report must be an existing JSON file")

    composite = decode_composite(args.capture, args.sample_rate, args.station_offset)
    if len(composite) < CHANNEL_RATE_HZ:
        parser.error("capture must contain at least one second of channelized samples")
    reference_left, reference_right, pilot = recover_reference_audio(composite)
    if args.reference_audio:
        write_stereo(args.reference_audio, reference_left, reference_right)

    settle_frames = round(args.settle_seconds * AUDIO_RATE_HZ)
    if settle_frames >= min(len(reference_left), len(reference_right)):
        parser.error("settle duration must leave reference audio to analyze")
    reference_content = stereo_content_metrics(
        reference_left[settle_frames:],
        reference_right[settle_frames:],
    )
    content_eligible = (
        pilot["pilotAmplitude"] >= 0.015
        and reference_content["differenceToSumDb"] >= -30.0
    )
    report = {
        "reference": {
            "gnuRadioVersion": gr.version(),
            "scipyVersion": scipy.__version__,
            "method": "GNU Radio channel/FM demod plus SciPy Hilbert pilot recovery",
        },
        "capture": str(args.capture),
        "sampleRateHz": args.sample_rate,
        "stationOffsetHz": args.station_offset,
        "channelSampleRateHz": CHANNEL_RATE_HZ,
        "audioSampleRateHz": AUDIO_RATE_HZ,
        "durationSeconds": len(composite) / CHANNEL_RATE_HZ,
        "pilot": pilot,
        "referenceAudio": reference_content,
        "contentEligible": content_eligible,
    }
    if args.product_audio:
        try:
            report["productComparison"] = compare_product(
                args.product_audio,
                reference_left,
                reference_right,
                args.settle_seconds,
            )
        except ValueError as error:
            parser.error(str(error))
    if args.product_report:
        report["product"] = json.loads(args.product_report.read_text(encoding="utf-8"))

    serialized = json.dumps(report, indent=2) + "\n"
    print(serialized, end="")
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(serialized, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())