import { Address, beginCell, Cell, Dictionary, Message, toNano } from '@ton/core';
import { Blockchain, internal, SmartContractTransaction } from '@ton/sandbox';
import '@ton/test-utils';
import {
    JettonMasterTemplate,
    MultiMintReceiver,
    storeMintJetton,
    storeMintAccepted,
    storeMintSettled,
    storeRetryMint,
} from '../build/Sample/tact_JettonMasterTemplate';
import {
    JettonWalletTemplate,
    storeMintCommit,
    storeTokenTransfer,
    storeBurn,
} from '../build/Sample/tact_JettonWalletTemplate';

const PREPARE = 0x4d505250;
const ACCEPTED = 0x4d41434b;
const COMMIT = 0x4d434d54;
const SETTLED = 0x4d534554;
// Protocol interleavings and fee qualification are local/manual, not hosted CI.
const receiptTest = process.env.RUN_MINT_RECEIPTS === '1' ? test : test.skip;

async function fixture() {
    const chain = await Blockchain.create();
    const admin = await chain.treasury('issuer');
    const receiver = await chain.treasury('recipient');
    const other = await chain.treasury('other');
    const master = chain.openContract(
        await JettonMasterTemplate.fromInit(admin.address, {
            $$type: 'Tep64TokenData',
            flag: 1n,
            content: 'local-test',
        }),
    );
    const wallet = chain.openContract(await JettonWalletTemplate.fromInit(master.address, receiver.address));
    await master.send(admin.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 1n });
    return { chain, admin, receiver, other, master, wallet };
}
function mint(receiver: Address, issuer: Address, queryId = 3n) {
    return {
        $$type: 'MintJetton' as const,
        queryId,
        amount: 100n,
        receiver,
        responseDestination: issuer,
        forwardAmount: 0n,
        forwardPayload: null,
    };
}
function outbound(tx: SmartContractTransaction, op: number): Message {
    const messages = [...tx.outMessages.values()].filter(
        (x) => x.body.bits.length >= 32 && x.body.beginParse().preloadUint(32) === op,
    );
    expect(messages).toHaveLength(1);
    return messages[0];
}
async function execute(chain: Blockchain, message: Message) {
    if (message.info.type !== 'internal') throw new Error('Expected a native internal message');
    return (await chain.getContract(message.info.dest)).receiveMessage(message);
}
async function start(f: Awaited<ReturnType<typeof fixture>>) {
    const tx = await execute(
        f.chain,
        internal({
            from: f.admin.address,
            to: f.master.address,
            value: toNano('1'),
            body: beginCell()
                .store(storeMintJetton(mint(f.receiver.address, f.admin.address)))
                .endCell(),
        }),
    );
    return outbound(tx, PREPARE);
}

receiptTest('high-tax rejection never finalizes supply and returns recoverable TON', async () => {
    const f = await fixture();
    await f.wallet.send(f.receiver.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 2n });
    await f.wallet.send(
        f.receiver.getSender(),
        { value: toNano('0.1') },
        { $$type: 'SetStaticTax', staticTax: toNano('10') },
    );
    const before = (await f.chain.getContract(f.wallet.address)).balance;
    const result = await f.master.send(
        f.admin.getSender(),
        { value: toNano('1') },
        mint(f.receiver.address, f.admin.address),
    );
    expect(result.transactions).toHaveTransaction({
        from: f.master.address,
        to: f.wallet.address,
        success: false,
        exitCode: 50001,
    });
    expect(result.transactions).toHaveTransaction({
        from: f.wallet.address,
        to: f.master.address,
        inMessageBounced: true,
        success: true,
    });
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    expect((await f.chain.getContract(f.wallet.address)).balance).toBeLessThanOrEqual(before);
});

