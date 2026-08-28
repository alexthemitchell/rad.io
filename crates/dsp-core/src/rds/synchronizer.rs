use serde::Serialize;

use super::{BlockKind, RdsGroup, blocks::decode_block_exact, decode_group};

const BLOCK_BITS: u8 = 26;
const BLOCK_MASK: u32 = (1 << BLOCK_BITS) - 1;
const BLOCKS_PER_GROUP: usize = 4;
const GROUPS_TO_LOCK: u8 = 2;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SynchronizerStats {
    pub synchronized: bool,
    pub valid_groups: u64,
    pub corrected_blocks: u64,
    pub rejected_groups: u64,
    pub lost_sync_count: u64,
}

pub struct RdsSynchronizer {
    shift_register: u32,
    collected_bits: u8,
    pending_words: Vec<u32>,
    aligned: bool,
    consecutive_groups: u8,
    stats: SynchronizerStats,
}

impl RdsSynchronizer {
    #[must_use]
    pub fn new() -> Self {
        Self {
            shift_register: 0,
            collected_bits: 0,
            pending_words: Vec::with_capacity(BLOCKS_PER_GROUP),
            aligned: false,
            consecutive_groups: 0,
            stats: SynchronizerStats::default(),
        }
    }

    pub fn push_bit(&mut self, bit: bool) -> Option<RdsGroup> {
        self.shift_register = ((self.shift_register << 1) | u32::from(bit)) & BLOCK_MASK;
        self.collected_bits = self.collected_bits.saturating_add(1).min(BLOCK_BITS);

        if !self.aligned && self.pending_words.is_empty() {
            if self.collected_bits < BLOCK_BITS
                || decode_block_exact(self.shift_register, BlockKind::A).is_err()
            {
                return None;
            }
            self.pending_words.push(self.shift_register);
            self.start_next_word();
            return None;
        }

        if self.collected_bits < BLOCK_BITS {
            return None;
        }
        self.pending_words.push(self.shift_register);
        self.start_next_word();
        if self.pending_words.len() < BLOCKS_PER_GROUP {
            return None;
        }

        let words = [
            self.pending_words[0],
            self.pending_words[1],
            self.pending_words[2],
            self.pending_words[3],
        ];
        self.pending_words.clear();
        match decode_group(words) {
            Ok(group) => {
                self.aligned = true;
                self.consecutive_groups = self.consecutive_groups.saturating_add(1);
                self.stats.valid_groups = self.stats.valid_groups.saturating_add(1);
                self.stats.corrected_blocks = self
                    .stats
                    .corrected_blocks
                    .saturating_add(u64::from(group.corrected_blocks()));
                self.stats.synchronized = self.consecutive_groups >= GROUPS_TO_LOCK;
                Some(group)
            }
            Err(_) => {
                self.stats.rejected_groups = self.stats.rejected_groups.saturating_add(1);
                if self.aligned || self.consecutive_groups > 0 {
                    self.stats.lost_sync_count = self.stats.lost_sync_count.saturating_add(1);
                }
                self.aligned = false;
                self.consecutive_groups = 0;
                self.stats.synchronized = false;
                None
            }
        }
    }

    pub fn push_bits(&mut self, bits: impl IntoIterator<Item = bool>) -> Vec<RdsGroup> {
        bits.into_iter()
            .filter_map(|bit| self.push_bit(bit))
            .collect()
    }

    #[must_use]
    pub const fn stats(&self) -> SynchronizerStats {
        self.stats
    }

    pub fn reset(&mut self) {
        self.shift_register = 0;
        self.collected_bits = 0;
        self.pending_words.clear();
        self.aligned = false;
        self.consecutive_groups = 0;
        self.stats = SynchronizerStats::default();
    }

    fn start_next_word(&mut self) {
        self.shift_register = 0;
        self.collected_bits = 0;
    }
}

impl Default for RdsSynchronizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::RdsSynchronizer;
    use crate::rds::{GroupType, encode_group};

    fn bits(words: [u32; 4]) -> Vec<bool> {
        words
            .into_iter()
            .flat_map(|word| (0..26).rev().map(move |bit| word & (1 << bit) != 0))
            .collect()
    }

    fn group(pi: u16, segment: u16) -> [u32; 4] {
        encode_group([pi, 0x043c | segment, 0xe0e1, 0x5241 + segment])
    }

    #[test]
    fn acquires_after_an_unaligned_prefix_and_locks_on_two_groups() {
        let mut synchronizer = RdsSynchronizer::new();
        let stream = [true, false, true, true, false]
            .into_iter()
            .chain(bits(group(0x54a1, 0)))
            .chain(bits(group(0x54a1, 1)));

        let decoded = synchronizer.push_bits(stream);

        assert_eq!(decoded.len(), 2);
        assert_eq!(decoded[0].group_type, GroupType::G0A);
        assert!(synchronizer.stats().synchronized);
    }

    #[test]
    fn preserves_partial_blocks_across_pushes() {
        let encoded = bits(group(0x54a1, 0));
        let mut synchronizer = RdsSynchronizer::new();

        assert!(
            synchronizer
                .push_bits(encoded[..37].iter().copied())
                .is_empty()
        );
        let decoded = synchronizer.push_bits(encoded[37..].iter().copied());

        assert_eq!(decoded.len(), 1);
        assert_eq!(decoded[0].pi, 0x54a1);
    }

    #[test]
    fn corrects_an_error_while_aligned_then_reacquires_after_a_bad_group() {
        let first = bits(group(0x54a1, 0));
        let mut corrected = bits(group(0x54a1, 1));
        corrected[26 + 7] = !corrected[26 + 7];
        let mut bad = bits(group(0x54a1, 2));
        bad[5] = !bad[5];
        bad[6] = !bad[6];
        let reacquired = bits(group(0x54a1, 3));
        let mut synchronizer = RdsSynchronizer::new();

        let decoded = synchronizer.push_bits(
            first
                .into_iter()
                .chain(corrected)
                .chain(bad)
                .chain(reacquired),
        );

        assert_eq!(decoded.len(), 3);
        assert_eq!(synchronizer.stats().corrected_blocks, 1);
        assert_eq!(synchronizer.stats().rejected_groups, 1);
        assert_eq!(synchronizer.stats().lost_sync_count, 1);
        assert!(!synchronizer.stats().synchronized);
    }

    #[test]
    fn reset_clears_alignment_and_statistics() {
        let mut synchronizer = RdsSynchronizer::new();
        synchronizer.push_bits(bits(group(0x54a1, 0)));

        synchronizer.reset();

        assert_eq!(synchronizer.stats(), Default::default());
        assert!(synchronizer.push_bits([false; 25]).is_empty());
    }
}
