use std::{
    env,
    error::Error,
    fs::File,
    io::{BufReader, BufWriter, Read, Write},
    path::Path,
};

use dsp_core::vfo::{VfoBank, VfoConfig, VfoMode};

const INPUT_CHUNK_BYTES: usize = 256 * 1024;
const OUTPUT_SAMPLE_RATE_HZ: u32 = 48_000;

fn main() -> Result<(), Box<dyn Error>> {
    let arguments = env::args().skip(1).collect::<Vec<_>>();
    if !(5..=6).contains(&arguments.len()) {
        return Err(
            "usage: decode_wbfm_capture <capture.i8> <audio.f32> <sample-rate-hz> \
             <center-frequency-hz> <station-frequency-hz> [report.json]"
                .into(),
        );
    }

    let capture_path = Path::new(&arguments[0]);
    let audio_path = Path::new(&arguments[1]);
    let sample_rate_hz = arguments[2].parse::<u32>()?;
    let center_frequency_hz = arguments[3].parse::<f64>()?;
    let station_frequency_hz = arguments[4].parse::<f64>()?;
    let report_path = arguments.get(5).map(Path::new);

    let mut bank = VfoBank::new();
    bank.set_vfos(
        sample_rate_hz,
        center_frequency_hz,
        OUTPUT_SAMPLE_RATE_HZ,
        &[VfoConfig {
            id: "capture".to_owned(),
            frequency_hz: station_frequency_hz,
            mode: VfoMode::Wbfm,
            bandwidth_hz: 200_000.0,
            squelch_dbfs: -120.0,
            revision: 1,
        }],
    )?;

    let mut input = BufReader::new(File::open(capture_path)?);
    let mut output = BufWriter::new(File::create(audio_path)?);
    let mut read_buffer = vec![0_u8; INPUT_CHUNK_BYTES];
    let mut trailing_byte = None;
    let mut processed_samples = 0_u64;
    let mut emitted_frames = 0_u64;
    let mut locked_frames = 0_u64;

    loop {
        let read = input.read(&mut read_buffer)?;
        if read == 0 {
            break;
        }
        let mut bytes = Vec::with_capacity(read + usize::from(trailing_byte.is_some()));
        if let Some(byte) = trailing_byte.take() {
            bytes.push(byte);
        }
        bytes.extend_from_slice(&read_buffer[..read]);
        if !bytes.len().is_multiple_of(2) {
            trailing_byte = bytes.pop();
        }
        let iq = bytes
            .into_iter()
            .map(|sample| sample as i8)
            .collect::<Vec<_>>();
        let timestamp_us = processed_samples * 1_000_000 / u64::from(sample_rate_hz);
        bank.process_i8(&iq, timestamp_us)?;
        processed_samples += (iq.len() / 2) as u64;

        for block in bank.drain_audio() {
            if block.channel_count != 2 || !block.samples.len().is_multiple_of(2) {
                return Err("WBFM decoder emitted an invalid stereo block".into());
            }
            let frame_count = (block.samples.len() / 2) as u64;
            emitted_frames += frame_count;
            if block.stereo_locked {
                locked_frames += frame_count;
            }
            for sample in block.samples {
                output.write_all(&sample.to_le_bytes())?;
            }
        }
    }
    if trailing_byte.is_some() {
        return Err("capture ends with an incomplete I/Q sample".into());
    }
    output.flush()?;

    let locked_frame_ratio = if emitted_frames == 0 {
        0.0
    } else {
        locked_frames as f64 / emitted_frames as f64
    };
    let report = format!(
        concat!(
            "{{\n",
            "  \"capture\": \"{}\",\n",
            "  \"audio\": \"{}\",\n",
            "  \"sampleRateHz\": {},\n",
            "  \"centerFrequencyHz\": {},\n",
            "  \"stationFrequencyHz\": {},\n",
            "  \"outputSampleRateHz\": {},\n",
            "  \"processedSamples\": {},\n",
            "  \"emittedFrames\": {},\n",
            "  \"lockedFrameRatio\": {:.6}\n",
            "}}\n"
        ),
        json_escape(capture_path.to_string_lossy().as_ref()),
        json_escape(audio_path.to_string_lossy().as_ref()),
        sample_rate_hz,
        center_frequency_hz,
        station_frequency_hz,
        OUTPUT_SAMPLE_RATE_HZ,
        processed_samples,
        emitted_frames,
        locked_frame_ratio,
    );
    print!("{report}");
    if let Some(report_path) = report_path {
        std::fs::write(report_path, report)?;
    }
    Ok(())
}

fn json_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}
