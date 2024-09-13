import "../common/messages.tact";

// =====================================
// Project specific messages
// =====================================
// MintJetton is a message that allows the owner to mint new tokens
// and send them to a specified walletOwner.
message(0xa593886f) MintJetton {
    queryId: Int as uint64;
    amount: Int;
    receiver: Address;
    responseDestination: Address;
    forwardTonAmount: Int as coins;
    forwardPayload: Cell?;
}

// MultiMint is a message that allows the owner to mint new tokens for
// multiple receivers and send them to their wallets at once.
message(0xe78d9033) MultiMint {
    queryId: Int as uint64;
    receivers: map<Int as uint32, MultiMintReceiver>;
    receiverCount: Int as uint32;
    forwardPayload: Cell?;
}

message UpdateJettonContent {
    queryId: Int as uint64;
    content: Tep64TokenData
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

struct MultiMintReceiver {
    address: Address;
    amount: Int;
    tonAmount: Int as coins;
}
