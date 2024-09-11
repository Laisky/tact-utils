# tact-utils

A collection of TON Tact templates and tools.

Provides ready-to-use templates for Jetton, NFT, Traits, as well as some commonly used tools.

[Clock to view my article on using Tact to implement Jetton & NFTs! 🌟](https://blog.laisky.com/p/ton-tact/)

## Install

Install nodejs: <https://github.com/nodesource/distributions>

```sh
npm i
```

### Build

```sh
npx blueprint build
```

## Usage

### Jetton

- [Sample Transaction](https://testnet.tonviewer.com/transaction/275a294d5a80852ca205449d7cfe4bc015329f0eb4b988a08c4d09bd31556862)

```sh
npx blueprint run --testnet --tonconnect jetton
```

![Jettom Sample](https://s3.laisky.com/uploads/2024/09/jetton-sample-shot.png)

### NFT

- [Sample Transaction](https://testnet.tonviewer.com/transaction/8e9ee64b26249eff2e70579c7a1fc090290d33e25a0c40ee22429b0d277ec451)

```sh
npx blueprint run --testnet --tonconnect nft
```

![NFT Sample](https://s3.laisky.com/uploads/2024/09/nft-sample-shot.png)
