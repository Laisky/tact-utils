import { toNano, Address, comment, contractAddress, beginCell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import { getMasterContract, randomInt } from './utils';
import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { loadTep64TokenData, Sample } from '../build/Sample/tact_Sample';
import { StakeReleaseJettonInfo, StakingMasterTemplate, storeStakeJetton } from '../build/Staking/tact_StakingMasterTemplate';
import { StakingWalletTemplate } from '../build/Staking/tact_StakingWalletTemplate';

export async function run(provider: NetworkProvider): Promise<void> {
    console.log('>> mint jetton to yourself');
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

    console.log('>> wait jetton wallet deployed');
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

    console.log('>> deploy staking contract');
    const stakingMasterContract = await provider.open(
        await StakingMasterTemplate.fromInit(
            provider.sender().address!!,
        )
    );
    const stakingWalletContract = await provider.open(
        await StakingWalletTemplate.fromInit(
            stakingMasterContract.address,
            jettonWalletContract.address,
        )
    );
    const stakingJettonWalletContract = await provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            stakingWalletContract.address,
        )
    );

    await stakingMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "Deploy",
            queryId: BigInt(randomInt()),
        }
    );
    await stakingWalletContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "Deploy",
            queryId: BigInt(randomInt()),
        }
    );
    await provider.waitForDeploy(stakingWalletContract.address, 50);

    console.log("staking ton coin...")
    await stakingWalletContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "StakeToncoin",
            queryId: BigInt(randomInt()),
            amount: toNano("0.1"),
            responseDestination: provider.sender().address!!,
            forwardTonAmount: toNano("0.1"),
            forwardPayload: comment("forward_payload"),
        }
    );

    console.log("staking jetton...")
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
            destination: stakingWalletContract.address,
            responseDestination: stakingWalletContract.address,
            forwardTonAmount: toNano("0.2"),
            forwardPayload: beginCell()
                .store(storeStakeJetton({
                    $$type: "StakeJetton",
                    tonAmount: toNano("0"),
                    jettonAmount: toNano("1"),
                    jettonWallet: stakingJettonWalletContract.address,
                    responseDestination: provider.sender().address!!,
                    forwardTonAmount: toNano("0.1"),
                    forwardPayload: comment("forward_payload"),
                }))
                .endCell(),
            customPayload: null,
        }
    );
}
