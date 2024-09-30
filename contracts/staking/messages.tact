message StakingToncoin {
    queryId: Int as uint64;
    // amount of TON coins to stake
    amount: Int;
    // owner of the staked coins
    owner: Address;
    // address to send the response to
    responseDestination: Address;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

message WalletStakingDeposit {
    queryId: Int as uint64;
    // amount of coins to stake
    amount: Int;
    // address to send the response to
    responseDestination: Address;
    // amount of TON to forward
    forwardTonAmount: Int as coins;
    // payload to forward
    forwardPayload: Cell?;
}

struct StakingJettonData {
    amount: Int as coins;
    // Jetton wallet address of the staking master contract.
    // you should first transfer the staked amount of jetton
    // to the staking master contract, then call the staking.
    walletContract: Address;
}
