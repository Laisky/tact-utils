# Jetton

-   [TEP-74 Fungible tokens (Jettons) standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md#jetton-master-contract)

## Flows

### Mint

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
