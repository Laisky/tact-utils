import { NetworkProvider } from '@ton/blueprint';
import { beginCell, comment, toNano } from '@ton/core';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { Sample } from '../build/Sample/tact_Sample';
import { StakingMasterTemplate, storeStakeJetton } from '../build/Staking/tact_StakingMasterTemplate';
import { StakingWalletTemplate } from '../build/Staking/tact_StakingWalletTemplate';
import { getMasterContract, randomInt } from './utils';

export async function run(provider: NetworkProvider): Promise<void> {
    console.log("-------------------------------------")
    console.log('>> mint jetton to yourself');
    console.log("-------------------------------------")
    const sampleMasterContract = await getMasterContract(provider);
    const sampleContract = await provider.open(
        await Sample.fromInit(
            sampleMasterContract.address,
            provider.sender().address!!,
        )
    );

    console.log(`mint jetton to ${provider.sender().address!!.toString()}`);
    const amount = randomInt();

    await sampleMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "MintJettonSample",
            queryId: BigInt(randomInt()),
            amount: toNano(amount),
            receiver: provider.sender().address!!,
        }
    );

    console.log("-------------------------------------")
    console.log('>> wait jetton wallet deployed');
    console.log("-------------------------------------")
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
    const jettonWalletContract = await provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            provider.sender().address!!,
        )
    );
    await provider.waitForDeploy(jettonWalletContract.address, 50);

    console.log("-------------------------------------")
    console.log('>> prepare staking master contract');
    console.log("-------------------------------------")
    const stakingMasterContract = await provider.open(
        await StakingMasterTemplate.fromInit(
            provider.sender().address!!,
        )
    );
    const stakingWalletContract = await provider.open(
        await StakingWalletTemplate.fromInit(
            stakingMasterContract.address,
            provider.sender().address!!,
        )
    );
    const stakingJettonWalletContract = await provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            stakingMasterContract.address,
        )
    );

    // await stakingMasterContract.send(
    //     provider.sender(),
    //     {
    //         value: toNano("1"),
    //         bounce: false,
    //     },
    //     {
    //         $$type: "Deploy",
    //         queryId: BigInt(randomInt()),
    //     }
    // );
    // await provider.waitForDeploy(stakingMasterContract.address, 50);

    console.log("-------------------------------------")
    console.log("staking ton coin...")
    console.log("-------------------------------------")
    await stakingMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "StakeToncoin",
            queryId: BigInt(randomInt()),
            amount: toNano("0.01"),
            responseDestination: provider.sender().address!!,
            forwardTonAmount: toNano("0.1"),
            forwardPayload: comment("forward_payload"),
        }
    );

    console.log("-------------------------------------")
    console.log("staking jetton...")
    console.log("-------------------------------------")
    await jettonWalletContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "TokenTransfer",
            queryId: BigInt(Math.ceil(Math.random() * 1000000)),
            amount: toNano("1"),
            destination: stakingMasterContract.address,
            responseDestination: stakingMasterContract.address,
            forwardTonAmount: toNano("0.2"),
            forwardPayload: beginCell()
                .store(storeStakeJetton({
                    $$type: "StakeJetton",
                    queryId: null,
                    jettonWallet: null,
                    sender: null,
                    jettonAmount: null,
                    tonAmount: toNano("0.01"),
                    responseDestination: provider.sender().address!!,
                    forwardTonAmount: toNano("0.1"),
                    forwardPayload: comment("forward_payload"),
                }))
                .endCell(),
            customPayload: null,
        }
    );
}
