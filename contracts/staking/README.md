Jetton staking for TON protocol.

## Design

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

#### Deploy User's Stake Wallet First

Should deploy user's stake wallet before staking jettons.

> ![](https://s3.laisky.com/uploads/2024/10/stake-deploy.png)
>
> <https://testnet.tonviewer.com/transaction/f64318117ddbb69bfdb079d30a2ba311139fc5a7aadacbb0169d0f3d64f617c5>

```mermaid
sequenceDiagram
    participant A as StakingMaster
    participant B as UserStakingWallet
    participant C as User

    C ->>+ A: StakeDeployUserWallet<BR />(0x70b40d3f)
    A -->>- B: StakeDeployUserWallet<BR />(0x70b40d3f)
    activate B
    B -->>- C: Excesses<BR />(0xd53276db)

```

#### Stake Jettons

Please make sure the user's stake wallet is deployed before staking jettons.

> ![](https://s3.laisky.com/uploads/2024/10/stake-jetton.png?v=2)
>
> <https://testnet.tonviewer.com/transaction/fefe263284399ce78434b06c14c6d7bcd6fea8f4be73da235fc4450deb51e56d>

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
    E -->>- B: TransferNotification<BR />(0x7362d09c)
    activate B
    Note over B: update staked balance
    opt
        B -->> C: StakeNotification<BR />(0x2c7981f1)
    end
    B -->>- A: StakeInternal<BR />(0xa576751e)
    activate A
    A -->>- C: Excesses<BR />(0xd53276db)
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
