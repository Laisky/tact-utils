import { beginCell, toNano } from '@ton/core';
import {
    Blockchain,
    printTransactionFees,
    SandboxContract,
    TreasuryContract
} from '@ton/sandbox';
import '@ton/test-utils';
import { keyPairFromSeed, sign, KeyPair, getSecureRandomBytes } from 'ton-crypto';

import { SampleMaster } from '../build/Sample/tact_SampleMaster';

describe('Jetton', () => {

    let blockchain: Blockchain;
    let admin: SandboxContract<TreasuryContract>;
    let sampleMaster: SandboxContract<SampleMaster>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        admin = await blockchain.treasury('admin');
        sampleMaster = blockchain.openContract(
            await SampleMaster.fromInit(
                admin.address,
            )
        );

        console.log(`admin: ${admin.address}`);
        console.log(`sampleMaster: ${sampleMaster.address}`);
    });

    it("valid signature", async () => {
        const data = Buffer.from('Hello wordl!');
        const dataCell = beginCell().storeBuffer(data).endCell();

        // Create Keypair
        const seed: Buffer = await getSecureRandomBytes(32);
        const keypair: KeyPair = keyPairFromSeed(seed);

        // Sign
        const signature = sign(dataCell.hash(), keypair.secretKey);
        const pubkey: bigint = BigInt('0x' + keypair.publicKey.toString('hex'));

        const tx = await sampleMaster.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false
            },
            {
                $$type: "VerifyDataSignature",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                data: dataCell,
                signature: beginCell().storeBuffer(signature).asSlice(),
                publicKey: pubkey,
            }
        );

        console.log("staking jetton");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: sampleMaster.address,
            success: true,
            op: 0x1e8dbe39,  // VerifyDataSignature
        });
    });

    it("invalid signature", async () => {
        const data = Buffer.from('Hello wordl!');
        const dataCell = beginCell().storeBuffer(data).endCell();

        // Create Keypair
        const seed: Buffer = await getSecureRandomBytes(32);
        const keypair: KeyPair = keyPairFromSeed(seed);

        // Sign
        const signature = sign(dataCell.hash(), keypair.secretKey);

        // Use different keypair
        const seed2: Buffer = await getSecureRandomBytes(32);
        const keypair2: KeyPair = keyPairFromSeed(seed2);
        const pubkey: bigint = BigInt('0x' + keypair2.publicKey.toString('hex'));

        const tx = await sampleMaster.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false
            },
            {
                $$type: "VerifyDataSignature",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                data: dataCell,
                signature: beginCell().storeBuffer(signature).asSlice(),
                publicKey: pubkey,
            }
        );

        console.log("staking jetton");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: sampleMaster.address,
            success: false,
            op: 0x1e8dbe39,  // VerifyDataSignature
        });
    });
});
