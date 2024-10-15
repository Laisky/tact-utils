# Staking Contract Template for TON Tact

- [Staking Contract Template for TON Tact](#staking-contract-template-for-ton-tact)
  - [Scripts](#scripts)
  - [Flows](#flows)
    - [Stake TON coins](#stake-ton-coins)
    - [Stake Jettons and TON coins](#stake-jettons-and-ton-coins)
      - [Stake Jettons](#stake-jettons)
    - [Release](#release)
      - [Release TON coins](#release-ton-coins)
      - [Release Jettons](#release-jettons)

Users can stake TON coins along with any Jettons. The primary entity is the Staking Master Contract, and each user will have their individual Staking Wallet Contract. Users have the flexibility to stake and redeem their assets at any time.

**This is an experimental contract template! 🚀 PRs are welcome! 💻✨**

## Scripts

- [../scripts/staking.ts](https://github.com/Laisky/tact-utils/blob/main/scripts/staking.ts)
- [../tests/Staking.spec.ts](https://github.com/Laisky/tact-utils/blob/main/tests/Staking.spec.ts)

## Flows

### Stake TON coins

> ![](https://s3.laisky.com/uploads/2024/10/stake-ton.png)
>
> <https://testnet.tonviewer.com/transaction/b09b6b73a8fb72471e8c792719c831c2376086a3f9a091d0424f3cf780065504>

```mermaid
sequenceDiagram
    participant A as StakingMaster
    participant B as UserStakingWallet
    participant C as User

    C ->>+ A: StakeToncoin<BR />(0x7ac4404c)
    Note over A: add to locked value
    A -->>- B: StakeToncoin<BR />(0x7ac4404c)
    activate B
    Note over B: update staked balance
    opt
        B -->> C: StakeNotification<BR />(0x2c7981f1)
    end
    B -->>- C: Excesses<BR />(0xd53276db)

```

### Stake Jettons and TON coins

#### Stake Jettons

> ![](https://s3.laisky.com/uploads/2024/10/stake-jetton.png?v=3)
>
> <https://testnet.tonviewer.com/transaction/8b84cb6025fae09e9c24b9044e716fc7da2715eb261856192162dea2705a2eea>

```mermaid
sequenceDiagram
    participant A as StakingMaster
    participant E as StakingMasterJettonWallet
    participant B as UserStakingWallet
    participant C as User
    participant D as UserJettonWallet

    C ->>+ D: TokenTransfer<BR />(0xf8a7ea5)
    D -->>- E: TokenTransferInternal<BR />(0x178d4519)
    activate E
    E -->>+ B: Excesses<BR />(0xd53276db)
    B -->>- C: Excesses<BR />(0xd53276db)
    E -->>- A: TransferNotification<BR />(0x7362d09c)
    activate A
    opt
        A -->> C: StakeNotification<BR />(0x2c7981f1)
    end
    A -->>- B: StakeInternal<BR />(0xa576751e)
    activate B
    Note over B: update staked balance
    B -->>- C: Excesses<BR />(0xd53276db)
```

### Release

> ![](https://s3.laisky.com/uploads/2024/10/stake-release.png)
>
> <https://testnet.tonviewer.com/transaction/8f7d63c31bccef3e05f3f77a74ccc931df24d8b79d24b7015e043f796d4cfd6e>

#### Release TON coins

```mermaid
sequenceDiagram
    participant A as StakingMaster
    participant B as UserStakingWallet
    participant C as User

    C ->>+ B: StakeRelease<BR />(0x51fa3a81)
    Note over B: update staked balance
    B -->>- A: StakeRelease<BR />(0x51fa3a81)
    activate A
    Note over A: update locked value
    opt
        A -->> C: StakeReleaseNotification<BR />(0xe656dfa2)
    end
    A -->>- C: Excesses<BR />(0xd53276db)
```

#### Release Jettons

```mermaid
sequenceDiagram
    participant E as StakingMasterJettonWallet
    participant A as StakingMaster
    participant B as UserStakingWallet
    participant C as User
    participant D as UserJettonWallet

    C ->>+ B: StakeRelease<BR />(0x51fa3a81)
    Note over B: update staked balance
    B -->>- A: StakeRelease<BR />(0x51fa3a81)
    activate A
    Note over A: update locked value
    opt
        A -->> C: StakeReleaseNotification<BR />(0xe656dfa2)
    end
    A -->> C: Excesses<BR />(0xd53276db)
    par
        A -->>- E: TokenTransfer<BR />(0xf8a7ea5)
        activate E
        E -->>- D: TokenTransferInternal<BR />(0x178d4519)
        activate D
        D -->> C: Excesses<BR />(0xd53276db)
        D -->>- C: TransferNotification<BR />(0x7362d09c)
    end
```
