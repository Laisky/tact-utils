Jetton staking for TON protocol.

## Design

The StakingMaster contract enables any user to stake any jetton.

```mermaid
sequenceDiagram
    participant A as StakingMaster
    participant B as UserStakingWallet
    participant C as User

    C ->> A: get UserStakingWallet
    C ->> B: transfer jetton
```
