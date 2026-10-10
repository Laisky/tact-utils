// Receipt messages are private to the canonical master/wallet pair. The first
// 188 body bits identify an operation and amount even in a truncated bounce.
message(0x4d505250) MintPrepare {
    operationId: Int as uint64;
    amount: Int as coins;
    queryId: Int as uint64;
    issuer: Address;
    responseDestination: Address;
    forwardAmount: Int as coins;
    forwardPayload: Cell?;
}
message(0x4d41434b) MintAccepted {
    operationId: Int as uint64;
    amount: Int as coins;
}
message(0x4d434d54) MintCommit {
    operationId: Int as uint64;
    amount: Int as coins;
}
message(0x4d534554) MintSettled {
    operationId: Int as uint64;
    amount: Int as coins;
}
// Retry never cancels uncertain delivery or changes an operation's identity.
message(0x4d525452) RetryMint {
    operationId: Int as uint64;
}
struct PendingMint {
    wallet: Address;
    amount: Int as coins;
    prepared: Cell;
    committed: Bool;
    cancelOnBounce: Bool;
    responseDestination: Address;
}
struct MintStatus {
    pendingCount: Int;
    lastOperationId: Int;
}
struct WalletMintStatus {
    operationId: Int;
    lockedAmount: Int;
    lastSettledId: Int;
}
const maxPendingMints: Int = 1024;
const maxMintBatch: Int = 16;
const mintStepGas: Int = 120000;
const codeMintReceiptInvalid: Int = 50106;
const codeMintPendingLimit: Int = 50107;
const codeMintWalletBusy: Int = 50108;

// mintDataCells returns distinct DAG cells, throwing on oversized bounded input.
asm fun mintDataCells(data: Cell, limit: Int): Int { CDATASIZE DROP DROP }
// mintDataBits returns DAG bits for config-priced forwarding estimates.
asm fun mintDataBits(data: Cell, limit: Int): Int { CDATASIZE DROP NIP }
// mintStepFee prices the qualified per-receipt gas envelope from chain config.
fun mintStepFee(): Int { return getComputeFee(mintStepGas, false); }
