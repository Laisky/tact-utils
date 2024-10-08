message StakeToncoin {
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

struct StakeJetton {
    tonAmount: Int as coins;
    jettonAmount: Int as coins;
    // Jetton wallet address of the staking wallet contract.
    // you should first transfer the staked amount of jetton
    // to the staking wallet contract, then call the staking.
    jettonWallet: Address;
    // address to send the response to
    responseDestination: Address;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

message Release {
    queryId: Int as uint64;
    // the amount of TON coins to release
    amount: Int as coins;
    // the amount of jettons to release
    jettons: StakedJettonInfo;
    // the address to send the response to
    responseDestination: Address;
    // the custom payload to be sent with the response
    customPayload: Cell?;
}

struct ReleaseJettonInfo {
    // the amount of ton send to jetton wallet to release Jettons,
    // should be paid by the sender of the message.
    tonAmount: Int as coins;
    jettonAmount: Int as coins;
    jettonWallet: Address;
    // the address to receive the released jettons,
    // if not set, the responseDestination in the Release message will be used.
    responseDestination: Address?;
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
