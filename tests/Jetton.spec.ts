import { comment, toNano } from '@ton/core';
import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';

import { JettonMasterTemplate, loadTep64TokenData } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';

describe('Jetton', () => {

    let blockchain: Blockchain;
    let masterContract: SandboxContract<JettonMasterTemplate>;
    let ownerJettonWallet: SandboxContract<JettonWalletTemplate>;
    let userJettonWallet: SandboxContract<JettonWalletTemplate>;
    let deployer: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let forwardReceiver: SandboxContract<TreasuryContract>;
    let nJettonOwnerHas: bigint = toNano(Math.random() * 100);

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        forwardReceiver = await blockchain.treasury('forwardReceiver');

        masterContract = blockchain.openContract(
            await JettonMasterTemplate.fromInit(
                deployer.address,
                {
                    $$type: "Tep64TokenData",
                    flag: BigInt(1),
                    content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
                },
            )
        );

        ownerJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                masterContract.address,
                deployer.address,
            )
        );

        userJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                masterContract.address,
                user.address,
            )
        );

        console.log(`masterContract: ${masterContract.address}`);
        console.log(`ownerJettonWallet: ${ownerJettonWallet.address}`);
        console.log(`userJettonWallet: ${userJettonWallet.address}`);
        console.log(`deployer: ${deployer.address}`);
        console.log(`user: ${user.address}`);
        console.log(`forwardReceiver: ${forwardReceiver.address}`);
    });

    it("deploy master contract", async () => {
        const tx = await masterContract.send(
            deployer.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "Deploy",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
            },
        );
        console.log("deploy master contract");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            success: true,
            op: 0x946a98b6,
        });

        const staticTaxFee = await masterContract.getStaticTaxFee()
        expect(staticTaxFee).toEqual(toNano("0.001"));

        const jettonData = await masterContract.getGetJettonData();
        expect(jettonData.totalSupply).toEqual(BigInt(0));
        expect(jettonData.mintable).toBeTruthy();
        expect(jettonData.owner.equals(deployer.address)).toBeTruthy();

        const jettonContent = loadTep64TokenData(jettonData.content.asSlice());
        expect(jettonContent.flag).toEqual(BigInt(1));
        expect(jettonContent.content).toEqual("https://s3.laisky.com/uploads/2024/09/jetton-sample.json");
    });

    it("mint to owner", async () => {
        const tx = await masterContract.send(
            deployer.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "MintJetton",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                amount: nJettonOwnerHas,
                receiver: deployer.address,
                responseDestination: forwardReceiver.address,
                forwardTonAmount: toNano("0.1"),
                forwardPayload: comment("jetton forward msg"),
            },
        );
        console.log("mint to owner");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            success: true,
            op: 0xa593886f,  // MintJetton
        });
        expect(tx.transactions).toHaveTransaction({
            from: masterContract.address,
            to: ownerJettonWallet.address,
            success: true,
            op: 0x178d4519,  // TokenTransferInternal
        });
        expect(tx.transactions).toHaveTransaction({
            from: ownerJettonWallet.address,
            to: forwardReceiver.address,
            success: true,
            op: 0x7362d09c,  // TransferNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: ownerJettonWallet.address,
            to: forwardReceiver.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });

        const jettonData = await ownerJettonWallet.getGetWalletData();
        expect(jettonData.owner.equals(deployer.address)).toBeTruthy();
        expect(jettonData.balance).toEqual(nJettonOwnerHas);
        expect(jettonData.master.equals(masterContract.address)).toBeTruthy();
    });

    it("transfer to user", async () => {
        const tx = await ownerJettonWallet.send(
            deployer.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "TokenTransfer",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                amount: nJettonOwnerHas,
                destination: user.address,
                responseDestination: forwardReceiver.address,
                forwardTonAmount: toNano("0.1"),
                forwardPayload: comment("jetton forward msg"),
                customPayload: null,
            },
        );
        console.log("transfer to user");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: deployer.address,
            to: ownerJettonWallet.address,
            success: true,
            op: 0xf8a7ea5,  // TokenTransfer
        });
        expect(tx.transactions).toHaveTransaction({
            from: ownerJettonWallet.address,
            to: userJettonWallet.address,
            success: true,
            op: 0x178d4519,  // TokenTransferInternal
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: forwardReceiver.address,
            success: true,
            op: 0x7362d09c,  // TransferNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: forwardReceiver.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });

        const jettonMasterData = await masterContract.getGetJettonData();
        expect(jettonMasterData.totalSupply).toEqual(nJettonOwnerHas);

        const ownerJettonData = await ownerJettonWallet.getGetWalletData();
        expect(ownerJettonData.balance).toEqual(BigInt(0));

        const jettonData = await userJettonWallet.getGetWalletData();
        expect(jettonData.owner.equals(user.address)).toBeTruthy();
        expect(jettonData.balance).toEqual(nJettonOwnerHas);
        expect(jettonData.master.equals(masterContract.address)).toBeTruthy();
    });
});
