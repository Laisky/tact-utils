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
    - [Common](#common)
      - [Convert hashed value from `Int` to hex `String`](#convert-hashed-value-from-int-to-hex-string)
      - [Onchain full-SHA256](#onchain-full-sha256)
      - [Verify Merkle root on-chain](#verify-merkle-root-on-chain)
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
yarn
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

- [Sample Transaction](https://testnet.tonviewer.com/transaction/5fd248e34b3cb728aff786e990ac45324a2f070d89d9356fdac47fa61444813a)
- [Sequence Diagram](https://github.com/Laisky/tact-utils/blob/main/contracts/jetton/README.md)

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

- [Sample Transaction](https://testnet.tonviewer.com/transaction/aef4b07e37d012e9b8051c1c4f2bcb263194b72d7f874218271595824b62a0bd)
- [Sequence Diagram](https://github.com/Laisky/tact-utils/blob/main/contracts/nft/README.md)

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

### Common

```js
import './tact-utils/contracts/common/traits.tact';

contract YOUR_CONTRACT with Common {
    owner: Address;
}
```

#### Convert hashed value from `Int` to hex `String`

In the Common Trait, there is a function named `int2hex(Int): String` that can convert a hash value of type `Int` to a hexadecimal string of type `String`.

#### Onchain full-SHA256

In Tact, the `sha256` function truncates the input string, keeping only the first 128 bytes. Therefore, a `fullSha256` function is re-implemented in `common` to compute the complete sha256.

In `common/traits.tact`, there is both a function named `fullSha256` and a method named `fullSha256` that belongs to the Common trait.

```js
// Contract
contract YOURCONTRACT with Common {
    get fun testStrHash(v1: String, v2: String): String {
        let hashed = beginString()
            .concat(v1)
            .concat(v2)
            .toString();

        return self.int2hex(self.fullSha256(hashed));
    }
}

// Test script
it("hash string onchain", async () => {
    const v1 = "4d2377d0bc3befe8a721e96b13e22d3b4e557024353e69e2b5d0f315ad49aa05";
    const v2 = "551f6c3e8d7ae7d9b3ac53bca9b6f82cff322fb16113820776d14a3f93b93951";

    const gotHash = await sampleMaster.getTestStrHash(v1, v2);
    const expectHash = (await sha256(v1 + v2)).toString('hex');

    console.log(BigInt("0x"+(await sha256(v1 + v2)).toString('hex')));

    expect(gotHash).toEqual(expectHash);
});
```

#### Verify Merkle root on-chain

In `common/traits.tact`, there is a function named `verifyMerkleSha256(MerkleProof)` that can verify the Merkle root on-chain.

```js
// Contract
contract YOURCONTRACT with Common {
    get fun testVerifyMerkleProof(msg: VerifyMerkleProof) {
        self.verifyMerkleSha256(msg.proof);
    }
}

// Test script
const generateMerkleProof = async (data: Cell) => {
    const d0 = comment("hello");
    const d1 = comment("world");

    let proofs = [];
    proofs.push(
        d0.hash().toString("hex"),
        d1.hash().toString("hex"),
    );

    let root;
    root = (await sha256(data.hash().toString('hex') + d0.hash().toString('hex'))).toString('hex');
    root = (await sha256(root + d1.hash().toString('hex'))).toString('hex');

    console.log(`proofs: ${proofs}`);
    return {
        proofs,
        root,
    };
};

it("merkle onchain", async () => {
    const data = comment('abc');
    const { proofs, root } = await generateMerkleProof(data);

    let proof = Dictionary.empty<number, bigint>();
    for (let i = 0; i < proofs.length; i++) {
        proof = proof.set(i, BigInt(`0x${proofs[i]}`));
    }

    await sampleMaster.getTestVerifyMerkleProof(
        {
            $$type: "VerifyMerkleProof",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            proof: {
                $$type: "MerkleProof",
                data: data,
                root: BigInt(`0x${root}`),
                proof: proof,
                proofLen: BigInt(proofs.length),
            },
        }
    );
});

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

- [TON Converter](https://ario.laisky.com/alias/ton-converter)
- [Free permanent file storage.](https://ario.laisky.com/alias/doc)

## Helpful Communites

- [TON Tact Language Chat](https://t.me/tactlang)
- [TON Dev Chat (EN)](https://t.me/tondev_eng)
