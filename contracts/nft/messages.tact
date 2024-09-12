import "../common/messages.tact";

// =====================================
// Received messages
// =====================================

// -------------------------------------
// Non-standard messages
// -------------------------------------

message(0xe535b616) MintNFT {
    queryId: Int as uint64;
    newOwner: Address;
    forwardAmount: Int as coins = 0;
    forwardPayload: Cell?;
}

// =====================================
// Responsed structures
// =====================================

struct NftItemInitForwardPayload {
    index: Int as uint256;
}
