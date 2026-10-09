import { Address, beginCell, Dictionary, Message, toNano } from '@ton/core';
import { Blockchain, internal } from '@ton/sandbox';
import '@ton/test-utils';
import {
    JettonMasterTemplate,
    MultiMintReceiver,
    storeMultiMint,
    storeMintJetton,
} from '../build/Sample/tact_JettonMasterTemplate';

// This bounded stress case runs locally, not in the default fast hosted suite.
(process.env.RUN_MINT_CAPACITY === '1' ? test : test.skip)(
    '1024 real pending receipts bound state and reject entry 1025 atomically',
    async () => {
        const chain = await Blockchain.create();
        const admin = await chain.treasury('issuer');
        const master = chain.openContract(
            await JettonMasterTemplate.fromInit(admin.address, {
                $$type: 'Tep64TokenData',
                flag: 1n,
                content: 'local-capacity',
            }),
        );
        await master.send(admin.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 1n });
        let maxGas = 0n;
        let firstPrepare: Message | undefined;
        for (let batch = 0; batch < 64; batch++) {
            const receivers = Dictionary.empty<number, MultiMintReceiver>();
            for (let i = 0; i < 16; i++) {
                const address = new Address(0, Buffer.from((batch * 16 + i + 1).toString(16).padStart(64, '0'), 'hex'));
                receivers.set(i, {
                    $$type: 'MultiMintReceiver',
                    receiver: address,
                    amount: 1n,
                    tonAmount: toNano('0.3'),
                    responseDestination: admin.address,
                    forwardAmount: 0n,
                    forwardPayload: null,
                });
            }
            const tx = await (
                await chain.getContract(master.address)
            ).receiveMessage(
                internal({
                    from: admin.address,
                    to: master.address,
                    value: toNano('10'),
                    body: beginCell()
                        .store(
                            storeMultiMint({
                                $$type: 'MultiMint',
                                queryId: BigInt(batch + 1),
                                receivers,
                                receiverCount: 16n,
                            }),
                        )
                        .endCell(),
                }),
            );
            expect(tx.description.type === 'generic' && tx.description.aborted).toBe(false);
            if (batch === 0)
                firstPrepare = [...tx.outMessages.values()].find(
                    (m) => m.body.bits.length >= 32 && m.body.beginParse().preloadUint(32) === 0x4d505250,
                );

            if (tx.description.type === 'generic' && tx.description.computePhase.type === 'vm') {
                maxGas = tx.description.computePhase.gasUsed > maxGas ? tx.description.computePhase.gasUsed : maxGas;
                expect(tx.description.computePhase.gasUsed).toBeLessThan(16n * 120000n);
            }
        }
        expect((await master.getMintStatus()).pendingCount).toBe(1024n);
        expect((await master.getGetJettonData()).totalSupply).toBe(0n);
        const next = await (
            await chain.getContract(master.address)
        ).receiveMessage(
            internal({
                from: admin.address,
                to: master.address,
                value: toNano('1'),
                body: beginCell()
                    .store(
                        storeMintJetton({
                            $$type: 'MintJetton',
                            queryId: 1025n,
                            amount: 1n,
                            receiver: admin.address,
                            responseDestination: admin.address,
                            forwardAmount: 0n,
                            forwardPayload: null,
                        }),
                    )
                    .endCell(),
            }),
        );
        expect(next.description.type === 'generic' && next.description.aborted).toBe(true);
        expect((await master.getMintStatus()).pendingCount).toBe(1024n);
        expect((await master.getMintStatus()).lastOperationId).toBe(1024n);

        // Deliver an actual retained prepare at full state, then its native
        // ACK/commit/settlement. Capacity must be reclaimable, not only bounded.
        let message = firstPrepare!;
        for (const op of [0x4d41434b, 0x4d434d54, 0x4d534554, 0xd53276db]) {
            if (message.info.type !== 'internal') throw new Error('Expected internal receipt');
            const tx = await (await chain.getContract(message.info.dest)).receiveMessage(message);
            expect(tx.description.type === 'generic' && tx.description.aborted).toBe(false);
            if (tx.description.type === 'generic' && tx.description.computePhase.type === 'vm') {
                expect(tx.description.computePhase.gasUsed).toBeLessThanOrEqual(120000n);
            }
            message = [...tx.outMessages.values()].find(
                (m) => m.body.bits.length >= 32 && m.body.beginParse().preloadUint(32) === op,
            )!;
            expect(message).toBeDefined();
        }
        expect((await master.getMintStatus()).pendingCount).toBe(1023n);
        const replacement = await (await chain.getContract(master.address)).receiveMessage(next.inMessage!);
        expect(replacement.description.type === 'generic' && replacement.description.aborted).toBe(false);
        expect((await master.getMintStatus()).pendingCount).toBe(1024n);
        expect((await master.getMintStatus()).lastOperationId).toBe(1025n);
        expect((await master.getGetJettonData()).totalSupply).toBe(1n);
        console.log('MINT_CAPACITY_GAS', maxGas.toString());
    },
    240000,
);
