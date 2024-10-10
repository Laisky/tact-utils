message(0x7ac4404c) StakeToncoin {
    queryId: Int as uint64;
    // amount of TON coins to stake
    amount: Int;
    // address to send the response to
    responseDestination: Address;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

message(0x2c7981f1) StakeNotification {
    queryId: Int as uint64;
    // the amount of TON coins staked
    amount: Int as coins;
    jetton: StakeJetton?;
    sender: Address;
    forwardPayload: Cell?;
}

message(0xe656dfa2) StakeReleaseNotification {
    queryId: Int as uint64;
    // the amount of TON coins released
    amount: Int as coins;
    jettons: map<Int as uint64, StakeReleaseJettonInfo>;
    jettonsIdx: Int as uint64;
    // the address of the jetton receiver
    destination: Address;
    // payload to forward
    forwardPayload: Cell?;
}

message(0x6ab57824) StakeJetton {
    queryId: Int? as uint64;
    tonAmount: Int as coins;
    jettonAmount: Int? as coins;
    // Jetton wallet address of the staking master contract.
    // the value will set by the staking master contract.
    jettonWallet: Address?;
    // the address of the user who transferred the Jetton.
    sender: Address?;
    // address to send the response to
    responseDestination: Address;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

// only stakingMaster's owner can call this message
message(0x51fa3a81) StakeRelease {
    queryId: Int as uint64;
    // the amount of TON coins to release
    amount: Int as coins;
    // the amount of jettons to release
    jettons: map<Int as uint64, StakeReleaseJettonInfo>;
    jettonsIdx: Int as uint64;
    // the address of the staked asset owner that will be released
    owner: Address;
    // the address to receive the released ton coins
    destination: Address;
    // the address to send the excesses to
    responseDestination: Address;
    // the custom payload to be sent with the released ton coins
    customPayload: Cell?;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

struct StakeReleaseJettonInfo {
    // pay the token transfer fee,
    // should be greater than forwardTonAmount.
    tonAmount: Int as coins;
    jettonAmount: Int as coins;
    jettonWallet: Address;
    // the address to receive the released jettons.
    // should be wallet address, not the jetton wallet address.
    destination: Address;
    customPayload: Cell?;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

struct StakedJettonInfo {
    jettonAmount: Int as coins;
}

struct StakedInfo {
    stakedTonAmount: Int as coins;
    stakedJettons: map<Address, StakedJettonInfo>;
}
