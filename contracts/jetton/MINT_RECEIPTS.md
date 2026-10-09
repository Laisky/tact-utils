# Mint delivery receipts (issue #6)

This change requires newly compiled, newly deployed templates. It does not upgrade
deployed masters or wallets. Receipt storage changes StateInit and derived addresses;
legacy master-to-wallet TokenTransferInternal minting is rejected by new wallets.
Peer transfer/burn formats remain TEP-74. No deployment or live wallet action is part
of this source change.

## Accounting and asynchronous delivery

1. The owner requests a mint. The master stores a pending operation with a globally
   increasing uint64 ID, exact canonical wallet, amount and immutable delivery body.
   Supply is unchanged. Prepare is bounceable with a bounded TON budget.
2. The canonical wallet validates funding and its current tax, durably stores the
   receipt, and sends MintAccepted. Prepared credit is excluded from spendable
   balance, so it cannot be transferred or burned ahead of the acknowledgement.
   Mandatory send failure rolls back prepare; a genuine failed prepare bounce
   clears only the matching uncommitted master operation and refunds recoverable TON.
3. The master accepts only the matching wallet/ID/amount and commits supply once.
   It sends MintCommit. The wallet unlocks the credit only on that exact confirmation,
   remembers its last settled ID/amount, and sends MintSettled.
4. The master clears receipt capacity on authenticated settlement and returns
   remaining delivery funds to the original response destination. Initial issuer
   inflow above each outbound budget is separately refunded directly to the issuer.

During delivery, totalSupply excludes prepared unconfirmed credit. After the master
confirms, supply includes confirmed credit still locked while commit is in transit.
Once unlocked, transfers and burns can run before settlement cleanup; settlement
does not change supply. Existing asynchronous transfer/burn accounting remains.

## Bounded state and retries

There are at most 1024 pending master operations and one active operation per wallet.
A batch has at most 16 independent recipients. Duplicate recipients in a batch fail
atomically instead of competing for the same compact wallet replay state. uint64 IDs
never wrap. Normal settlement and confirmed prepare rejection return capacity.

There is no timeout rollback: a delayed acknowledgement/commit is not proof that
credit did not occur. Unknown delivery remains pending and blocks that wallet's next
mint. Owner-only RetryMint resends the exact stored prepare or committed confirmation
with fresh funding. Once prepare has been retried, a bounced copy cannot prove
that another copy was not prepared, so the pending receipt is retained for recovery;
duplicate ACK/commit cannot increment supply or credit twice.
The wallet's persistent last-settled ID handles settlement loss/retry without keeping
an unbounded history. Acknowledgement/commit gas, storage debt or configuration changes
can delay progress; retries require sufficient current funding. This bounds state, but
does not promise automatic liveness under arbitrary chain/storage conditions.

## TON funding and tax

mint_budget(receiver, forwardAmount, payload) returns a conservative per-entry
delivery budget from chain getComputeFee/getForwardFee prices. Receipt compute uses a
120000 gas envelope per step, with four steps plus StateInit, bounded payload and
forwarding envelopes; the owner-side transaction separately requires its compute/tax
budget. Payload DAGs are limited to 32 cells. Batch tonAmount must cover the returned
budget; it remains an explicit chosen outbound cap.

A recipient may still reject prepare by raising its tax. Supply is not committed
and the genuine bounce returns recoverable value instead of leaving non-bounceable
inflow withdrawable at that wallet. After prepare, commit/settlement preserve prior
TON without charging mutable tax again, so a later tax increase cannot block credit.
Tiny forward notifications retain SendIgnoreErrors, and notification identity and
original query IDs are preserved. Fees are not guaranteed to be zero; old contract
balances must remain protected and actual flows must be checked net of native fees.

## Qualification

Use installed binaries only; all transactions use in-memory TON Sandbox treasuries.
The unchanged baseline at 06795c6 reproduced supply 300 versus credited 100 in a mixed
batch and retained 287005199 nanotons at the rejected wallet. Four baseline/control
cases passed on Node22.7.0 / Tact1.5.2 / Sandbox0.23.0.

The candidate compiles and 28 focused cases pass (17 receipt regressions plus
11 existing Jetton controls). Native interleavings include an executor-generated
out-of-gas ACK bounce and retry, a failed duplicate prepare that cannot cancel
prior durable credit, transfer/burn before settlement, tax changes and duplicate
receipts. Native fee conservation includes bounce forwarding fees. The local
capacity case passes at 1024 pending operations, rejects 1025 atomically, then
settles a genuine retained message and reuses the freed slot. Peak 16-entry batch
compute was 802646 gas; individual full-state receipt steps stayed under 120000.
Full-suite acceptance and hosted status are recorded separately at the
published pull request head.
No fabricated bounced flag, RPC, mnemonic, production account, blockchain transaction
or deployment script is used.

Both receipt engineering suites are opt-in and excluded from normal hosted CI.
Existing workflow triggers/jobs are unchanged. Run heavy acceptance locally:

```sh
RUN_MINT_RECEIPTS=1 ./node_modules/.bin/jest --runInBand --runTestsByPath tests/SecurityMintDelivery.spec.ts tests/Jetton.spec.ts
RUN_MINT_CAPACITY=1 ./node_modules/.bin/jest --runInBand --runTestsByPath tests/SecurityMintCapacity.spec.ts
```

It creates 1024 real master receipts while delaying their actual outgoing messages,
then verifies entry 1025 fails atomically. Run under the shared nonblocking validation
lock with CPU/memory/time limits; do not compete with other heavy jobs.
