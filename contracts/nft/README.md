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
-   [../tests/NFT.spec.ts](https://github.com/Laisky/tact-utils/blob/main/tests/Nft.spec.ts)

## Flows

### Mint

> ![](https://s3.laisky.com/uploads/2024/10/nft-mint.png)
>
> <https://testnet.tonviewer.com/transaction/ddf0a703fec38e0508fc72c7d74642e42167f6c6e60ed184018645e090cc2ef2>

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

> ![](https://s3.laisky.com/uploads/2024/10/nft-transfer.png)
>
> <https://testnet.tonviewer.com/transaction/0d1cb9f5f0e30764881e0cf5bdfabdf4ce452ed55dea998729791dbc53eb654a>

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

> ![](https://s3.laisky.com/uploads/2024/10/nft-update.png)
>
> <https://testnet.tonviewer.com/transaction/dfc15c101b66e99f5bf81c2ef5a21fc553fc8610258b678d92a129d8532476f2>

```mermaid
sequenceDiagram
    participant D as ResponseDestination<BR />(mostly User)
    participant B as User
    participant A as NFT COllection

    B ->>+ A: UpdateCollection<BR />(0x48a60907)
    Note over A: update collection data
    A -->>- D: Excesses<BR />(0xd53276db)
```
