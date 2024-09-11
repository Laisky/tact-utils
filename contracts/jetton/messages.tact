// =====================================
// Standard Jettom messages
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
// =====================================
message(0xf8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address;
    custom_payload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell?;
}

// transfer tokens between jetton wallets or master contract
message(0x178d4519) TokenTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    responseDestination: Address;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell?;
}

message(0x7362d09c) TransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Cell?;
}

message(0x59f07bc) Burn {
    queryId: Int as uint64;
    amount: Int as coins;
    responseDestination: Address;
    forwardPayload: Cell?;
}

message(0x7bdd97de) TokenBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    // the owner property seems redundant,
    // the owner can be extracted from the sender of the message.
    owner: Address;
    responseDestination: Address?;
}

message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

// =====================================
// Project specific messages
// =====================================
// MintJetton is a message that allows the owner to mint new tokens
// and send them to a specified walletOwner.
message(0xa32a5c5f) MintJetton {
    // queryId should be unique and monotonically increasing.
    queryId: Int as uint64;
    amount: Int;
    receiver: Address;
    responseDestination: Address;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell?;
}

// Withdraw is a message that allows the owner to withdraw tokens from the wallet.
message(0x4ca83dc8) Withdraw {
}

// MultiMint is a message that allows the owner to mint new tokens for
// multiple receivers and send them to their wallets at once.
message(0xe78d9033) MultiMint {
    receivers: map<Int as uint32, MultiMintReceiver>;
    receiverCount: Int as uint32;
    forwardPayload: Cell?;
}

// =====================================
// Structs
// =====================================
struct JettonWalletData {
    balance: Int;
    owner: Address;
    master: Address;
    walletCode: Cell;
}

struct JettonMasterData {
    totalSupply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;
    walletCode: Cell;
}

struct Metadata {
    // https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#content-representation
    // 0 for onchain, 1 for offchain
    flag: Int as uint8;
    // if flag is 1, then the content is a URL to the offchain metadata.
    content: String;
}

struct MultiMintReceiver {
    address: Address;
    amount: Int;
    tonAmount: Int as coins;
}
