use std::f64::consts::TAU;

use super::{GroupVersion, encode_group};

const PI: u16 = 0x3ce7;
const PROGRAM_TYPE: u16 = 2;
const FM_DEVIATION_HZ: f64 = 75_000.0;
const AUDIO_LEFT_HZ: f64 = 700.0;
const AUDIO_RIGHT_HZ: f64 = 1_900.0;
const PILOT_HZ: f64 = 19_000.0;
const RDS_SYMBOL_RATE: f64 = 1_187.5;

pub struct SyntheticFmRdsGenerator {
    carrier_phase: f64,
    left_phase: f64,
    right_phase: f64,
    pilot_phase: f64,
    symbol_phase: f64,
    differential_level: f64,
    stream: SyntheticRdsStream,
}

impl SyntheticFmRdsGenerator {
    #[must_use]
    pub fn new() -> Self {
        let mut stream = SyntheticRdsStream::new();
        let differential_level = stream.next_differential_level();
        Self {
            carrier_phase: 0.0,
            left_phase: 0.0,
            right_phase: 0.0,
            pilot_phase: 0.0,
            symbol_phase: 0.0,
            differential_level,
            stream,
        }
    }

    #[must_use]
    pub fn sample(
        &mut self,
        sample_rate_hz: f64,
        carrier_offset_hz: f64,
        amplitude: f64,
    ) -> (f32, f32) {
        let left = self.left_phase.sin();
        let right = self.right_phase.sin();
        let mono = (left + right) * 0.5;
        let difference = (left - right) * 0.5;
        let biphase = if self.symbol_phase < 0.5 {
            self.differential_level
        } else {
            -self.differential_level
        };
        let multiplex = 0.40 * mono
            + 0.40 * difference * (self.pilot_phase * 2.0).cos()
            + 0.09 * self.pilot_phase.cos()
            + 0.03 * biphase * (self.pilot_phase * 3.0).cos();
        let instantaneous_frequency_hz = carrier_offset_hz + FM_DEVIATION_HZ * multiplex;
        self.carrier_phase = (self.carrier_phase
            + TAU * instantaneous_frequency_hz / sample_rate_hz)
            .rem_euclid(TAU);

        self.left_phase = advance(self.left_phase, AUDIO_LEFT_HZ, sample_rate_hz);
        self.right_phase = advance(self.right_phase, AUDIO_RIGHT_HZ, sample_rate_hz);
        self.pilot_phase = advance(self.pilot_phase, PILOT_HZ, sample_rate_hz);
        self.symbol_phase += RDS_SYMBOL_RATE / sample_rate_hz;
        if self.symbol_phase >= 1.0 {
            self.symbol_phase -= 1.0;
            self.differential_level = self.stream.next_differential_level();
        }

        let (quadrature, in_phase) = self.carrier_phase.sin_cos();
        (
            (in_phase * amplitude) as f32,
            (quadrature * amplitude) as f32,
        )
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

impl Default for SyntheticFmRdsGenerator {
    fn default() -> Self {
        Self::new()
    }
}

struct SyntheticRdsStream {
    bits: Vec<bool>,
    bit_index: usize,
    differential_state: bool,
}

impl SyntheticRdsStream {
    fn new() -> Self {
        let bits = synthetic_group_words()
            .into_iter()
            .flat_map(|group| group.into_iter())
            .flat_map(|word| (0..26).rev().map(move |bit| word & (1 << bit) != 0))
            .collect();
        Self {
            bits,
            bit_index: 0,
            differential_state: false,
        }
    }

    fn next_differential_level(&mut self) -> f64 {
        let bit = self.bits[self.bit_index];
        self.bit_index = (self.bit_index + 1) % self.bits.len();
        self.differential_state ^= bit;
        if self.differential_state { 1.0 } else { -1.0 }
    }
}

#[must_use]
pub fn synthetic_group_words() -> Vec<[u32; 4]> {
    let mut information_groups = Vec::new();
    let ps = *b"RAD.IO  ";
    let af_blocks = [0xe201, 0x02cd, 0xcdcd, 0xcdcd];
    for _ in 0..2 {
        for segment in 0..4 {
            information_groups.push(information_group(
                0,
                GroupVersion::A,
                0x1c | segment as u16,
                af_blocks[segment],
                u16::from_be_bytes([ps[segment * 2], ps[segment * 2 + 1]]),
            ));
        }
    }

    let radio_text = b"RAD.IO synthetic RBDS test station\r";
    for (segment, characters) in radio_text.chunks(4).enumerate() {
        let mut padded = [b' '; 4];
        padded[..characters.len()].copy_from_slice(characters);
        information_groups.push(information_group(
            2,
            GroupVersion::A,
            segment as u16,
            u16::from_be_bytes([padded[0], padded[1]]),
            u16::from_be_bytes([padded[2], padded[3]]),
        ));
    }

    let ptyn = *b"PUBLIC  ";
    for _ in 0..2 {
        for segment in 0..2 {
            let start = segment * 4;
            information_groups.push(information_group(
                10,
                GroupVersion::A,
                segment as u16,
                u16::from_be_bytes([ptyn[start], ptyn[start + 1]]),
                u16::from_be_bytes([ptyn[start + 2], ptyn[start + 3]]),
            ));
        }
    }

    information_groups.push(clock_time_group(61_279, 16, 30, -240));
    information_groups.push(information_group(3, GroupVersion::A, 0x10, 0x0000, 0xcd46));
    information_groups.push(information_group(8, GroupVersion::A, 0x00, 0x8123, 0x4567));
    information_groups.push(information_group(14, GroupVersion::A, 0x00, 0x5241, 0x54a2));
    information_groups.push(information_group(6, GroupVersion::A, 0x00, 0x1234, 0x5678));

    information_groups.into_iter().map(encode_group).collect()
}

fn information_group(
    group_type: u16,
    version: GroupVersion,
    low_bits: u16,
    block_c: u16,
    block_d: u16,
) -> [u16; 4] {
    let version_bit = u16::from(version == GroupVersion::B) << 11;
    let block_b =
        (group_type << 12) | version_bit | 0x0400 | (PROGRAM_TYPE << 5) | (low_bits & 0x1f);
    [
        PI,
        block_b,
        if version == GroupVersion::B {
            PI
        } else {
            block_c
        },
        block_d,
    ]
}

fn clock_time_group(
    modified_julian_day: u32,
    hour: u16,
    minute: u16,
    local_offset_minutes: i16,
) -> [u16; 4] {
    let block_b_low = (modified_julian_day >> 15) as u16;
    let block_c = ((modified_julian_day as u16 & 0x7fff) << 1) | (hour >> 4);
    let offset_half_hours = local_offset_minutes.unsigned_abs() / 30;
    let offset_sign = u16::from(local_offset_minutes < 0) << 5;
    let block_d = ((hour & 0x0f) << 12) | (minute << 6) | offset_sign | offset_half_hours;
    information_group(4, GroupVersion::A, block_b_low, block_c, block_d)
}

fn advance(phase: f64, frequency_hz: f64, sample_rate_hz: f64) -> f64 {
    (phase + TAU * frequency_hz / sample_rate_hz).rem_euclid(TAU)
}

#[cfg(test)]
mod tests {
    use super::{SyntheticFmRdsGenerator, synthetic_group_words};
    use crate::rds::{GroupType, decode_group};

    #[test]
    fn synthetic_stream_contains_valid_metadata_and_application_groups() {
        let groups: Vec<_> = synthetic_group_words()
            .into_iter()
            .map(|words| decode_group(words).unwrap())
            .collect();

        assert!(
            groups
                .iter()
                .filter(|group| group.group_type == GroupType::G0A)
                .count()
                >= 8
        );
        assert!(
            groups
                .iter()
                .any(|group| group.group_type == GroupType::G2A)
        );
        assert!(
            groups
                .iter()
                .any(|group| group.group_type == GroupType::G3A)
        );
        assert!(
            groups
                .iter()
                .any(|group| group.group_type == GroupType::G4A)
        );
        assert!(
            groups
                .iter()
                .any(|group| group.group_type == GroupType::G8A)
        );
        assert!(
            groups
                .iter()
                .any(|group| group.group_type == GroupType::G10A)
        );
        assert!(
            groups
                .iter()
                .any(|group| group.group_type == GroupType::G14A)
        );
    }

    #[test]
    fn fm_generator_is_continuous_across_calls_and_reset_is_deterministic() {
        let mut blocked = SyntheticFmRdsGenerator::new();
        let mut continuous = SyntheticFmRdsGenerator::new();
        let mut reset = SyntheticFmRdsGenerator::new();
        let mut blocked_samples = Vec::new();
        for _ in 0..257 {
            blocked_samples.push(blocked.sample(1_000_000.0, 100_000.0, 0.25));
        }
        for _ in 0..257 {
            blocked_samples.push(blocked.sample(1_000_000.0, 100_000.0, 0.25));
        }
        let continuous_samples: Vec<_> = (0..514)
            .map(|_| continuous.sample(1_000_000.0, 100_000.0, 0.25))
            .collect();

        assert_eq!(blocked_samples, continuous_samples);
        for _ in 0..123 {
            let _ = reset.sample(1_000_000.0, 100_000.0, 0.25);
        }
        reset.reset();
        assert_eq!(
            reset.sample(1_000_000.0, 100_000.0, 0.25),
            SyntheticFmRdsGenerator::new().sample(1_000_000.0, 100_000.0, 0.25)
        );
    }
}
