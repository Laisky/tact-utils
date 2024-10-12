import "../common/messages.tact";

// =====================================
// Received messages
// =====================================

// -------------------------------------
// Non-standard messages
// -------------------------------------

message(0xe535b616) MintNFT {
    queryId: Int as uint64;
    receiver: Address;
    responseDestination: Address;
    forwardAmount: Int as coins = 0;
    forwardPayload: Cell?;
}

message(0x48a60907) UpdateCollection {
    queryId: Int as uint64;
    responseDestination: Address;
    collectionContent: Tep64TokenData?;
    itemContentUrlPrefix: String?;
    royalty: RoyaltyParams?;
}


// =====================================
// Responsed structures
// =====================================

struct NftItemInitForwardPayload {
    index: Int as uint256;
}
