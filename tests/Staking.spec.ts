import { beginCell, comment, Dictionary, toNano } from '@ton/core';
import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { StakeReleaseJettonInfo, StakingMasterTemplate, storeStakeJetton } from '../build/Staking/tact_StakingMasterTemplate';
import { StakingWalletTemplate } from '../build/Staking/tact_StakingWalletTemplate';

describe('Staking', () => {

    let blockchain: Blockchain;

    let stakeMasterContract: SandboxContract<StakingMasterTemplate>;
    let jettonMasterContract: SandboxContract<JettonMasterTemplate>;
    let stakeJettonWallet: SandboxContract<JettonWalletTemplate>;
    let userStakeWallet: SandboxContract<StakingWalletTemplate>;
    let userJettonWallet: SandboxContract<JettonWalletTemplate>;

    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');

        jettonMasterContract = blockchain.openContract(
            await JettonMasterTemplate.fromInit(
                admin.address,
                {
                    $$type: "Tep64TokenData",
                    flag: BigInt(1),
                    content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
                },
            )
        );

        stakeMasterContract = blockchain.openContract(
            await StakingMasterTemplate.fromInit(
                admin.address,
            )
        );

        userStakeWallet = blockchain.openContract(
            await StakingWalletTemplate.fromInit(
                stakeMasterContract.address,
                user.address,
            )
        );

        stakeJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                jettonMasterContract.address,
                stakeMasterContract.address,
            )
        );

        userJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                jettonMasterContract.address,
                user.address,
            )
        );

        console.log(`admin: ${admin.address}`);
        console.log(`user: ${user.address}`);
        console.log(`stakeMasterContract: ${stakeMasterContract.address}`);
        console.log(`jettonMasterContract: ${jettonMasterContract.address}`);
        console.log(`userStakeWallet: ${userStakeWallet.address}`);
        console.log(`stakeJettonWallet: ${stakeJettonWallet.address}`);
        console.log(`userJettonWallet: ${userJettonWallet.address}`);
    });

    it("prepare staking contracts", async () => {
        const tx = await stakeMasterContract.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "StakeDeployUserWallet",
                queryId: BigInt(Math.ceil(Math.random() * 1000000)),
                owner: user.address,
                responseDestination: admin.address,
            }
        );
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: stakeMasterContract.address,
            success: true,
            op: 0x70b40d3f,  // StakeDeployUserWallet
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeMasterContract.address,
            to: userStakeWallet.address,
            success: true,
            op: 0x70b40d3f,  // StakeDeployUserWallet
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: admin.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });
    });

    it("prepare jetton", async () => {
        const tx = await jettonMasterContract.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "MintJetton",
                queryId: BigInt(Math.ceil(Math.random() * 1000000)),
                amount: toNano("10"),
                receiver: user.address,
                responseDestination: admin.address,
                forwardTonAmount: toNano("0"),
                forwardPayload: null,
            }
        );
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        console.log(`jettonMasterContract deployed at ${jettonMasterContract.address}`);
        console.log(`userJettonWallet: ${userJettonWallet.address}`);

        expect(tx.transactions).toHaveTransaction({
            from: jettonMasterContract.address,
            to: userJettonWallet.address,
            success: true,
            op: 0x178d4519,  // TokenTransferInternal
        });
    });

    it("staking toncoin", async () => {
        const userStakeAddr = await stakeMasterContract.getUserWallet(user.address);
        expect(userStakeAddr.equals(userStakeWallet.address)).toBeTruthy();

        const tx = await stakeMasterContract.send(
            user.getSender(),
            {
                value: toNano("2"),
                bounce: false,
            },
            {
                $$type: "StakeToncoin",
                queryId: BigInt(Math.ceil(Math.random() * 1000000)),
                amount: toNano("0.5"),
                responseDestination: user.address,
                forwardTonAmount: toNano("0.1"),
                forwardPayload: comment("forward_payload"),
            }
        );
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: user.address,
            to: stakeMasterContract.address,
            success: true,
            op: 0x7ac4404c,  // StakeToncoin
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeMasterContract.address,
            to: userStakeWallet.address,
            success: true,
            op: 0x7ac4404c,  // StakeToncoin
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: user.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: user.address,
            success: true,
            op: 0x2c7981f1,  // StakeNotification
        });

        const userStakedInfo = await userStakeWallet.getStakedInfo();
        expect(userStakedInfo.stakedTonAmount).toEqual(toNano("0.5"));
    });

    it("staking jetton", async () => {
        const tx = await userJettonWallet.send(
            user.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "TokenTransfer",
                queryId: BigInt(Math.ceil(Math.random() * 1000000)),
                amount: toNano("1"),
                destination: stakeMasterContract.address,
                responseDestination: userStakeWallet.address,
                forwardTonAmount: toNano("0.5"),
                forwardPayload: beginCell()
                    .store(storeStakeJetton({
                        $$type: "StakeJetton",
                        tonAmount: toNano("0.1"),
                        responseDestination: user.address,
                        forwardTonAmount: toNano("0.1"),
                        forwardPayload: comment("forward_payload"),
                    }))
                    .endCell(),
                customPayload: null,
            }
        );
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: user.address,
            to: userJettonWallet.address,
            success: true,
            op: 0xf8a7ea5,  // TokenTransfer
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: stakeJettonWallet.address,
            success: true,
            op: 0x178d4519,  // TokenTransferInternal
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeJettonWallet.address,
            to: userStakeWallet.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: user.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeJettonWallet.address,
            to: userStakeWallet.address,
            success: true,
            op: 0x7362d09c,  // TransferNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: user.address,
            success: true,
            op: 0x2c7981f1,  // StakeNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: stakeMasterContract.address,
            success: true,
            op: 0xa576751e,  // StakeInternal
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeMasterContract.address,
            to: user.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });

        const userStakedInfo = await userStakeWallet.getStakedInfo();
        expect(userStakedInfo.stakedTonAmount).toEqual(toNano("0.6"));
        expect(userStakedInfo.stakedJettons.get(stakeJettonWallet.address)!!.jettonAmount).toEqual(toNano("1"));
    });

    it("release", async () => {
        let releaseJettons = Dictionary.empty<bigint, StakeReleaseJettonInfo>();
        releaseJettons.set(BigInt("0"), {
            $$type: "StakeReleaseJettonInfo",
            tonAmount: toNano("0.2"),
            jettonAmount: toNano("1"),
            jettonWallet: stakeJettonWallet.address,
            forwardTonAmount: toNano("0.1"),
            destination: user.address,
            customPayload: null,
            forwardPayload: comment("forward_payload"),
        });

        const tx = await userStakeWallet.send(
            user.getSender(),
            {
                value: toNano("2"),
                bounce: false,
            },
            {
                $$type: "StakeRelease",
                queryId: BigInt(Math.ceil(Math.random() * 1000000)),
                owner: user.address,
                amount: toNano("0.5"),
                jettons: releaseJettons,
                jettonsIdx: BigInt('1'),
                destination: user.address,
                responseDestination: user.address,
                customPayload: comment("custom_payload"),
                forwardPayload: comment("forward_payload"),
                forwardTonAmount: toNano("0.1"),
            }
        );
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: user.address,
            to: userStakeWallet.address,
            success: true,
            op: 0x51fa3a81,  // StakeRelease
        });
        expect(tx.transactions).toHaveTransaction({
            from: userStakeWallet.address,
            to: stakeMasterContract.address,
            success: true,
            op: 0x51fa3a81,  // StakeRelease
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeMasterContract.address,
            to: user.address,
            success: true,
            op: 0xe656dfa2,  // StakeReleaseNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeMasterContract.address,
            to: user.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeMasterContract.address,
            to: stakeJettonWallet.address,
            success: true,
            op: 0xf8a7ea5,  // TokenTransfer
        });
        expect(tx.transactions).toHaveTransaction({
            from: stakeJettonWallet.address,
            to: userJettonWallet.address,
            success: true,
            op: 0x178d4519,  // TokenTransferInternal
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: user.address,
            success: true,
            op: 0x7362d09c,  // TransferNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: user.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });

        const userStakedInfo = await userStakeWallet.getStakedInfo();
        expect(userStakedInfo.stakedTonAmount).toEqual(toNano("0.1"));
        expect(userStakedInfo.stakedJettons.get(stakeJettonWallet.address)!!.jettonAmount).toEqual(toNano("0"));
    });
});
