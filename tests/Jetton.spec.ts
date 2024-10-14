import { comment, toNano } from '@ton/core';
import {
    Blockchain,
    printTransactionFees,
    SandboxContract,
    TreasuryContract
} from '@ton/sandbox';
import '@ton/test-utils';

import { JettonMasterTemplate, loadTep64TokenData } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';

describe('Jetton', () => {

    let blockchain: Blockchain;
    let jettonMasterContract: SandboxContract<JettonMasterTemplate>;
    let ownerJettonWallet: SandboxContract<JettonWalletTemplate>;
    let userJettonWallet: SandboxContract<JettonWalletTemplate>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let forwardReceiver: SandboxContract<TreasuryContract>;
    let nJettonOwnerHas: bigint = toNano(Math.random() * 100);

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');
        forwardReceiver = await blockchain.treasury('forwardReceiver');

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

        ownerJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                jettonMasterContract.address,
                admin.address,
            )
        );

        userJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                jettonMasterContract.address,
                user.address,
            )
        );

        console.log(`jettonMasterContract: ${jettonMasterContract.address}`);
        console.log(`ownerJettonWallet: ${ownerJettonWallet.address}`);
        console.log(`userJettonWallet: ${userJettonWallet.address}`);
        console.log(`admin: ${admin.address}`);
        console.log(`user: ${user.address}`);
        console.log(`forwardReceiver: ${forwardReceiver.address}`);
    });

    it("signature for contracts code", async () => {
        const codeHash1 = ownerJettonWallet.init!!.code.hash();
        const codeHash2 = userJettonWallet.init!!.code.hash();
        expect(codeHash1.equals(codeHash2)).toBeTruthy();

        const dataHash1 = ownerJettonWallet.init!!.data.hash();
        const dataHash2 = userJettonWallet.init!!.data.hash();
        expect(dataHash1.equals(dataHash2)).toBeFalsy();
    });

    it("deploy master contract", async () => {
        const tx = await jettonMasterContract.send(
            admin.getSender(),
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
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: jettonMasterContract.address,
            success: true,
            op: 0x946a98b6,
        });

        const staticTax = await jettonMasterContract.getStaticTax()
        expect(staticTax).toEqual(toNano("0.001"));

        const jettonData = await jettonMasterContract.getGetJettonData();
        expect(jettonData.totalSupply).toEqual(BigInt(0));
        expect(jettonData.mintable).toBeTruthy();
        expect(jettonData.owner.equals(admin.address)).toBeTruthy();

        const jettonContent = loadTep64TokenData(jettonData.content.asSlice());
        expect(jettonContent.flag).toEqual(BigInt(1));
        expect(jettonContent.content).toEqual("https://s3.laisky.com/uploads/2024/09/jetton-sample.json");
    });

    it("mint to owner", async () => {
        const tx = await jettonMasterContract.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "MintJetton",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                amount: nJettonOwnerHas,
                receiver: admin.address,
                responseDestination: forwardReceiver.address,
                forwardAmount: toNano("0.1"),
                forwardPayload: comment("jetton forward msg"),
            },
        );
        console.log("mint to owner");
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: jettonMasterContract.address,
            success: true,
            op: 0xa593886f,  // MintJetton
        });
        expect(tx.transactions).toHaveTransaction({
            from: jettonMasterContract.address,
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
        expect(jettonData.owner.equals(admin.address)).toBeTruthy();
        expect(jettonData.balance).toEqual(nJettonOwnerHas);
        expect(jettonData.master.equals(jettonMasterContract.address)).toBeTruthy();
    });

    it("transfer to user", async () => {
        const tx = await ownerJettonWallet.send(
            admin.getSender(),
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
                forwardAmount: toNano("0.1"),
                forwardPayload: comment("jetton forward msg"),
                customPayload: null,
            },
        );
        console.log("transfer to user");
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
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

        const jettonMasterData = await jettonMasterContract.getGetJettonData();
        expect(jettonMasterData.totalSupply).toEqual(nJettonOwnerHas);

        const ownerJettonData = await ownerJettonWallet.getGetWalletData();
        expect(ownerJettonData.balance).toEqual(BigInt(0));

        const jettonData = await userJettonWallet.getGetWalletData();
        expect(jettonData.owner.equals(user.address)).toBeTruthy();
        expect(jettonData.balance).toEqual(nJettonOwnerHas);
        expect(jettonData.master.equals(jettonMasterContract.address)).toBeTruthy();
    });

    it("burn from user", async () => {
        const tx = await userJettonWallet.send(
            user.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "Burn",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                amount: nJettonOwnerHas,
                responseDestination: forwardReceiver.address,
                customPayload: null,
            },
        );
        console.log("burn from user");
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: user.address,
            to: userJettonWallet.address,
            success: true,
            op: 0x595f07bc,  // Burn
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: jettonMasterContract.address,
            success: true,
            op: 0x7bdd97de,  // TokenBurnNotification
        });
        expect(tx.transactions).toHaveTransaction({
            from: jettonMasterContract.address,
            to: forwardReceiver.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });

        const jettonMasterData = await jettonMasterContract.getGetJettonData();
        expect(jettonMasterData.totalSupply).toEqual(BigInt(0));

        const jettonData = await userJettonWallet.getGetWalletData();
        expect(jettonData.owner.equals(user.address)).toBeTruthy();
        expect(jettonData.balance).toEqual(BigInt(0));
        expect(jettonData.master.equals(jettonMasterContract.address)).toBeTruthy();
    });

    it("withdraw by unauthorized user", async () => {
        const balanceBefore = await userJettonWallet.getBalance();

        const tx = await userJettonWallet.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: true,
            },
            "withdraw",
        );
        console.log("withdraw by unauthorized user");
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: userJettonWallet.address,
            success: false,
        });

        const balance = await userJettonWallet.getBalance();
        expect(balance).toEqual(balanceBefore);
    });

    it("user withdraw", async () => {
        const tx = await userJettonWallet.send(
            user.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            "withdraw",
        );
        console.log("withdraw");
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: user.address,
            to: userJettonWallet.address,
            success: true,
        });
        expect(tx.transactions).toHaveTransaction({
            from: userJettonWallet.address,
            to: user.address,
            success: true,
            op: 0xd53276db,  // Excesses
        });

        const balance = await userJettonWallet.getBalance();
        expect(balance).toEqual(toNano("0"));
    });
});
