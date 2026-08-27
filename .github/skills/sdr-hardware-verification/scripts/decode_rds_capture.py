#!/usr/bin/env python3

import argparse
import json
import math
import sys
from pathlib import Path

import pmt
import rds
from gnuradio import analog, blocks, digital, filter, gr
from gnuradio.filter import firdes

CHANNEL_RATE_HZ = 250_000
RDS_RATE_HZ = 19_000
MESSAGE_NAMES = {
    0: "pi",
    1: "ps",
    2: "pty",
    3: "flags",
    4: "radioText",
    5: "clockTime",
    6: "alternativeFrequencies",
}


def conda_package_version(package_name: str) -> str | None:
    metadata_directory = Path(sys.prefix) / "conda-meta"
    for metadata_path in metadata_directory.glob(f"{package_name}-*.json"):
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if metadata.get("name") == package_name:
            return str(metadata.get("version"))
    return None


def pmt_text(value: object) -> str:
    if pmt.is_symbol(value):
        return pmt.symbol_to_string(value)
    converted = pmt.to_python(value)
    if isinstance(converted, bytes):
        return converted.decode("utf-8", errors="replace")
    return str(converted)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Decode signed interleaved HackRF IQ with GNU Radio's independent RDS chain."
    )
    parser.add_argument("capture", type=Path)
    parser.add_argument("--sample-rate", type=int, required=True)
    parser.add_argument("--station-offset", type=int, required=True)
    parser.add_argument(
        "--pty-locale",
        choices=("europe", "north-america"),
        default="north-america",
    )
    parser.add_argument("--json", type=Path, dest="json_path")
    parser.add_argument(
        "--require-groups",
        action="store_true",
        help="exit with status 2 when no valid groups are decoded",
    )
    args = parser.parse_args()

    if not args.capture.is_file() or args.capture.stat().st_size % 2 != 0:
        parser.error("capture must be a non-empty signed interleaved I/Q file")
    if args.sample_rate < CHANNEL_RATE_HZ or args.sample_rate % CHANNEL_RATE_HZ != 0:
        parser.error("sample rate must be an integer multiple of 250000")
    if abs(args.station_offset) + 150_000 >= args.sample_rate / 2:
        parser.error("station offset must leave at least 150 kHz of capture headroom")

    locale = 1 if args.pty_locale == "north-america" else 0
    rrc_taps = firdes.root_raised_cosine(
        1.0,
        RDS_RATE_HZ,
        RDS_RATE_HZ / 8,
        1.0,
        151,
    )
    manchester_taps = [
        rrc_taps[index] - rrc_taps[index + 8]
        for index in range(len(rrc_taps) - 8)
    ]

    flowgraph = gr.top_block("independent captured RDS decoder")
    source = blocks.file_source(gr.sizeof_char, str(args.capture), False)
    converter = blocks.interleaved_char_to_complex(False, 128.0)
    channel = filter.freq_xlating_fir_filter_ccc(
        args.sample_rate // CHANNEL_RATE_HZ,
        firdes.low_pass(1.0, args.sample_rate, 135_000, 20_000),
        args.station_offset,
        args.sample_rate,
    )
    demodulator = analog.quadrature_demod_cf(
        CHANNEL_RATE_HZ / (2 * math.pi * 75_000)
    )
    rds_band = filter.freq_xlating_fir_filter_fcc(
        10,
        firdes.low_pass(1.0, CHANNEL_RATE_HZ, 7_500, 5_000),
        57_000,
        CHANNEL_RATE_HZ,
    )
    resampler = filter.rational_resampler_ccc(
        interpolation=RDS_RATE_HZ,
        decimation=CHANNEL_RATE_HZ // 10,
        taps=[],
        fractional_bw=0,
    )
    matched_filter = filter.fir_filter_ccc(1, manchester_taps)
    agc = analog.agc_cc(2e-3, 0.585, 53, 1000)
    symbol_sync = digital.symbol_sync_cc(
        digital.TED_ZERO_CROSSING,
        16,
        0.01,
        1.0,
        1.0,
        0.1,
        1,
        digital.constellation_bpsk().base(),
        digital.IR_MMSE_8TAP,
        128,
        [],
    )
    carrier_recovery = digital.constellation_receiver_cb(
        digital.constellation_bpsk().base(),
        2 * math.pi / 100,
        -0.002,
        0.002,
    )
    differential = digital.diff_decoder_bb(2, digital.DIFF_DIFFERENTIAL)
    decoder = rds.decoder(False, False)
    metadata_parser = rds.parser(False, False, locale)
    raw_messages = blocks.message_debug()
    parsed_messages = blocks.message_debug()

    flowgraph.connect(source, converter, channel, demodulator, rds_band, resampler)
    flowgraph.connect(
        resampler,
        matched_filter,
        agc,
        symbol_sync,
        carrier_recovery,
    )
    flowgraph.connect((carrier_recovery, 0), differential, decoder)
    flowgraph.msg_connect((decoder, "out"), (raw_messages, "store"))
    flowgraph.msg_connect((decoder, "out"), (metadata_parser, "in"))
    flowgraph.msg_connect((metadata_parser, "out"), (parsed_messages, "store"))
    flowgraph.run()

    unique: dict[str, list[str]] = {}
    events: list[dict[str, int | str]] = []
    for index in range(parsed_messages.num_messages()):
        message = parsed_messages.get_message(index)
        message_type = pmt.to_long(pmt.tuple_ref(message, 0))
        value = pmt_text(pmt.tuple_ref(message, 1))
        name = MESSAGE_NAMES.get(message_type, f"type{message_type}")
        events.append({"type": message_type, "name": name, "value": value})
        values = unique.setdefault(name, [])
        if value not in values:
            values.append(value)

    report = {
        "reference": {
            "gnuRadioVersion": gr.version(),
            "rdsPackageVersion": conda_package_version("gnuradio-rds"),
            "rdsModule": str(Path(rds.__file__).resolve()),
        },
        "capture": str(args.capture),
        "sampleRateHz": args.sample_rate,
        "stationOffsetHz": args.station_offset,
        "ptyLocale": args.pty_locale,
        "rawGroupCount": raw_messages.num_messages(),
        "parsedMessageCount": parsed_messages.num_messages(),
        "latest": {name: values[-1] for name, values in unique.items()},
        "unique": unique,
        "events": events,
    }

    print(
        f"gnuradio={report['reference']['gnuRadioVersion']} "
        f"gnuradio-rds={report['reference']['rdsPackageVersion'] or 'unknown'}"
    )
    print(f"raw_groups={report['rawGroupCount']}")
    for name, values in unique.items():
        print(f"{name}={values[-1]}")
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if args.require_groups and raw_messages.num_messages() == 0:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
