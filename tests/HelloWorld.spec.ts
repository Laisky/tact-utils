import { comment, toNano } from '@ton/core';
import {
    Blockchain,
    printTransactionFees,
    SandboxContract,
    TreasuryContract
} from '@ton/sandbox';
import '@ton/test-utils';

import { HelloWorld } from '../build/HelloWorld/tact_HelloWorld';
import { HelloWorldV2 } from '../build/HelloWorld/tact_HelloWorldV2';

describe('HelloWorld', () => {

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let contract: SandboxContract<HelloWorld>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        contract = blockchain.openContract(
            await HelloWorld.fromInit(
                deployer.address,
            )
        );
    });

    it('deploy with hello', async () => {
        const tx = await contract.send(
            deployer.getSender(),
            {
                value: toNano('1'),
                bounce: false,
            },
            'hello'
        );
        console.log('deploy with hello');
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: deployer.address,
            to: contract.address,
            success: true,
            op: 0x0,
        })

        expect(tx.transactions).toHaveTransaction({
            from: contract.address,
            to: deployer.address,
            success: true,
            body: comment("hello, owner"),
        })

        const ver = await contract.getVersion();
        expect(ver).toEqual('v1');
    });

    it('hello from anomynous', async () => {
        const anomynous = await blockchain.treasury("anonynous");

        const tx = await contract.send(
            anomynous.getSender(),
            {
                value: toNano('1'),
                bounce: false,
            },
            'hello'
        );
        console.log('hello from anomynous');
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: anomynous.address,
            to: contract.address,
            success: true,
            op: 0x0,
        })

        expect(tx.transactions).toHaveTransaction({
            from: contract.address,
            to: anomynous.address,
            success: true,
            body: comment("hello, world"),
        })
    });

    it('upgrade to v2', async () => {
        const v2Init = await HelloWorldV2.fromInit(
            deployer.address,
        );

        const tx = await contract.send(
            deployer.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "UpgradeContract",
                queryId: BigInt("123"),
                code: v2Init.init!!.code,
                data: null,
                responseDestination: deployer.getSender().address,
            }
        )
        console.log('upgrade to v2');
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: deployer.address,
            to: contract.address,
            success: true,
            op: 0x112a9509,
        })
        expect(tx.transactions).toHaveTransaction({
            from: contract.address,
            to: deployer.address,
            success: true,
            op: 0xd53276db,
        })

        const ver = await contract.getVersion();
        expect(ver).toEqual('v2');
    });

    it('downgrade to v1', async () => {
        const v1Init = await HelloWorld.fromInit(
            deployer.address,
        );

        const tx = await contract.send(
            deployer.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "UpgradeContract",
                queryId: BigInt("123"),
                code: v1Init.init!!.code,
                data: null,
                responseDestination: deployer.getSender().address,
            }
        )
        console.log('downgrade to v1');
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: deployer.address,
            to: contract.address,
            success: true,
            op: 0x112a9509,
        })
        expect(tx.transactions).toHaveTransaction({
            from: contract.address,
            to: deployer.address,
            success: true,
            op: 0xd53276db,
        })

        const ver = await contract.getVersion();
        expect(ver).toEqual('v1');
    });
});
