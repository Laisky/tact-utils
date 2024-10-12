# NFT

- [NFT](#nft)
  - [Scripts](#scripts)
  - [Flows](#flows)
    - [Mint](#mint)
    - [Transfer](#transfer)
    - [Update Collection Data](#update-collection-data)

[📖 TEP-062 NFT Standard](https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md)

## Scripts

-   [../scripts/nft.ts](https://github.com/Laisky/tact-utils/blob/main/scripts/nft.ts)
-   [../tests/NFT.spec.ts](https://github.com/Laisky/tact-utils/blob/main/tests/NFT.spec.ts)

## Flows

### Mint

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant A as NFT COllection
    participant C as NFT Item

    B ->>+ A: MintNFT<BR />(0xe535b616)
    Note over A: update nextItemIndex
    A -->>- C: NFTTransfer<BR />(0x5fcc3d14)
    activate C
    Note over C: initialized
    opt
      C -->> D: OwnershipAssigned<BR />(0x05138d91)
    end
    C -->>- D: Excesses<BR />(0xd53276db)
```

### Transfer

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant C as NFT Item

    B ->>+ C: NFTTransfer<BR />(0x5fcc3d14)
    activate C
    Note over C: update owner
    opt
      C -->> D: OwnershipAssigned<BR />(0x05138d91)
    end
    C -->>- D: Excesses<BR />(0xd53276db)
```

### Update Collection Data

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant A as NFT COllection

    B ->>+ A: UpdateCollection<BR />(0x48a60907)
    Note over A: update collection data
    A -->>- D: Excesses<BR />(0xd53276db)
```
