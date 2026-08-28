use std::collections::VecDeque;

use serde::Serialize;

use super::{GroupType, GroupVersion, RdsGroup};

const RAW_GROUP_LIMIT: usize = 64;
const APPLICATION_RECORD_LIMIT: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimedValue<T> {
    pub value: T,
    pub updated_at_us: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextValue {
    pub value: String,
    pub complete: bool,
    pub updated_at_us: u64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecoderInfo {
    pub stereo: bool,
    pub artificial_head: bool,
    pub compressed: bool,
    pub dynamic_pty: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlternativeFrequencies {
    pub frequencies_hz: Vec<u32>,
    pub expected_count: Option<u8>,
    pub complete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClockTime {
    pub iso_utc: String,
    pub local_offset_minutes: i16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OdaRegistration {
    pub application_group_type: u8,
    pub application_group_version: GroupVersion,
    pub application_id: u16,
    pub message_bits: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TmcEnvelope {
    pub variant_code: u8,
    pub block_c: u16,
    pub block_d: u16,
    pub received_at_us: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EonEnvelope {
    pub group_type: u8,
    pub version: GroupVersion,
    pub variant_code: u8,
    pub information: u16,
    pub other_network_pi: u16,
    pub received_at_us: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawGroup {
    pub group_type: u8,
    pub version: GroupVersion,
    pub blocks: [u16; 4],
    pub corrected_blocks: u8,
    pub application_id: Option<u16>,
    pub received_at_us: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RdsMetadata {
    pub pi: Option<TimedValue<u16>>,
    pub call_sign: Option<TimedValue<String>>,
    pub ps: Option<TextValue>,
    pub pty: Option<TimedValue<u8>>,
    pub pty_name: Option<TimedValue<&'static str>>,
    pub ptyn: Option<TextValue>,
    pub traffic_program: Option<TimedValue<bool>>,
    pub traffic_announcement: Option<TimedValue<bool>>,
    pub music_speech: Option<TimedValue<bool>>,
    pub decoder_info: Option<TimedValue<DecoderInfo>>,
    pub alternative_frequencies: Option<TimedValue<AlternativeFrequencies>>,
    pub extended_country_code: Option<TimedValue<u8>>,
    pub program_item_number: Option<TimedValue<u16>>,
    pub radio_text: Option<TextValue>,
    pub clock_time: Option<TimedValue<ClockTime>>,
    pub oda_registrations: Vec<TimedValue<OdaRegistration>>,
    pub tmc_messages: VecDeque<TmcEnvelope>,
    pub eon_records: VecDeque<EonEnvelope>,
    pub raw_groups: VecDeque<RawGroup>,
    pub groups_by_type: [u64; 32],
    pub last_valid_group_at_us: Option<u64>,
}

impl Default for RdsMetadata {
    fn default() -> Self {
        Self {
            pi: None,
            call_sign: None,
            ps: None,
            pty: None,
            pty_name: None,
            ptyn: None,
            traffic_program: None,
            traffic_announcement: None,
            music_speech: None,
            decoder_info: None,
            alternative_frequencies: None,
            extended_country_code: None,
            program_item_number: None,
            radio_text: None,
            clock_time: None,
            oda_registrations: Vec::new(),
            tmc_messages: VecDeque::with_capacity(APPLICATION_RECORD_LIMIT),
            eon_records: VecDeque::with_capacity(APPLICATION_RECORD_LIMIT),
            raw_groups: VecDeque::with_capacity(RAW_GROUP_LIMIT),
            groups_by_type: [0; 32],
            last_valid_group_at_us: None,
        }
    }
}

pub struct MetadataAccumulator {
    metadata: RdsMetadata,
    ps: StableTextAccumulator,
    ptyn: StableTextAccumulator,
    radio_text: TextAccumulator,
    radio_text_ab: Option<bool>,
    radio_text_version: Option<GroupVersion>,
    ptyn_ab: Option<bool>,
    decoder_info: DecoderInfoAccumulator,
    alternative_frequencies: AlternativeFrequencyAccumulator,
}

impl MetadataAccumulator {
    #[must_use]
    pub fn new() -> Self {
        Self {
            metadata: RdsMetadata::default(),
            ps: StableTextAccumulator::new(4, 2),
            ptyn: StableTextAccumulator::new(2, 4),
            radio_text: TextAccumulator::new(16, 4),
            radio_text_ab: None,
            radio_text_version: None,
            ptyn_ab: None,
            decoder_info: DecoderInfoAccumulator::default(),
            alternative_frequencies: AlternativeFrequencyAccumulator::default(),
        }
    }

    pub fn process(&mut self, group: &RdsGroup, received_at_us: u64) {
        if self.metadata.pi.as_ref().map(|value| value.value) != Some(group.pi) {
            self.reset_station();
        }
        update(&mut self.metadata.pi, group.pi, received_at_us);
        if let Some(call_sign) = rbds_call_sign(group.pi) {
            update(&mut self.metadata.call_sign, call_sign, received_at_us);
        }
        update(
            &mut self.metadata.traffic_program,
            group.traffic_program,
            received_at_us,
        );
        update(&mut self.metadata.pty, group.program_type, received_at_us);
        update(
            &mut self.metadata.pty_name,
            rbds_program_type_name(group.program_type),
            received_at_us,
        );
        self.metadata.last_valid_group_at_us = Some(received_at_us);
        let group_index = group.group_type as usize;
        self.metadata.groups_by_type[group_index] =
            self.metadata.groups_by_type[group_index].saturating_add(1);

        let blocks = group.information();
        match group.group_type {
            GroupType::G0A | GroupType::G0B => {
                self.process_group_zero(group.group_type, blocks, received_at_us);
            }
            GroupType::G1A | GroupType::G1B => {
                self.process_group_one(group.group_type, blocks, received_at_us);
            }
            GroupType::G2A | GroupType::G2B => {
                self.process_radio_text(group.group_type, blocks, received_at_us);
            }
            GroupType::G3A => self.process_oda_registration(blocks, received_at_us),
            GroupType::G4A => {
                if let Some(clock_time) = decode_clock_time(blocks) {
                    update(&mut self.metadata.clock_time, clock_time, received_at_us);
                }
            }
            GroupType::G8A => push_bounded(
                &mut self.metadata.tmc_messages,
                TmcEnvelope {
                    variant_code: (blocks[1] & 0x1f) as u8,
                    block_c: blocks[2],
                    block_d: blocks[3],
                    received_at_us,
                },
                APPLICATION_RECORD_LIMIT,
            ),
            GroupType::G10A => self.process_ptyn(blocks, received_at_us),
            GroupType::G14A | GroupType::G14B => push_bounded(
                &mut self.metadata.eon_records,
                EonEnvelope {
                    group_type: group.group_type.code(),
                    version: group.group_type.version(),
                    variant_code: (blocks[1] & 0x0f) as u8,
                    information: blocks[2],
                    other_network_pi: blocks[3],
                    received_at_us,
                },
                APPLICATION_RECORD_LIMIT,
            ),
            _ => {}
        }

        let application_id = self.application_id_for(group.group_type);
        push_bounded(
            &mut self.metadata.raw_groups,
            RawGroup {
                group_type: group.group_type.code(),
                version: group.group_type.version(),
                blocks,
                corrected_blocks: group.corrected_blocks(),
                application_id,
                received_at_us,
            },
            RAW_GROUP_LIMIT,
        );
    }

    #[must_use]
    pub const fn metadata(&self) -> &RdsMetadata {
        &self.metadata
    }

    pub fn reset(&mut self) {
        self.metadata = RdsMetadata::default();
        self.reset_accumulators();
    }

    fn reset_station(&mut self) {
        self.metadata = RdsMetadata::default();
        self.reset_accumulators();
    }

    fn reset_accumulators(&mut self) {
        self.ps.reset();
        self.ptyn.reset();
        self.radio_text = TextAccumulator::new(16, 4);
        self.radio_text_ab = None;
        self.radio_text_version = None;
        self.ptyn_ab = None;
        self.decoder_info = DecoderInfoAccumulator::default();
        self.alternative_frequencies = AlternativeFrequencyAccumulator::default();
    }

    fn process_group_zero(&mut self, group_type: GroupType, blocks: [u16; 4], received_at_us: u64) {
        let segment = (blocks[1] & 0x03) as usize;
        let characters = blocks[3].to_be_bytes();
        if let Some(ps) = self.ps.push(segment, &characters) {
            self.metadata.ps = Some(TextValue {
                value: ps,
                complete: true,
                updated_at_us: received_at_us,
            });
        }
        update(
            &mut self.metadata.traffic_announcement,
            blocks[1] & 0x10 != 0,
            received_at_us,
        );
        update(
            &mut self.metadata.music_speech,
            blocks[1] & 0x08 != 0,
            received_at_us,
        );
        if let Some(decoder_info) = self.decoder_info.push(segment, blocks[1] & 0x04 != 0) {
            update(
                &mut self.metadata.decoder_info,
                decoder_info,
                received_at_us,
            );
        }
        if group_type == GroupType::G0A {
            for code in blocks[2].to_be_bytes() {
                self.alternative_frequencies.push(code);
            }
            if let Some(value) = self.alternative_frequencies.snapshot()
                && (value.complete || self.metadata.alternative_frequencies.is_none())
            {
                update(
                    &mut self.metadata.alternative_frequencies,
                    value,
                    received_at_us,
                );
            }
        }
    }

    fn process_group_one(&mut self, group_type: GroupType, blocks: [u16; 4], received_at_us: u64) {
        update(
            &mut self.metadata.program_item_number,
            blocks[3],
            received_at_us,
        );
        if group_type == GroupType::G1A && (blocks[2] >> 12) & 0x07 == 0 {
            update(
                &mut self.metadata.extended_country_code,
                (blocks[2] & 0xff) as u8,
                received_at_us,
            );
        }
    }

    fn process_radio_text(&mut self, group_type: GroupType, blocks: [u16; 4], received_at_us: u64) {
        let version = group_type.version();
        let text_ab = blocks[1] & 0x10 != 0;
        if self.radio_text_ab != Some(text_ab) || self.radio_text_version != Some(version) {
            let width = if version == GroupVersion::A { 4 } else { 2 };
            self.radio_text = TextAccumulator::new(16, width);
            self.radio_text_ab = Some(text_ab);
            self.radio_text_version = Some(version);
            self.metadata.radio_text = None;
        }
        let segment = (blocks[1] & 0x0f) as usize;
        let bytes = match version {
            GroupVersion::A => {
                let [c0, c1] = blocks[2].to_be_bytes();
                let [d0, d1] = blocks[3].to_be_bytes();
                vec![c0, c1, d0, d1]
            }
            GroupVersion::B => blocks[3].to_be_bytes().to_vec(),
        };
        if let Some(text) = self.radio_text.push(segment, &bytes) {
            self.metadata.radio_text = Some(TextValue {
                value: text,
                complete: true,
                updated_at_us: received_at_us,
            });
        }
    }

    fn process_ptyn(&mut self, blocks: [u16; 4], received_at_us: u64) {
        let text_ab = blocks[1] & 0x10 != 0;
        if self.ptyn_ab != Some(text_ab) {
            self.ptyn.reset();
            self.ptyn_ab = Some(text_ab);
            self.metadata.ptyn = None;
        }
        let segment = (blocks[1] & 0x01) as usize;
        let [c0, c1] = blocks[2].to_be_bytes();
        let [d0, d1] = blocks[3].to_be_bytes();
        if let Some(text) = self.ptyn.push(segment, &[c0, c1, d0, d1]) {
            self.metadata.ptyn = Some(TextValue {
                value: text,
                complete: true,
                updated_at_us: received_at_us,
            });
        }
    }

    fn process_oda_registration(&mut self, blocks: [u16; 4], received_at_us: u64) {
        let application_code = (blocks[1] & 0x1f) as u8;
        let registration = OdaRegistration {
            application_group_type: application_code >> 1,
            application_group_version: if application_code & 1 == 0 {
                GroupVersion::A
            } else {
                GroupVersion::B
            },
            application_id: blocks[3],
            message_bits: blocks[2],
        };
        if let Some(existing) = self.metadata.oda_registrations.iter_mut().find(|entry| {
            entry.value.application_group_type == registration.application_group_type
                && entry.value.application_group_version == registration.application_group_version
        }) {
            *existing = TimedValue {
                value: registration,
                updated_at_us: received_at_us,
            };
        } else {
            if self.metadata.oda_registrations.len() == APPLICATION_RECORD_LIMIT {
                self.metadata.oda_registrations.remove(0);
            }
            self.metadata.oda_registrations.push(TimedValue {
                value: registration,
                updated_at_us: received_at_us,
            });
        }
    }

    fn application_id_for(&self, group_type: GroupType) -> Option<u16> {
        self.metadata
            .oda_registrations
            .iter()
            .find(|entry| {
                entry.value.application_group_type == group_type.code()
                    && entry.value.application_group_version == group_type.version()
            })
            .map(|entry| entry.value.application_id)
    }
}

impl Default for MetadataAccumulator {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Default)]
struct DecoderInfoAccumulator {
    value: DecoderInfo,
    seen: u8,
}

impl DecoderInfoAccumulator {
    fn push(&mut self, segment: usize, enabled: bool) -> Option<DecoderInfo> {
        match segment {
            0 => self.value.dynamic_pty = enabled,
            1 => self.value.compressed = enabled,
            2 => self.value.artificial_head = enabled,
            3 => self.value.stereo = enabled,
            _ => return None,
        }
        self.seen |= 1 << segment;
        (self.seen == 0x0f).then_some(self.value)
    }
}

#[derive(Default)]
struct AlternativeFrequencyAccumulator {
    frequencies_hz: Vec<u32>,
    expected_count: Option<u8>,
}

impl AlternativeFrequencyAccumulator {
    fn push(&mut self, code: u8) {
        match code {
            1..=204 => {
                let frequency_hz = 87_500_000 + u32::from(code) * 100_000;
                if !self.frequencies_hz.contains(&frequency_hz) {
                    self.frequencies_hz.push(frequency_hz);
                    self.frequencies_hz.sort_unstable();
                }
            }
            224..=249 => {
                self.expected_count = Some(code - 224);
                self.frequencies_hz.clear();
            }
            _ => {}
        }
    }

    fn snapshot(&self) -> Option<AlternativeFrequencies> {
        if self.expected_count.is_none() && self.frequencies_hz.is_empty() {
            return None;
        }
        Some(AlternativeFrequencies {
            frequencies_hz: self.frequencies_hz.clone(),
            expected_count: self.expected_count,
            complete: self
                .expected_count
                .is_some_and(|expected| self.frequencies_hz.len() >= usize::from(expected)),
        })
    }
}

struct StableTextAccumulator {
    segments: TextAccumulator,
    previous_complete: Option<String>,
}

impl StableTextAccumulator {
    fn new(segment_count: usize, segment_width: usize) -> Self {
        Self {
            segments: TextAccumulator::new(segment_count, segment_width),
            previous_complete: None,
        }
    }

    fn push(&mut self, segment: usize, bytes: &[u8]) -> Option<String> {
        let complete = self.segments.push(segment, bytes)?;
        if self.previous_complete.as_ref() == Some(&complete) {
            Some(complete)
        } else {
            self.previous_complete = Some(complete);
            None
        }
    }

    fn reset(&mut self) {
        self.segments.reset();
        self.previous_complete = None;
    }
}

struct TextAccumulator {
    bytes: Vec<u8>,
    segment_width: usize,
    complete_mask: u32,
    seen_mask: u32,
}

impl TextAccumulator {
    fn new(segment_count: usize, segment_width: usize) -> Self {
        Self {
            bytes: vec![b' '; segment_count * segment_width],
            segment_width,
            complete_mask: (1 << segment_count) - 1,
            seen_mask: 0,
        }
    }

    fn push(&mut self, segment: usize, bytes: &[u8]) -> Option<String> {
        if bytes.len() != self.segment_width || segment * self.segment_width >= self.bytes.len() {
            return None;
        }
        let start = segment * self.segment_width;
        self.bytes[start..start + self.segment_width].copy_from_slice(bytes);
        self.seen_mask |= 1 << segment;

        let terminator = self.bytes.iter().position(|byte| *byte == 0x0d);
        let required_mask = terminator.map_or(self.complete_mask, |position| {
            (1 << (position / self.segment_width + 1)) - 1
        });
        if self.seen_mask & required_mask != required_mask {
            return None;
        }

        let end = terminator.unwrap_or(self.bytes.len());
        let text = decode_text(&self.bytes[..end]);
        self.seen_mask = 0;
        Some(text)
    }

    fn reset(&mut self) {
        self.bytes.fill(b' ');
        self.seen_mask = 0;
    }
}

fn decode_text(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| match byte {
            0x00 => ' ',
            0x20..=0x7e => char::from(*byte),
            _ => '\u{fffd}',
        })
        .collect::<String>()
        .trim_end()
        .to_owned()
}

fn decode_clock_time(blocks: [u16; 4]) -> Option<ClockTime> {
    let modified_julian_day = (u32::from(blocks[1] & 0x03) << 15) | u32::from(blocks[2] >> 1);
    let hour = u32::from((blocks[2] & 0x01) << 4) | u32::from(blocks[3] >> 12);
    let minute = u32::from((blocks[3] >> 6) & 0x3f);
    if hour > 23 || minute > 59 {
        return None;
    }
    let offset_half_hours = i16::try_from(blocks[3] & 0x1f).ok()?;
    let offset_sign = if blocks[3] & 0x20 == 0 { 1 } else { -1 };
    let (year, month, day) = civil_date_from_days(i64::from(modified_julian_day) - 40_587);
    Some(ClockTime {
        iso_utc: format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:00Z"),
        local_offset_minutes: offset_sign * offset_half_hours * 30,
    })
}

fn civil_date_from_days(days_since_unix_epoch: i64) -> (i64, i64, i64) {
    let shifted = days_since_unix_epoch + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

fn update<T>(slot: &mut Option<TimedValue<T>>, value: T, updated_at_us: u64) {
    *slot = Some(TimedValue {
        value,
        updated_at_us,
    });
}

fn push_bounded<T>(values: &mut VecDeque<T>, value: T, limit: usize) {
    if values.len() == limit {
        values.pop_front();
    }
    values.push_back(value);
}

#[must_use]
pub fn rbds_program_type_name(code: u8) -> &'static str {
    const NAMES: [&str; 32] = [
        "None",
        "News",
        "Information",
        "Sports",
        "Talk",
        "Rock",
        "Classic Rock",
        "Adult Hits",
        "Soft Rock",
        "Top 40",
        "Country",
        "Oldies",
        "Soft",
        "Nostalgia",
        "Jazz",
        "Classical",
        "Rhythm and Blues",
        "Soft Rhythm and Blues",
        "Foreign Language",
        "Religious Music",
        "Religious Talk",
        "Personality",
        "Public",
        "College",
        "Spanish Talk",
        "Spanish Music",
        "Hip Hop",
        "Unassigned",
        "Unassigned",
        "Weather",
        "Emergency Test",
        "Emergency",
    ];
    NAMES[code.min(31) as usize]
}

#[must_use]
pub fn rbds_call_sign(pi: u16) -> Option<String> {
    const LETTER_COMBINATIONS: u32 = 26 * 26 * 26;
    if !(0x1000..=0x994f).contains(&pi) {
        return None;
    }
    let mut ordinal = u32::from(pi - 0x1000);
    let prefix = if ordinal < LETTER_COMBINATIONS {
        'K'
    } else {
        ordinal -= LETTER_COMBINATIONS;
        'W'
    };
    let first = char::from(b'A' + (ordinal / (26 * 26)) as u8);
    let second = char::from(b'A' + ((ordinal / 26) % 26) as u8);
    let third = char::from(b'A' + (ordinal % 26) as u8);
    Some(format!("{prefix}{first}{second}{third}"))
}

#[cfg(test)]
mod tests {
    use super::{MetadataAccumulator, RAW_GROUP_LIMIT, rbds_call_sign};
    use crate::rds::{GroupType, GroupVersion, decode_group, encode_group};

    fn group(
        group_type: u8,
        version: GroupVersion,
        pi: u16,
        low_bits: u16,
        block_c: u16,
        block_d: u16,
    ) -> crate::rds::RdsGroup {
        let version_bit = u16::from(version == GroupVersion::B) << 11;
        let block_b = (u16::from(group_type) << 12) | version_bit | 0x0420 | low_bits;
        let block_c = if version == GroupVersion::B {
            pi
        } else {
            block_c
        };
        decode_group(encode_group([pi, block_b, block_c, block_d])).unwrap()
    }

    #[test]
    fn commits_program_service_after_two_matching_complete_cycles() {
        let mut accumulator = MetadataAccumulator::new();
        let segments = [0x5241, 0x442e, 0x494f, 0x2020];
        let alternative_frequencies = [0xe201, 0x02cd, 0xcdcd, 0xcdcd];

        for cycle in 0..2 {
            for (segment, characters) in segments.into_iter().enumerate() {
                accumulator.process(
                    &group(
                        0,
                        GroupVersion::A,
                        0x54a1,
                        segment as u16,
                        alternative_frequencies[segment],
                        characters,
                    ),
                    cycle * 10_000 + segment as u64,
                );
            }
            if cycle == 0 {
                assert!(accumulator.metadata().ps.is_none());
            }
        }

        assert_eq!(
            accumulator
                .metadata()
                .ps
                .as_ref()
                .map(|value| value.value.as_str()),
            Some("RAD.IO")
        );
        assert_eq!(
            accumulator
                .metadata()
                .alternative_frequencies
                .as_ref()
                .map(|value| value.value.frequencies_hz.as_slice()),
            Some([87_600_000, 87_700_000].as_slice())
        );
    }

    #[test]
    fn retains_complete_alternative_frequencies_during_the_next_cycle() {
        let mut accumulator = MetadataAccumulator::new();
        accumulator.process(&group(0, GroupVersion::A, 0x54a1, 0, 0xe201, 0x5241), 1);
        accumulator.process(&group(0, GroupVersion::A, 0x54a1, 1, 0x02cd, 0x442e), 2);
        assert_eq!(
            accumulator
                .metadata()
                .alternative_frequencies
                .as_ref()
                .map(|value| value.value.frequencies_hz.as_slice()),
            Some([87_600_000, 87_700_000].as_slice())
        );

        accumulator.process(&group(0, GroupVersion::A, 0x54a1, 0, 0xe201, 0x5241), 3);

        assert_eq!(
            accumulator
                .metadata()
                .alternative_frequencies
                .as_ref()
                .map(|value| value.value.frequencies_hz.as_slice()),
            Some([87_600_000, 87_700_000].as_slice())
        );
    }

    #[test]
    fn assembles_radio_text_and_clears_it_when_the_ab_flag_changes() {
        let mut accumulator = MetadataAccumulator::new();
        accumulator.process(&group(2, GroupVersion::A, 0x54a1, 0, 0x5241, 0x442e), 10);
        accumulator.process(&group(2, GroupVersion::A, 0x54a1, 1, 0x494f, 0x0d20), 20);

        assert_eq!(
            accumulator
                .metadata()
                .radio_text
                .as_ref()
                .map(|value| value.value.as_str()),
            Some("RAD.IO")
        );

        accumulator.process(&group(2, GroupVersion::A, 0x54a1, 0x10, 0x4e45, 0x5720), 30);
        assert!(accumulator.metadata().radio_text.is_none());
    }

    #[test]
    fn decodes_nul_padded_program_type_name() {
        let mut accumulator = MetadataAccumulator::new();

        for cycle in 0..2 {
            accumulator.process(
                &group(10, GroupVersion::A, 0x187f, 0, 0x4879, 0x6d6e),
                cycle * 10 + 1,
            );
            accumulator.process(
                &group(10, GroupVersion::A, 0x187f, 1, 0x7300, 0x0000),
                cycle * 10 + 2,
            );
        }

        assert_eq!(
            accumulator
                .metadata()
                .ptyn
                .as_ref()
                .map(|value| value.value.as_str()),
            Some("Hymns")
        );
    }

    #[test]
    fn decodes_clock_time_and_local_offset() {
        let modified_julian_day = 40_587_u32;
        let hour = 12_u16;
        let minute = 34_u16;
        let block_b_low = (modified_julian_day >> 15) as u16;
        let block_c = ((modified_julian_day as u16 & 0x7fff) << 1) | (hour >> 4);
        let block_d = ((hour & 0x0f) << 12) | (minute << 6) | 0x20 | 10;
        let mut accumulator = MetadataAccumulator::new();

        accumulator.process(
            &group(4, GroupVersion::A, 0x54a1, block_b_low, block_c, block_d),
            100,
        );

        let clock = &accumulator.metadata().clock_time.as_ref().unwrap().value;
        assert_eq!(clock.iso_utc, "1970-01-01T12:34:00Z");
        assert_eq!(clock.local_offset_minutes, -300);
    }

    #[test]
    fn associates_registered_oda_groups_and_bounds_raw_history() {
        let mut accumulator = MetadataAccumulator::new();
        accumulator.process(&group(3, GroupVersion::A, 0x54a1, 0x11, 0xabcd, 0xcd46), 1);
        accumulator.process(&group(8, GroupVersion::B, 0x54a1, 0, 0, 0x1234), 2);

        assert_eq!(
            accumulator
                .metadata()
                .raw_groups
                .back()
                .unwrap()
                .application_id,
            Some(0xcd46)
        );

        for timestamp in 3..(RAW_GROUP_LIMIT as u64 + 20) {
            accumulator.process(
                &group(15, GroupVersion::A, 0x54a1, 0, 0x1234, 0x5678),
                timestamp,
            );
        }
        assert_eq!(accumulator.metadata().raw_groups.len(), RAW_GROUP_LIMIT);
        assert_eq!(
            accumulator.metadata().groups_by_type[GroupType::G15A as usize],
            RAW_GROUP_LIMIT as u64 + 17
        );
    }

    #[test]
    fn changing_pi_discards_metadata_from_the_previous_station() {
        let mut accumulator = MetadataAccumulator::new();
        accumulator.process(&group(8, GroupVersion::A, 0x54a1, 3, 0x1234, 0x5678), 1);
        accumulator.process(&group(0, GroupVersion::A, 0x1234, 0, 0xe0e1, 0x4e45), 2);

        assert_eq!(accumulator.metadata().pi.as_ref().unwrap().value, 0x1234);
        assert!(accumulator.metadata().tmc_messages.is_empty());
        assert_eq!(accumulator.metadata().raw_groups.len(), 1);
    }

    #[test]
    fn derives_standard_us_call_signs_from_pi_codes() {
        assert_eq!(rbds_call_sign(0x1000).as_deref(), Some("KAAA"));
        assert_eq!(rbds_call_sign(0x54a7).as_deref(), Some("KZZZ"));
        assert_eq!(rbds_call_sign(0x54a8).as_deref(), Some("WAAA"));
        assert_eq!(rbds_call_sign(0x994f).as_deref(), Some("WZZZ"));
        assert_eq!(rbds_call_sign(0x9950), None);
        assert_eq!(rbds_call_sign(0x0fff), None);
    }
}
