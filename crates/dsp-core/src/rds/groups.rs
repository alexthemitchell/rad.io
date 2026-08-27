use serde::Serialize;
use thiserror::Error;

use super::blocks::{BlockDecodeError, BlockKind, DecodedBlock, decode_block, encode_block};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum GroupVersion {
    A,
    B,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum GroupType {
    G0A,
    G0B,
    G1A,
    G1B,
    G2A,
    G2B,
    G3A,
    G3B,
    G4A,
    G4B,
    G5A,
    G5B,
    G6A,
    G6B,
    G7A,
    G7B,
    G8A,
    G8B,
    G9A,
    G9B,
    G10A,
    G10B,
    G11A,
    G11B,
    G12A,
    G12B,
    G13A,
    G13B,
    G14A,
    G14B,
    G15A,
    G15B,
}

impl GroupType {
    #[must_use]
    pub fn from_code(group_type: u8, version: GroupVersion) -> Self {
        match (group_type, version) {
            (0, GroupVersion::A) => Self::G0A,
            (0, GroupVersion::B) => Self::G0B,
            (1, GroupVersion::A) => Self::G1A,
            (1, GroupVersion::B) => Self::G1B,
            (2, GroupVersion::A) => Self::G2A,
            (2, GroupVersion::B) => Self::G2B,
            (3, GroupVersion::A) => Self::G3A,
            (3, GroupVersion::B) => Self::G3B,
            (4, GroupVersion::A) => Self::G4A,
            (4, GroupVersion::B) => Self::G4B,
            (5, GroupVersion::A) => Self::G5A,
            (5, GroupVersion::B) => Self::G5B,
            (6, GroupVersion::A) => Self::G6A,
            (6, GroupVersion::B) => Self::G6B,
            (7, GroupVersion::A) => Self::G7A,
            (7, GroupVersion::B) => Self::G7B,
            (8, GroupVersion::A) => Self::G8A,
            (8, GroupVersion::B) => Self::G8B,
            (9, GroupVersion::A) => Self::G9A,
            (9, GroupVersion::B) => Self::G9B,
            (10, GroupVersion::A) => Self::G10A,
            (10, GroupVersion::B) => Self::G10B,
            (11, GroupVersion::A) => Self::G11A,
            (11, GroupVersion::B) => Self::G11B,
            (12, GroupVersion::A) => Self::G12A,
            (12, GroupVersion::B) => Self::G12B,
            (13, GroupVersion::A) => Self::G13A,
            (13, GroupVersion::B) => Self::G13B,
            (14, GroupVersion::A) => Self::G14A,
            (14, GroupVersion::B) => Self::G14B,
            (15, GroupVersion::A) => Self::G15A,
            (15, GroupVersion::B) => Self::G15B,
            _ => unreachable!("RDS group type is four bits"),
        }
    }

    #[must_use]
    pub const fn code(self) -> u8 {
        (self as u8) / 2
    }

    #[must_use]
    pub const fn version(self) -> GroupVersion {
        if (self as u8) & 1 == 0 {
            GroupVersion::A
        } else {
            GroupVersion::B
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RdsGroup {
    pub group_type: GroupType,
    pub pi: u16,
    pub traffic_program: bool,
    pub program_type: u8,
    pub blocks: [DecodedBlock; 4],
}

impl RdsGroup {
    #[must_use]
    pub fn information(&self) -> [u16; 4] {
        self.blocks.map(|block| block.information)
    }

    #[must_use]
    pub fn corrected_blocks(&self) -> u8 {
        self.blocks.iter().map(|block| block.corrected_bits).sum()
    }
}

#[derive(Debug, Clone, Copy, Error, PartialEq, Eq)]
pub enum GroupDecodeError {
    #[error("RDS group block {index} is invalid: {source}")]
    InvalidBlock {
        index: usize,
        source: BlockDecodeError,
    },
    #[error("version-B RDS group does not repeat PI in block C-prime")]
    PiMismatch,
}

pub fn decode_group(words: [u32; 4]) -> Result<RdsGroup, GroupDecodeError> {
    let block_a = decode_at(words[0], BlockKind::A, 0)?;
    let block_b = decode_at(words[1], BlockKind::B, 1)?;
    let version = if block_b.information & 0x0800 == 0 {
        GroupVersion::A
    } else {
        GroupVersion::B
    };
    let block_c = decode_at(
        words[2],
        match version {
            GroupVersion::A => BlockKind::C,
            GroupVersion::B => BlockKind::CPrime,
        },
        2,
    )?;
    let block_d = decode_at(words[3], BlockKind::D, 3)?;
    if version == GroupVersion::B && block_c.information != block_a.information {
        return Err(GroupDecodeError::PiMismatch);
    }

    let group_code = ((block_b.information >> 12) & 0x0f) as u8;
    Ok(RdsGroup {
        group_type: GroupType::from_code(group_code, version),
        pi: block_a.information,
        traffic_program: block_b.information & 0x0400 != 0,
        program_type: ((block_b.information >> 5) & 0x1f) as u8,
        blocks: [block_a, block_b, block_c, block_d],
    })
}

#[must_use]
pub fn encode_group(information: [u16; 4]) -> [u32; 4] {
    let version = if information[1] & 0x0800 == 0 {
        GroupVersion::A
    } else {
        GroupVersion::B
    };
    [
        encode_block(information[0], BlockKind::A),
        encode_block(information[1], BlockKind::B),
        encode_block(
            information[2],
            match version {
                GroupVersion::A => BlockKind::C,
                GroupVersion::B => BlockKind::CPrime,
            },
        ),
        encode_block(information[3], BlockKind::D),
    ]
}

fn decode_at(
    word: u32,
    expected: BlockKind,
    index: usize,
) -> Result<DecodedBlock, GroupDecodeError> {
    decode_block(word, expected).map_err(|source| GroupDecodeError::InvalidBlock { index, source })
}

#[cfg(test)]
mod tests {
    use super::{GroupDecodeError, GroupType, GroupVersion, decode_group, encode_group};

    #[test]
    fn decodes_every_group_type_and_version() {
        for code in 0_u16..16 {
            for version in [GroupVersion::A, GroupVersion::B] {
                let version_bit = u16::from(version == GroupVersion::B) << 11;
                let block_b = (code << 12) | version_bit | 0x0420;
                let block_c = if version == GroupVersion::B {
                    0x54a1
                } else {
                    0x4567
                };
                let information = [0x54a1, block_b, block_c, 0x89ab];

                let decoded = decode_group(encode_group(information)).unwrap();

                assert_eq!(
                    decoded.group_type,
                    GroupType::from_code(code as u8, version)
                );
                assert_eq!(decoded.information(), information);
                assert!(decoded.traffic_program);
                assert_eq!(decoded.program_type, 1);
                assert_eq!(decoded.corrected_blocks(), 0);
            }
        }
    }

    #[test]
    fn applies_single_bit_correction_to_a_group() {
        let information = [0x54a1, 0x043e, 0xe0e1, 0x5241];
        let mut encoded = encode_group(information);
        encoded[3] ^= 1 << 17;

        let decoded = decode_group(encoded).unwrap();

        assert_eq!(decoded.group_type, GroupType::G0A);
        assert_eq!(decoded.information(), information);
        assert_eq!(decoded.corrected_blocks(), 1);
    }

    #[test]
    fn rejects_a_version_b_group_with_a_different_repeated_pi() {
        let information = [0x54a1, 0x2800, 0x1234, 0x5241];

        assert_eq!(
            decode_group(encode_group(information)),
            Err(GroupDecodeError::PiMismatch)
        );
    }
}