receiptTest('mixed batch finalizes only its successful independent receipt', async () => {
    const f = await fixture();
    const good = f.chain.openContract(await JettonWalletTemplate.fromInit(f.master.address, f.other.address));
    await f.wallet.send(f.receiver.getSender(), { value: toNano('0.1') }, { $$type: 'Deploy', queryId: 2n });
    await f.wallet.send(
        f.receiver.getSender(),
        { value: toNano('0.1') },
        { $$type: 'SetStaticTax', staticTax: toNano('10') },
    );
    const receivers = Dictionary.empty<number, MultiMintReceiver>();
    for (const [i, receiver, amount] of [
        [0, f.other.address, 100n],
        [1, f.receiver.address, 200n],
    ] as const) {
        receivers.set(i, {
            $$type: 'MultiMintReceiver',
            receiver,
            amount,
            tonAmount: toNano('0.3'),
            responseDestination: f.admin.address,
            forwardAmount: 0n,
            forwardPayload: null,
        });
    }
    const result = await f.master.send(
        f.admin.getSender(),
        { value: toNano('1') },
        { $$type: 'MultiMint', queryId: 3n, receivers, receiverCount: 2n },
    );
    expect(result.transactions).toHaveTransaction({
        from: f.master.address,
        to: good.address,
        success: true,
        op: PREPARE,
    });
    expect(result.transactions).toHaveTransaction({
        from: f.master.address,
        to: f.wallet.address,
        success: false,
        exitCode: 50001,
    });
    expect((await good.getGetWalletData()).balance).toBe(100n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('normal fresh-wallet mint completes with bounded delivery and issuer excess', async () => {
    const f = await fixture();
    const budget = await f.master.getMintBudget(f.receiver.address, 0n, null);
    const result = await f.master.send(
        f.admin.getSender(),
        { value: toNano('10') },
        mint(f.receiver.address, f.admin.address),
    );
    const tx = result.transactions.find(
        (x) =>
            x.inMessage?.info.type === 'internal' &&
            x.inMessage.info.dest.equals(f.master.address) &&
            x.inMessage.info.src.equals(f.admin.address),
    )!;
    const prepare = outbound(tx, PREPARE);
    expect(prepare.info.type === 'internal' && prepare.info.value.coins).toBe(budget);
    expect(result.transactions).toHaveTransaction({
        from: f.master.address,
        to: f.admin.address,
        op: 0xd53276db,
        success: true,
    });
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    expect((await f.wallet.getMintStatus()).lockedAmount).toBe(0n);
});

receiptTest('underfunded mint rolls back without an outbound delivery', async () => {
    const f = await fixture();
    const result = await f.master.send(
        f.admin.getSender(),
        { value: toNano('0.005') },
        mint(f.receiver.address, f.admin.address),
    );
    expect(result.transactions).toHaveTransaction({ from: f.admin.address, to: f.master.address, success: false });
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    expect(result.transactions).not.toHaveTransaction({ to: f.wallet.address });
});

receiptTest('prepared credit cannot transfer or burn before master confirmation', async () => {
    const f = await fixture();
    const prepare = await start(f);
    const accepted = outbound(await execute(f.chain, prepare), ACCEPTED);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    expect((await f.wallet.getMintStatus()).lockedAmount).toBe(100n);
    for (const body of [
        beginCell()
            .store(
                storeBurn({
                    $$type: 'Burn',
                    queryId: 9n,
                    amount: 100n,
                    responseDestination: f.admin.address,
                    customPayload: null,
                }),
            )
            .endCell(),
        beginCell()
            .store(
                storeTokenTransfer({
                    $$type: 'TokenTransfer',
                    queryId: 9n,
                    amount: 100n,
                    destination: f.other.address,
                    responseDestination: f.admin.address,
                    forwardAmount: 0n,
                    forwardPayload: null,
                    customPayload: null,
                }),
            )
            .endCell(),
    ]) {
        const tx = await execute(
            f.chain,
            internal({ from: f.receiver.address, to: f.wallet.address, value: toNano('0.1'), body }),
        );
        expect(tx.description.type === 'generic' && tx.description.aborted).toBe(true);
        expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    }
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    const settled = outbound(await execute(f.chain, commit), SETTLED);
    await execute(f.chain, settled);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('duplicate genuine acknowledgements and commits credit and finalize once', async () => {
    const f = await fixture();
    const prepare = await start(f);
    const accepted1 = outbound(await execute(f.chain, prepare), ACCEPTED);
    const retry = await execute(
        f.chain,
        internal({
            from: f.admin.address,
            to: f.master.address,
            value: toNano('1'),
            body: beginCell()
                .store(storeRetryMint({ $$type: 'RetryMint', operationId: 1n }))
                .endCell(),
        }),
    );
    const accepted2 = outbound(await execute(f.chain, outbound(retry, PREPARE)), ACCEPTED);
    const commit1 = outbound(await execute(f.chain, accepted1), COMMIT);
    const commit2 = outbound(await execute(f.chain, accepted2), COMMIT);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    const settled1 = outbound(await execute(f.chain, commit1), SETTLED);
    const settled2 = outbound(await execute(f.chain, commit2), SETTLED);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
    await execute(f.chain, settled1);
    const duplicate = await execute(f.chain, settled2);
    expect(duplicate.description.type === 'generic' && duplicate.description.aborted).toBe(true);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('burn after commit but before settlement safely reduces finalized supply', async () => {
    const f = await fixture();
    const accepted = outbound(await execute(f.chain, await start(f)), ACCEPTED);
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    const settled = outbound(await execute(f.chain, commit), SETTLED);
    const burn = await execute(
        f.chain,
        internal({
            from: f.receiver.address,
            to: f.wallet.address,
            value: toNano('0.1'),
            body: beginCell()
                .store(
                    storeBurn({
                        $$type: 'Burn',
                        queryId: 9n,
                        amount: 100n,
                        responseDestination: f.admin.address,
                        customPayload: null,
                    }),
                )
                .endCell(),
        }),
    );
    await execute(f.chain, outbound(burn, 0x7bdd97de));
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    await execute(f.chain, settled);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('unrelated treasury acknowledgements and commits cannot change supply or balance', async () => {
    const f = await fixture();
    const accepted = outbound(await execute(f.chain, await start(f)), ACCEPTED);
    for (const body of [
        beginCell()
            .store(storeMintAccepted({ $$type: 'MintAccepted', operationId: 1n, amount: 100n }))
            .endCell(),
        beginCell()
            .store(storeMintSettled({ $$type: 'MintSettled', operationId: 1n, amount: 100n }))
            .endCell(),
    ]) {
        const tx = await execute(
            f.chain,
            internal({ from: f.other.address, to: f.master.address, value: toNano('0.1'), body }),
        );
        expect(tx.description.type === 'generic' && tx.description.aborted).toBe(true);
    }
    const forgedCommit = await execute(
        f.chain,
        internal({
            from: f.other.address,
            to: f.wallet.address,
            value: toNano('0.1'),
            body: beginCell()
                .store(storeMintCommit({ $$type: 'MintCommit', operationId: 1n, amount: 100n }))
                .endCell(),
        }),
    );
    expect(forgedCommit.description.type === 'generic' && forgedCommit.description.aborted).toBe(true);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    await execute(f.chain, outbound(await execute(f.chain, commit), SETTLED));
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
});

receiptTest('wallet tax changes after prepare cannot block confirmation or settlement', async () => {
    const f = await fixture();
    const accepted = outbound(await execute(f.chain, await start(f)), ACCEPTED);
    await f.wallet.send(
        f.receiver.getSender(),
        { value: toNano('0.1') },
        { $$type: 'SetStaticTax', staticTax: toNano('10') },
    );
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    const settled = outbound(await execute(f.chain, commit), SETTLED);
    await execute(f.chain, settled);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('failed duplicate prepare cannot cancel an earlier durable prepared credit', async () => {
    const f = await fixture();
    const accepted = outbound(await execute(f.chain, await start(f)), ACCEPTED);
    const retry = await execute(
        f.chain,
        internal({
            from: f.admin.address,
            to: f.master.address,
            value: toNano('1'),
            body: beginCell()
                .store(storeRetryMint({ $$type: 'RetryMint', operationId: 1n }))
                .endCell(),
        }),
    );
    await f.wallet.send(
        f.receiver.getSender(),
        { value: toNano('0.1') },
        { $$type: 'SetStaticTax', staticTax: toNano('10') },
    );
    const rejection = await execute(f.chain, outbound(retry, PREPARE));
    expect(rejection.description.type === 'generic' && rejection.description.aborted).toBe(true);
    const bounce = [...rejection.outMessages.values()].find((m) => m.info.type === 'internal' && m.info.bounced)!;
    expect(bounce).toBeDefined();
    await execute(f.chain, bounce);
    expect((await f.master.getMintStatus()).pendingCount).toBe(1n);
    expect((await f.wallet.getMintStatus()).lockedAmount).toBe(100n);
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    await execute(f.chain, outbound(await execute(f.chain, commit), SETTLED));
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
});

receiptTest('genuine bounced acknowledgement retains locked credit and funded retry recovers', async () => {
    const f = await fixture();
    const accepted = outbound(await execute(f.chain, await start(f)), ACCEPTED);
    // Temporarily lower the native basechain compute limit. The executor,
    // rather than a hand-crafted message, must generate this compute bounce.
    const originalConfig = f.chain.config;
    const config = Dictionary.loadDirect(
        Dictionary.Keys.Int(32),
        Dictionary.Values.Cell(),
        originalConfig.beginParse(),
    );
    const gas = config.get(21)!.beginParse();
    expect(gas.preloadUint(8)).toBe(0xd1);
    const prefix = gas.loadBits(208); // flat prices + gas tag + gas price
    gas.loadUintBig(64);
    config.set(21, beginCell().storeBits(prefix).storeUint(1000, 64).storeSlice(gas).endCell());
    f.chain.setConfig(beginCell().storeDictDirect(config).endCell());
    const failure = await execute(f.chain, accepted);
    f.chain.setConfig(originalConfig);
    expect(failure.description.type === 'generic' && failure.description.aborted).toBe(true);
    const bounce = [...failure.outMessages.values()].find((m) => m.info.type === 'internal' && m.info.bounced)!;
    expect(bounce).toBeDefined();
    await execute(f.chain, bounce);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(0n);
    expect((await f.wallet.getMintStatus()).lockedAmount).toBe(100n);
    const result = await f.master.send(
        f.admin.getSender(),
        { value: toNano('1') },
        { $$type: 'RetryMint', operationId: 1n },
    );
    expect(result.transactions).toHaveTransaction({ to: f.wallet.address, op: COMMIT, success: true });
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('repeated caller query IDs still allocate distinct operations after settlement', async () => {
    const f = await fixture();
    for (let i = 1n; i <= 2n; i++) {
        await f.master.send(f.admin.getSender(), { value: toNano('1') }, mint(f.receiver.address, f.admin.address, 7n));
        expect((await f.master.getMintStatus()).lastOperationId).toBe(i);
        expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
        expect((await f.wallet.getMintStatus()).lastSettledId).toBe(i);
    }
    expect((await f.master.getGetJettonData()).totalSupply).toBe(200n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(200n);
});

receiptTest('duplicate batch wallet and oversized payload fail atomically', async () => {
    const f = await fixture();
    const receivers = Dictionary.empty<number, MultiMintReceiver>();
    for (let i = 0; i < 2; i++)
        receivers.set(i, {
            $$type: 'MultiMintReceiver',
            receiver: f.receiver.address,
            amount: 100n,
            tonAmount: toNano('0.3'),
            responseDestination: f.admin.address,
            forwardAmount: 0n,
            forwardPayload: null,
        });
    const duplicate = await f.master.send(
        f.admin.getSender(),
        { value: toNano('1') },
        { $$type: 'MultiMint', queryId: 9n, receivers, receiverCount: 2n },
    );
    expect(duplicate.transactions).toHaveTransaction({ to: f.master.address, success: false, exitCode: 50108 });
    expect(duplicate.transactions).not.toHaveTransaction({ to: f.wallet.address });
    let payload = beginCell().storeUint(0, 8).endCell();
    for (let i = 1; i <= 32; i++) payload = beginCell().storeUint(i, 8).storeRef(payload).endCell();
    const oversized = await f.master.send(
        f.admin.getSender(),
        { value: toNano('1') },
        { ...mint(f.receiver.address, f.admin.address), forwardPayload: payload },
    );
    expect(oversized.transactions).toHaveTransaction({ to: f.master.address, success: false });
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    expect((await f.master.getMintStatus()).lastOperationId).toBe(0n);
});

receiptTest('normal and rejected automatic flows conserve TON net of native executor fees', async () => {
    for (const reject of [false, true]) {
        const f = await fixture();
        await f.wallet.send(f.receiver.getSender(), { value: toNano('0.5') }, { $$type: 'Deploy', queryId: 2n });
        if (reject)
            await f.wallet.send(
                f.receiver.getSender(),
                { value: toNano('0.1') },
                { $$type: 'SetStaticTax', staticTax: toNano('10') },
            );
        const addresses = [f.admin.address, f.master.address, f.wallet.address];
        const balance = async () =>
            (await Promise.all(addresses.map(async (a) => (await f.chain.getContract(a)).balance))).reduce(
                (a, b) => a + b,
                0n,
            );
        const before = await balance();
        const result = await f.master.send(
            f.admin.getSender(),
            { value: toNano('10') },
            mint(f.receiver.address, f.admin.address),
        );
        const fees = result.transactions.reduce((total, tx) => {
            const action = tx.description.type === 'generic' ? tx.description.actionPhase : undefined;
            const bounce = tx.description.type === 'generic' ? tx.description.bouncePhase : undefined;
            return (
                total +
                tx.totalFees.coins +
                (action?.totalFwdFees ?? 0n) -
                (action?.totalActionFees ?? 0n) +
                (bounce?.type === 'ok' ? bounce.forwardFees : 0n)
            );
        }, 0n);
        expect(before - (await balance())).toBe(fees);
        for (const tx of result.transactions) {
            if (
                tx.description.type === 'generic' &&
                tx.description.computePhase.type === 'vm' &&
                tx.inMessage?.info.type === 'internal' &&
                (tx.inMessage.info.dest.equals(f.master.address) || tx.inMessage.info.dest.equals(f.wallet.address))
            ) {
                expect(tx.description.computePhase.gasUsed).toBeLessThanOrEqual(120000n);
            }
        }
    }
});

receiptTest('transfer after confirmation before settlement spends only finalized credit', async () => {
    const f = await fixture();
    const accepted = outbound(await execute(f.chain, await start(f)), ACCEPTED);
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    const settled = outbound(await execute(f.chain, commit), SETTLED);
    const transfer = await f.wallet.send(
        f.receiver.getSender(),
        { value: toNano('1') },
        {
            $$type: 'TokenTransfer',
            queryId: 3n,
            amount: 100n,
            destination: f.other.address,
            responseDestination: f.admin.address,
            forwardAmount: 0n,
            forwardPayload: null,
            customPayload: null,
        },
    );
    const peer = f.chain.openContract(await JettonWalletTemplate.fromInit(f.master.address, f.other.address));
    expect(transfer.transactions).toHaveTransaction({ to: peer.address, op: 0x178d4519, success: true });
    expect((await peer.getGetWalletData()).balance).toBe(100n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(0n);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    await execute(f.chain, settled);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
});

receiptTest('unauthorized mint and retry cannot allocate or change durable receipts', async () => {
    const f = await fixture();
    const rejected = await f.master.send(
        f.other.getSender(),
        { value: toNano('1') },
        mint(f.receiver.address, f.admin.address),
    );
    expect(rejected.transactions).toHaveTransaction({ to: f.master.address, success: false, exitCode: 50003 });
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    const prepare = await start(f);
    const retry = await f.master.send(
        f.other.getSender(),
        { value: toNano('1') },
        { $$type: 'RetryMint', operationId: 1n },
    );
    expect(retry.transactions).toHaveTransaction({ to: f.master.address, success: false, exitCode: 50003 });
    expect((await f.master.getMintStatus()).pendingCount).toBe(1n);
    expect((await f.master.getMintStatus()).lastOperationId).toBe(1n);
    const accepted = outbound(await execute(f.chain, prepare), ACCEPTED);
    const commit = outbound(await execute(f.chain, accepted), COMMIT);
    await execute(f.chain, outbound(await execute(f.chain, commit), SETTLED));
});

receiptTest('mint budget follows native config gas prices rather than a fixed TON allowance', async () => {
    const f = await fixture();
    const before = await f.master.getMintBudget(f.receiver.address, 0n, null);
    const config = Dictionary.loadDirect(
        Dictionary.Keys.Int(32),
        Dictionary.Values.Cell(),
        f.chain.config.beginParse(),
    );
    const gas = config.get(21)!.beginParse();
    expect(gas.preloadUint(8)).toBe(0xd1);
    const prefix = gas.loadBits(144);
    const price = gas.loadUintBig(64);
    config.set(
        21,
        beginCell()
            .storeBits(prefix)
            .storeUint(price * 2n, 64)
            .storeSlice(gas)
            .endCell(),
    );
    f.chain.setConfig(beginCell().storeDictDirect(config).endCell());
    const after = await f.master.getMintBudget(f.receiver.address, 0n, null);
    expect(after).toBeGreaterThan(before);
    await f.master.send(f.admin.getSender(), { value: toNano('1') }, mint(f.receiver.address, f.admin.address));
    expect((await f.master.getMintStatus()).pendingCount).toBe(0n);
    expect((await f.master.getGetJettonData()).totalSupply).toBe(100n);
    expect((await f.wallet.getGetWalletData()).balance).toBe(100n);
});
