#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

import numpy as np
from scipy import signal


def parse_capture(value: str) -> tuple[int, Path]:
    try:
        center_text, path_text = value.split("=", 1)
        center_hz = int(center_text)
    except (ValueError, TypeError) as error:
        raise argparse.ArgumentTypeError(
            "capture must use CENTER_HZ=PATH, for example 92500000=scan.i8"
        ) from error
    path = Path(path_text)
    if center_hz <= 0 or not path.is_file():
        raise argparse.ArgumentTypeError(f"invalid capture: {value}")
    return center_hz, path


def load_iq(path: Path, sample_format: str) -> np.ndarray:
    raw = np.fromfile(path, dtype=np.uint8 if sample_format == "u8" else np.int8)
    if raw.size == 0 or raw.size % 2 != 0:
        raise ValueError(f"{path} must contain complete interleaved I/Q pairs")
    if sample_format == "u8":
        raw = np.bitwise_xor(raw, 0x80).view(np.int8)
    iq = (raw[0::2].astype(np.float32) + 1j * raw[1::2].astype(np.float32)) / 128.0
    return iq - np.mean(iq)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rank FM broadcast channel energy in interleaved 8-bit IQ captures."
    )
    parser.add_argument(
        "--capture",
        action="append",
        required=True,
        type=parse_capture,
        metavar="CENTER_HZ=PATH",
        help="repeat for each wideband capture",
    )
    parser.add_argument("--sample-rate", type=int, required=True)
    parser.add_argument(
        "--sample-format",
        choices=("i8", "u8"),
        default="i8",
        help="i8 for signed HackRF captures or u8 for unsigned RTL-SDR captures",
    )
    parser.add_argument("--first-channel", type=int, default=88_100_000)
    parser.add_argument("--last-channel", type=int, default=107_900_000)
    parser.add_argument("--spacing", type=int, default=200_000)
    parser.add_argument("--channel-half-width", type=int, default=100_000)
    parser.add_argument(
        "--usable-edge-fraction",
        type=float,
        default=0.43,
        help="ignore capture offsets beyond this fraction of sample rate",
    )
    parser.add_argument("--lo-guard", type=int, default=20_000)
    parser.add_argument("--fft-size", type=int, default=32_768)
    parser.add_argument("--top", type=int, default=25)
    parser.add_argument("--json", type=Path, dest="json_path")
    args = parser.parse_args()

    if args.sample_rate <= 0 or args.spacing <= 0 or args.channel_half_width <= 0:
        parser.error("sample rate, spacing, and channel width must be positive")
    if not 0 < args.usable_edge_fraction < 0.5:
        parser.error("usable edge fraction must be between 0 and 0.5")

    channels_hz = range(
        args.first_channel,
        args.last_channel + 1,
        args.spacing,
    )
    results: dict[int, dict[str, float | int | str]] = {}

    for capture_center_hz, path in args.capture:
        iq = load_iq(path, args.sample_format)
        segment_size = min(args.fft_size, iq.size)
        frequencies, power = signal.welch(
            iq,
            fs=args.sample_rate,
            window="hann",
            nperseg=segment_size,
            noverlap=segment_size // 2,
            return_onesided=False,
            scaling="density",
        )
        order = np.argsort(frequencies)
        frequencies = frequencies[order]
        power = power[order]
        frequency_step = float(frequencies[1] - frequencies[0])

        for channel_hz in channels_hz:
            offset_hz = channel_hz - capture_center_hz
            if abs(offset_hz) > args.sample_rate * args.usable_edge_fraction:
                continue
            if abs(offset_hz) < args.lo_guard:
                continue

            distance = np.abs(frequencies - offset_hz)
            channel_mask = distance <= args.channel_half_width
            reference_mask = (
                (distance >= args.channel_half_width * 1.2)
                & (distance <= args.channel_half_width * 1.8)
            )
            if not np.any(channel_mask) or not np.any(reference_mask):
                continue

            channel_power = float(np.sum(power[channel_mask]) * frequency_step)
            reference_density = float(np.median(power[reference_mask]))
            reference_power = reference_density * args.channel_half_width * 2
            power_dbfs = float(10 * np.log10(max(channel_power, 1e-30)))
            contrast_db = float(
                10 * np.log10(max(channel_power / max(reference_power, 1e-30), 1e-30))
            )
            candidate = {
                "channelHz": channel_hz,
                "powerDbfs": round(power_dbfs, 3),
                "contrastDb": round(contrast_db, 3),
                "captureCenterHz": capture_center_hz,
                "capture": str(path),
            }
            existing = results.get(channel_hz)
            if existing is None or contrast_db > float(existing["contrastDb"]):
                results[channel_hz] = candidate

    ranked = sorted(
        results.values(),
        key=lambda candidate: float(candidate["contrastDb"]),
        reverse=True,
    )[: args.top]

    for candidate in ranked:
        print(
            f"{int(candidate['channelHz']) / 1e6:5.1f} MHz  "
            f"power={float(candidate['powerDbfs']):7.2f} dBFS  "
            f"contrast={float(candidate['contrastDb']):6.2f} dB  "
            f"capture={int(candidate['captureCenterHz']) / 1e6:.1f} MHz"
        )

    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(json.dumps(ranked, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
