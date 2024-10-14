import { NetworkProvider } from '@ton/blueprint';
import { beginCell, comment, Dictionary, fromNano, toNano } from '@ton/core';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { Sample } from '../build/Sample/tact_Sample';
import { StakeReleaseJettonInfo, StakingMasterTemplate, storeStakeJetton } from '../build/Staking/tact_StakingMasterTemplate';
import { StakingWalletTemplate } from '../build/Staking/tact_StakingWalletTemplate';
import { getMasterContract, randomInt } from './utils';


export async function run(provider: NetworkProvider): Promise<void> {
    const stakingMasterContract = provider.open(
        await StakingMasterTemplate.fromInit(
            provider.sender().address!!,
        )
    );
    const stakingWalletContract = provider.open(
        await StakingWalletTemplate.fromInit(
            stakingMasterContract.address,
            provider.sender().address!!,
        )
    );
    const sampleMasterContract = await getMasterContract(provider);
    const sampleContract = provider.open(
        await Sample.fromInit(
            sampleMasterContract.address,
            provider.sender().address!!,
        )
    );
    const jettonMasterContract = provider.open(
        await JettonMasterTemplate.fromInit(
            sampleContract.address,
            {
                $$type: "Tep64TokenData",
                flag: BigInt("1"),
                content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
            }
        )
    );
    const jettonWalletContract = provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            provider.sender().address!!,
        )
    );
    const stakingJettonWalletContract = provider.open(
        await JettonWalletTemplate.fromInit(
            jettonMasterContract.address,
            stakingMasterContract.address,
        )
    );

    console.log("-------------------------------------")
    console.log('>> mint jetton to yourself');
    console.log("-------------------------------------")
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
    await provider.waitForDeploy(jettonWalletContract.address, 50);

    console.log("-------------------------------------")
    console.log('>> prepare staking contracts');
    console.log("-------------------------------------")

    await stakingMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "StakeDeployUserWallet",
            queryId: BigInt(randomInt()),
            owner: provider.sender().address!!,
            responseDestination: provider.sender().address!!,
        }
    );
    await provider.waitForDeploy(stakingWalletContract.address, 50);

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
            forwardAmount: toNano("0.1"),
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
            responseDestination: stakingWalletContract.address,
            forwardAmount: toNano("0.2"),
            forwardPayload: beginCell()
                .store(storeStakeJetton({
                    $$type: "StakeJetton",
                    tonAmount: toNano("0.01"),
                    responseDestination: provider.sender().address!!,
                    forwardAmount: toNano("0.1"),
                    forwardPayload: comment("forward_payload"),
                }))
                .endCell(),
            customPayload: null,
        }
    );

    console.log("-------------------------------------")
    console.log("show staking info")
    console.log("-------------------------------------")
    {
        const stakedInfo = await stakingWalletContract.getStakedInfo();
        console.log(`staked TON coin: ${fromNano(stakedInfo.stakedTonAmount)}`);

        for (const jettonWalletAddr of stakedInfo.stakedJettons.keys()) {
            const jettonWallet = provider.open(
                JettonWalletTemplate.fromAddress(jettonWalletAddr)
            );
            const walletData = await jettonWallet.getGetWalletData();

            console.log(`user staked jetton: ${fromNano(stakedInfo.stakedJettons.get(jettonWalletAddr)!!.jettonAmount)}`);
            console.log(`total jetton: ${fromNano(walletData.balance)}`);
        }
    }

    console.log("-------------------------------------")
    console.log("release staking")
    console.log("-------------------------------------")
    let releasejettons = Dictionary.empty<bigint, StakeReleaseJettonInfo>();
    releasejettons.set(
        BigInt("0"),
        {
            $$type: "StakeReleaseJettonInfo",
            tonAmount: toNano("0.2"),
            jettonAmount: toNano("0.01"),
            jettonWallet: stakingJettonWalletContract.address,
            destination: provider.sender().address!!,
            customPayload: null,
            forwardAmount: toNano("0.1"),
            forwardPayload: comment("forward_payload"),
        }
    )

    await stakingWalletContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "StakeRelease",
            queryId: BigInt(randomInt()),
            amount: toNano("0.001"),
            jettons: releasejettons,
            jettonsIdx: BigInt("1"),
            owner: provider.sender().address!!,
            destination: provider.sender().address!!,
            responseDestination: provider.sender().address!!,
            customPayload: comment("custom_payload"),
            forwardAmount: toNano("0.1"),
            forwardPayload: comment("forward_payload"),
        }
    );

    console.log("-------------------------------------")
    console.log("show staking info")
    console.log("-------------------------------------")
    {
        const stakedInfo = await stakingWalletContract.getStakedInfo();
        console.log(`staked TON coin: ${fromNano(stakedInfo.stakedTonAmount)}`);

        for (const jettonWalletAddr of stakedInfo.stakedJettons.keys()) {
            const jettonWallet = provider.open(
                JettonWalletTemplate.fromAddress(jettonWalletAddr)
            );
            const walletData = await jettonWallet.getGetWalletData();

            console.log(`user staked jetton: ${fromNano(stakedInfo.stakedJettons.get(jettonWalletAddr)!!.jettonAmount)}`);
            console.log(`total jetton: ${fromNano(walletData.balance)}`);
        }
    }
}
