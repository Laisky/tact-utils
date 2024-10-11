import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { loadTep64TokenData, Sample } from '../build/Sample/tact_Sample';
import { getMasterContract } from './utils';


export async function run(provider: NetworkProvider): Promise<void> {
    let receiver = await provider.ui().input(
        "input the address of the jetton receiver(default to yourself):",
    );

    const sampleMasterContract = await getMasterContract(provider);
    const sampleContract = await provider.open(
        await Sample.fromInit(
            sampleMasterContract.address,
            provider.sender().address!!,
        )
    );

    const randomNumber = Math.floor(Math.random() * 100);

    // mint jetton
    // strip prefix and suffix space
    receiver = receiver.trim();
    let receiverAddr: Address;
    if (receiver) {
        receiverAddr = Address.parse(receiver);
    } else {
        receiverAddr = provider.sender().address!!;
    }
    console.log(`mint jetton to ${receiverAddr.toString()}`);

    await sampleMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "MintJettonSample",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            amount: toNano(randomNumber),
            receiver: receiverAddr,
        }
    );

    // wait jetton master deployed and show info
    console.log("-------------------------------------");
    const jettonMasterContract = await provider.open(
        await JettonMasterTemplate.fromInit(
            sampleContract.address,
            {
                $$type: "Tep64TokenData",
                flag: BigInt("1"),
                content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
            }
        )
    );
    console.log(`jetton master address: ${jettonMasterContract.address}`);
    await provider.waitForDeploy(jettonMasterContract.address, 30);


    const jettonData = await jettonMasterContract.getGetJettonData();
    const jettonContent = loadTep64TokenData(jettonData.content.asSlice());
    console.log(`mintable: ${jettonData.mintable}`);
    console.log(`owner: ${jettonData.owner}`);
    console.log(`jetton content: ${jettonContent.content}`);
    console.log(`jetton total supply: ${jettonData.totalSupply}`);

    // wait jetton wallet deployed and show info
    console.log("-------------------------------------");
    const jettonWalletContract = await provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            provider.sender().address!!,
        )
    );

    console.log(`jetton wallet address: ${jettonWalletContract.address}`);
    await provider.waitForDeploy(jettonWalletContract.address, 30);
    const walletData = await jettonWalletContract.getGetWalletData();
    console.log(`jetton wallet owner: ${walletData.owner}`);
    console.log(`jetton wallet master: ${walletData.master}`);
    console.log(`jetton wallet balance: ${walletData.balance}`);
}
