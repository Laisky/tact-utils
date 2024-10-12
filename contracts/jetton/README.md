# Jetton

- [Jetton](#jetton)
  - [Scripts](#scripts)
  - [Flows](#flows)
    - [Mint](#mint)
    - [Transfer](#transfer)
    - [Burn](#burn)

## Scripts

-   [../scripts/jetton.ts](https://github.com/Laisky/tact-utils/blob/main/scripts/jetton.ts)
-   [../tests/Jetton.spec.ts](https://github.com/Laisky/tact-utils/blob/main/tests/Jetton.spec.ts)

## Flows

### Mint

> ![](https://s3.laisky.com/uploads/2024/10/jetton-mint.png)
>
> <https://testnet.tonviewer.com/transaction/d73c4a2df090d881a69d76f3e13bcebb759c8a29d8e1b5aff3b6d6b89faf2f6e>

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant A as JettonMaster
    participant C as JettonWallet

    B ->>+ A: MintJetton<BR />(0xa593886f)
    Note over A: update total supply
    A -->>- C: TokenTransferInternal<BR />(0x178d4519)
    activate C
    Note over C: update balance
    opt
      C -->> D: TransferNotification<BR />(0x7362d09c)
    end
    C -->>- D: Excesses<BR />(0xd53276db)
```

### Transfer

> ![](https://s3.laisky.com/uploads/2024/10/jetton-transfer.png)
>
> <https://testnet.tonviewer.com/transaction/08915faa3d2e7f5739a93211f3d82206d568acefbd7e2a186bee68c011d22da0>

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant C as UserJettonWallet
    participant E as AotherJettonWallet

    B ->>+ C: TokenTransfer<BR />(0xf8a7ea5)
    activate C
    Note over C: update balance
    C -->>- E: TokenTransferInternal<BR />(0x178d4519)
    activate E
    Note over E: update balance
    opt
      E -->> D: TransferNotification<BR />(0x7362d09c)
    end
    E -->>- D: Excesses<BR />(0xd53276db)
```

### Burn

> ![](https://s3.laisky.com/uploads/2024/10/jetton-burn.png)
>
> <https://testnet.tonviewer.com/transaction/57b516141e535a23fb14bfa6441a37b5cd5c680c307394ce5e034bc27f5fea63>

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant C as JettonWallet
    participant A as JettonMaster

    B ->>+ C: Burn<BR />(0x59f07bc)
    Note over C: update balance
    C -->>- A: TokenBurnNotification<BR />(0x7bdd97de)
    activate A
    Note over A: update total supply
    A -->>- D: Excesses<BR />(0xd53276db)
```
