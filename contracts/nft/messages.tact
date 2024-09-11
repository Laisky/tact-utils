import "../common/messages.tact";

// =====================================
// Received messages
// =====================================

// -------------------------------------
// Non-standard messages
// -------------------------------------

message(0xa32a5c5f) MintNFT {
    queryId: Int as uint64;
    newOwner: Address;
    forwardAmount: Int as coins = 0;
    forwardPayload: Cell?;
}

// =====================================
// Responsed structures
// =====================================

struct GetNftData {
    init: Bool;
    index: Int as uint256;
    collectionAddress: Address;
    ownerAddress: Address;
    individualContent: Cell;
}

struct CollectionData {
    nextItemIndex: Int;
    collectionContent: Cell;
    ownerAddress: Address;
}

// https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md#get-methods
struct RoyaltyParams {
    numerator: Int;
    denominator: Int;
    destination: Address;
}

struct Tep64TokenData {
    // flag is the flag of the content type.
    // 0 means on-chain, 1 means off-chain.
    //
    // https://github.com/ton-blockchain/TEPs/pull/191/files
    // https://github.com/ton-blockchain/token-contract/blob/21e7844fa6dbed34e0f4c70eb5f0824409640a30/nft/nft-collection.fc#L161
    flag: Int as uint8;
    content: String;
}

struct NftItemInitiation {
    individualContent: Cell;
    index: Int as uint256;
}
