import { beginCell, Cell, comment, Dictionary, toNano } from '@ton/core';
import {
    Blockchain,
    printTransactionFees,
    SandboxContract,
    TreasuryContract
} from '@ton/sandbox';
import '@ton/test-utils';
import { keyPairFromSeed, sign, KeyPair, getSecureRandomBytes, sha256 } from 'ton-crypto';

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

    it("int to hex", async () => {
        const num = BigInt("26864658293786238469963656558471928520481084212123434372023814007136979246767");
        const expectHex = `${num.toString(16)}`;

        const gotHex = await sampleMaster.getTestInt2hex(num);
        expect(gotHex).toEqual(expectHex);
    });

    it("hash int onchain", async () => {
        const data = 'Hello wordl!';
        const dataCell = beginCell().storeStringTail(data).endCell();

        const gotHash = await sampleMaster.getTestIntHash(dataCell);
        const expectHash = dataCell.hash().toString('hex');

        expect(gotHash).toEqual(expectHash);
    });

    it("hash string onchain", async () => {
        const v1 = "4d2377d0bc3befe8a721e96b13e22d3b4e557024353e69e2b5d0f315ad49aa05";
        const v2 = "551f6c3e8d7ae7d9b3ac53bca9b6f82cff322fb16113820776d14a3f93b93951";

        const gotHash = await sampleMaster.getTestStrHash(v1, v2);
        const expectHash = (await sha256(v1 + v2)).toString('hex');

        console.log(BigInt("0x"+(await sha256(v1 + v2)).toString('hex')));

        expect(gotHash).toEqual(expectHash);
    });

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

    it("merkle offchain", async () => {
        const data = comment('abc');
        const { proofs, root } = await generateMerkleProof(data);

        // verify proofs and root in js
        let hash = data.hash().toString('hex');
        for (let i = 0; i < proofs.length; i++) {
            const left = hash;
            const right = proofs[i];
            console.log(`hash: ${hash}`);
            hash = (await sha256(left + right)).toString('hex');
        }

        console.log(`calculated root: ${hash}`);
        expect(hash).toEqual(root);
    });

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
});
