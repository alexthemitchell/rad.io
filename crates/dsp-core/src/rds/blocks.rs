use thiserror::Error;

const GENERATOR_POLYNOMIAL: u32 = 0x5b9;
const CHECKWORD_BITS: u32 = 10;
const BLOCK_BITS: u32 = 26;
const BLOCK_MASK: u32 = (1 << BLOCK_BITS) - 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockKind {
    A,
    B,
    C,
    CPrime,
    D,
}

impl BlockKind {
    #[must_use]
    pub const fn offset_word(self) -> u16 {
        match self {
            Self::A => 0x0fc,
            Self::B => 0x198,
            Self::C => 0x168,
            Self::CPrime => 0x350,
            Self::D => 0x1b4,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DecodedBlock {
    pub information: u16,
    pub kind: BlockKind,
    pub corrected_bits: u8,
}

#[derive(Debug, Clone, Copy, Error, PartialEq, Eq)]
pub enum BlockDecodeError {
    #[error("RDS block exceeds 26 bits")]
    OutOfRange,
    #[error("RDS block does not match the expected offset word")]
    InvalidSyndrome,
    #[error("RDS block has more than one possible single-bit correction")]
    AmbiguousCorrection,
}

#[must_use]
pub fn encode_block(information: u16, kind: BlockKind) -> u32 {
    let payload = u32::from(information) << CHECKWORD_BITS;
    let checkword = polynomial_remainder(payload) ^ u32::from(kind.offset_word());
    payload | checkword
}

pub fn decode_block(word: u32, expected: BlockKind) -> Result<DecodedBlock, BlockDecodeError> {
    if word & !BLOCK_MASK != 0 {
        return Err(BlockDecodeError::OutOfRange);
    }
    if polynomial_remainder(word) == u32::from(expected.offset_word()) {
        return Ok(decoded(word, expected, 0));
    }

    let mut correction = None;
    for bit in 0..BLOCK_BITS {
        let candidate = word ^ (1 << bit);
        if polynomial_remainder(candidate) != u32::from(expected.offset_word()) {
            continue;
        }
        if correction.is_some() {
            return Err(BlockDecodeError::AmbiguousCorrection);
        }
        correction = Some(candidate);
    }

    correction
        .map(|corrected| decoded(corrected, expected, 1))
        .ok_or(BlockDecodeError::InvalidSyndrome)
}

fn decoded(word: u32, kind: BlockKind, corrected_bits: u8) -> DecodedBlock {
    DecodedBlock {
        information: (word >> CHECKWORD_BITS) as u16,
        kind,
        corrected_bits,
    }
}

fn polynomial_remainder(mut word: u32) -> u32 {
    for bit in (CHECKWORD_BITS..BLOCK_BITS).rev() {
        if word & (1 << bit) != 0 {
            word ^= GENERATOR_POLYNOMIAL << (bit - CHECKWORD_BITS);
        }
    }
    word & ((1 << CHECKWORD_BITS) - 1)
}

pub(crate) fn decode_block_exact(
    word: u32,
    expected: BlockKind,
) -> Result<DecodedBlock, BlockDecodeError> {
    if word & !BLOCK_MASK != 0 {
        return Err(BlockDecodeError::OutOfRange);
    }
    if polynomial_remainder(word) != u32::from(expected.offset_word()) {
        return Err(BlockDecodeError::InvalidSyndrome);
    }
    Ok(decoded(word, expected, 0))
}

#[cfg(test)]
mod tests {
    use super::{BlockDecodeError, BlockKind, decode_block, encode_block};

    #[test]
    fn encodes_reference_offset_word_vectors() {
        let vectors = [
            (BlockKind::A, 0x048_d06a),
            (BlockKind::B, 0x048_d10e),
            (BlockKind::C, 0x048_d1fe),
            (BlockKind::CPrime, 0x048_d3c6),
            (BlockKind::D, 0x048_d122),
        ];

        for (kind, expected) in vectors {
            assert_eq!(encode_block(0x1234, kind), expected);
            assert_eq!(decode_block(expected, kind).unwrap().information, 0x1234);
        }
    }

    #[test]
    fn corrects_one_bit_after_block_position_is_known() {
        let encoded = encode_block(0x54a1, BlockKind::A);

        for bit in 0..26 {
            let decoded = decode_block(encoded ^ (1 << bit), BlockKind::A).unwrap();
            assert_eq!(decoded.information, 0x54a1);
            assert_eq!(decoded.corrected_bits, 1);
        }
    }

    #[test]
    fn rejects_uncorrectable_and_out_of_range_blocks() {
        let encoded = encode_block(0x54a1, BlockKind::A);

        assert_eq!(
            decode_block(encoded ^ 0b11, BlockKind::A),
            Err(BlockDecodeError::InvalidSyndrome)
        );
        assert_eq!(
            decode_block(encoded | (1 << 26), BlockKind::A),
            Err(BlockDecodeError::OutOfRange)
        );
    }
}
