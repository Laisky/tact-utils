# tact-utils

[![Awesome TACT](https://awesome.re/badge.svg)](https://github.com/tact-lang/awesome-tact)
[![Twitter](https://img.shields.io/twitter/follow/LaiskyCai?style=social)](https://twitter.com/LaiskyCai)
[![Telegram](https://img.shields.io/badge/telegram-laiskycai-blue?logo=telegram)](https://t.me/laiskycai)

A collection of TON Tact templates and tools.

Provides ready-to-use templates for Jetton, NFT, Traits, as well as some commonly used tools.

[Click to view my article on using Tact to implement Jetton & NFTs! 🌟](https://blog.laisky.com/p/ton-tact/)

**Tested on Node.js v22.9**

**Still undergoing frequent updates!**

- [tact-utils](#tact-utils)
  - [Demo](#demo)
  - [Install](#install)
    - [Build](#build)
  - [Examples](#examples)
    - [Hello World](#hello-world)
    - [Jetton](#jetton)
    - [NFT](#nft)
  - [Helpful Traits](#helpful-traits)
    - [Txable](#txable)
    - [Upgradale](#upgradale)
    - [Jetton](#jetton-1)
      - [Jetton Template](#jetton-template)
      - [Jetton Trait](#jetton-trait)
  - [Helpful Tools](#helpful-tools)
  - [Helpful Communites](#helpful-communites)

## Demo

<https://s3.laisky.com/public/nft/connect/demo/index.html>

## Install

Install nodejs: <https://github.com/nodesource/distributions>

```sh
npm i
```

### Build

```sh
npx blueprint build
```

## Examples

`helloworld` is a simple example of a contract, while `sample` is an example that includes complex contract calls.
Please do not use `helloworld` and `sample` directly in your development.
Instead, use the code in `common`, `jetton`, and `nft` according to your needs.

### Hello World

```sh
npx blueprint build helloworld
npx blueprint run --testnet --tonconnect helloworld
```

![](https://s3.laisky.com/uploads/2024/09/IMG_4203.jpeg)

### Jetton

> To provide a more comprehensive code template, the sample deliberately includes a more complex Jetton implementation.
> You don't need to use the Sample directly in your project;
> rather, you should utilize the contracts and code in `jetton` and `common` as per your requirements.

-   [Sample Transaction](https://testnet.tonviewer.com/transaction/5fd248e34b3cb728aff786e990ac45324a2f070d89d9356fdac47fa61444813a)

```sh
npx blueprint build sample
npx blueprint run --testnet --tonconnect jetton

? input the address of the jetton receiver(default to yourself):
0QARnduCSjymI91urfHE_jXlnTHrmr0e4yaPubtPQkgy553b

Sent transaction
-------------------------------------
jetton master address: EQD9PR60ImXHSE1KIemZGS30F0aHc0QUnfC6sMYyw9HtSGqA
Contract deployed at address EQD9PR60ImXHSE1KIemZGS30F0aHc0QUnfC6sMYyw9HtSGqA
You can view it at https://testnet.tonscan.org/address/EQD9PR60ImXHSE1KIemZGS30F0aHc0QUnfC6sMYyw9HtSGqA
mintable: true
owner: EQDRAI32YdVGZGDq18ygyPyflOpY5qIAA9ukd-OJ0CfYJ8SN
jetton content: https://s3.laisky.com/uploads/2024/09/jetton-sample.json
jetton total supply: 19000000000
-------------------------------------
jetton wallet address: EQDJiYKObYkxFFTR5v53TihdY723W8YCh34jvdu7qcwhBhVx
Contract deployed at address EQDJiYKObYkxFFTR5v53TihdY723W8YCh34jvdu7qcwhBhVx
You can view it at https://testnet.tonscan.org/address/EQDJiYKObYkxFFTR5v53TihdY723W8YCh34jvdu7qcwhBhVx
jetton wallet owner: EQARnduCSjymI91urfHE_jXlnTHrmr0e4yaPubtPQkgy53uU
jetton wallet master: EQD9PR60ImXHSE1KIemZGS30F0aHc0QUnfC6sMYyw9HtSGqA
jetton wallet balance: 19000000000
```

![Jettom Sample](https://s3.laisky.com/uploads/2024/09/jetton-sample-shot.png)

### NFT

> To provide a more comprehensive code template, the sample deliberately includes a more complex NFT implementation.
> You don't need to use the Sample directly in your project;
> rather, you should utilize the contracts and code in `nft` and `common` as per your requirements.

-   [Sample Transaction](https://testnet.tonviewer.com/transaction/aef4b07e37d012e9b8051c1c4f2bcb263194b72d7f874218271595824b62a0bd)

```sh
npx blueprint build sample
npx blueprint run --testnet --tonconnect nft

Sent transaction
-------------------------------------
nft collection address: EQBHuZqwFHShebGvdOwRCeC1XbWPvYpOZsF7k7gkirDofyXG
Contract deployed at address EQBHuZqwFHShebGvdOwRCeC1XbWPvYpOZsF7k7gkirDofyXG
You can view it at https://testnet.tonscan.org/address/EQBHuZqwFHShebGvdOwRCeC1XbWPvYpOZsF7k7gkirDofyXG
nft collection owner: EQCVjlulLBzq9FSR2wQqZJU3uzE-TDXlvWKJAtHqu5SyHqoh
nft collection next index: 1
nft collection content: https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json
-------------------------------------
nft item address: EQCub9bLM0sjI2qJGafmMFiPsDFJhq5RkDVQRlnNV9Rr_W77
Contract deployed at address EQCub9bLM0sjI2qJGafmMFiPsDFJhq5RkDVQRlnNV9Rr_W77
You can view it at https://testnet.tonscan.org/address/EQCub9bLM0sjI2qJGafmMFiPsDFJhq5RkDVQRlnNV9Rr_W77
nft item owner: EQCVjlulLBzq9FSR2wQqZJU3uzE-TDXlvWKJAtHqu5SyHqoh
nft item collection: EQBHuZqwFHShebGvdOwRCeC1XbWPvYpOZsF7k7gkirDofyXG
nft item index: 0
nft item content: https://s3.laisky.com/uploads/2024/09/nft-sample-item-0.json
```

![NFT Sample](https://s3.laisky.com/uploads/2024/09/nft-sample-shot.png)

## Helpful Traits

Clone this repo to your project:

```sh
git clone https://github.com/Laisky/tact-utils.git
```

Then import the traits you need:

```js
import './tact-utils/contracts/common/traits.tact';
import './tact-utils/contracts/common/messages.tact';
```

### Txable

Set a `staticTax` to charge a fixed fee for every transaction, keeping it in the contract. Owners can adjust it anytime via `SetStaticTax` msg.

```js
contract YOUR_CONTRACT with Txable {
    owner: Address;
    staticTax: Int as coins = ton("0.001");
}
```

### Upgradale

Allow the contract to be upgraded by the owner.

```js
contract YOUR_CONTRACT with Upgradable {
    owner: Address;
}
```

### Jetton

#### Jetton Template

Easily implement your own Jetton contract using Jetton Template.

```js
import './tact-utils/contracts/jetton/jetton.tact';
import './tact-utils/contracts/common/messages.tact';

contract YOUR_CONTRACT {
    owner: Address;

    receive("SOME_MSG") {
        let jettonMaster = initOf JettonMasterTemplate(
            self.owner,
            Tep64TokenData{
                flag: 1,
                content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
            },
        )
    }
}
```

#### Jetton Trait

You can also deeply customize Jetton contracts using Jetton Trait.

```js
import './tact-utils/contracts/jetton/jetton.tact';

contract YOUR_CONTRACT with JettonMaster {
    owner: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;
    content: Cell;
    totalSupply: Int as coins;
    mintable: Bool;

    init(owner: Address, content: Tep64TokenData) {
        self.owner = owner;

        self.content = content.toCell();
        self.totalSupply = 0;
        self.mintable = true;
    }
}
```

## Helpful Tools

-   [TON Converter](https://ario.laisky.com/alias/ton-converter)
-   [Free permanent file storage.](https://ario.laisky.com/alias/doc)

## Helpful Communites

-   [TON Tact Language Chat](https://t.me/tactlang)
-   [TON Dev Chat (EN)](https://t.me/tondev_eng)
