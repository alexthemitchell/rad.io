pub mod bank;
pub mod blocks;
pub mod demodulator;
pub mod groups;
pub mod metadata;
pub mod synchronizer;
pub mod synthetic;

pub use bank::{
    MAX_RDS_TARGETS, RdsBankError, RdsChannelSnapshot, RdsDecodeTarget, RdsDecoderBank,
};
pub use blocks::{BlockDecodeError, BlockKind, DecodedBlock, decode_block, encode_block};
pub use demodulator::{RdsDecodeError, RdsDecoder, RdsDecoderSnapshot};
pub use groups::{GroupDecodeError, GroupType, GroupVersion, RdsGroup, decode_group, encode_group};
pub use metadata::{MetadataAccumulator, RdsMetadata};
pub use synchronizer::{RdsSynchronizer, SynchronizerStats};
pub use synthetic::{SyntheticFmRdsGenerator, synthetic_group_words};
