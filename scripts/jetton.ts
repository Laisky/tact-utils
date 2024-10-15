import { NetworkProvider } from '@ton/blueprint';
import { comment, toNano } from '@ton/core';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { loadTep64TokenData } from '../build/Sample/tact_Sample';
import { randomInt } from './utils';


export async function run(provider: NetworkProvider): Promise<void> {
    const receiverAddr = provider.sender().address!!;

    const jettonMasterContract = await provider.open(
        await JettonMasterTemplate.fromInit(
            receiverAddr,
            {
                $$type: "Tep64TokenData",
                flag: BigInt("1"),
                content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
            }
        )
    );
    const jettonWalletContract = await provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            receiverAddr,
        )
    );

    console.log(`jetton master address: ${jettonMasterContract.address}`);

    console.log("-------------------------------------")
    console.log(`mint jetton to ${receiverAddr.toString()}`);
    console.log("-------------------------------------")

    await jettonMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "MintJetton",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            amount: toNano(randomInt()),
            receiver: receiverAddr,
            responseDestination: receiverAddr,
            forwardAmount: toNano("0.1"),
            forwardPayload: comment("forward_payload"),
        }
    );

    console.log("-------------------------------------")
    console.log(`wait jetton wallet deployed and show info`);
    console.log("-------------------------------------")

    console.log(`jetton wallet address: ${jettonWalletContract.address}`);
    await provider.waitForDeploy(jettonWalletContract.address, 50);


    console.log("-------------------------------------")
    console.log(`transfer jetton`);
    console.log("-------------------------------------")
    await jettonWalletContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "TokenTransfer",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            amount: toNano("1"),
            destination: receiverAddr,
            responseDestination: receiverAddr,
            customPayload: comment("transfer jetton"),
            forwardAmount: toNano("0.1"),
            forwardPayload: comment("forward_payload"),
        }
    );

    console.log("-------------------------------------")
    console.log(`burn jetton`);
    console.log("-------------------------------------")
    await jettonWalletContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "Burn",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            amount: toNano("1"),
            responseDestination: receiverAddr,
            customPayload: comment("burn jetton"),
        }
    );

    console.log("-------------------------------------")
    console.log(`show jetton info`);
    console.log("-------------------------------------")

    const jettonData = await jettonMasterContract.getGetJettonData();
    const jettonContent = loadTep64TokenData(jettonData.content.asSlice());
    console.log(`mintable: ${jettonData.mintable}`);
    console.log(`owner: ${jettonData.owner}`);
    console.log(`jetton content: ${jettonContent.content}`);
    console.log(`jetton total supply: ${jettonData.totalSupply}`);

    const walletData = await jettonWalletContract.getGetWalletData();
    console.log(`jetton wallet owner: ${walletData.owner}`);
    console.log(`jetton wallet master: ${walletData.master}`);
    console.log(`jetton wallet balance: ${walletData.balance}`);
}
