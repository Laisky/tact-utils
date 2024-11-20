import "../common/messages.tact";


message(0xfed5e4e8) MintJettonSample {
    queryId: Int as uint64;
    amount: Int as coins;
    receiver: Address;
}

message(0xe2b82ed5) MintNftSample {
    queryId: Int as uint64;
    receiver: Address;
}

message(0x1e8dbe39) VerifyDataSignature {
    queryId: Int as uint64;
    data: Cell;
    signature: Slice;
    publicKey: Int as uint256;
}

message(0x6d83a3c1) VerifyMerkleProof {
    queryId: Int as uint64;
    proof: MerkleProof;
}
