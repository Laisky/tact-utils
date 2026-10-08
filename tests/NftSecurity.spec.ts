import { comment, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import '@ton/test-utils';
import { NftCollectionTemplate } from '../build/Sample/tact_NftCollectionTemplate';
import { NftItemTemplate, loadOwnershipAssigned } from '../build/Sample/tact_NftItemTemplate';

describe('NFT ownership notification security', () => {
    /** fixture creates only local Sandbox accounts and mints a fresh item. */
    async function fixture(forward = 0n) {
        const chain = await Blockchain.create();
        const issuer = await chain.treasury('issuer');
        const holder = await chain.treasury('holder');
        const next = await chain.treasury('new-owner');
        const refund = await chain.treasury('independent-refund');
        const outsider = await chain.treasury('outsider');
        const collection = chain.openContract(await NftCollectionTemplate.fromInit(
            issuer.address, { $$type: 'Tep64TokenData', flag: 1n, content: 'local-only' },
            'local-item-', null));
        const item = chain.openContract(await NftItemTemplate.fromInit(collection.address, 0n));
        const minted = await collection.send(issuer.getSender(), { value: toNano('1') }, {
            $$type: 'MintNFT', queryId: 1n, receiver: holder.address,
            responseDestination: refund.address, forwardAmount: forward,
            forwardPayload: comment('local-mint-payload')
        });
        return { chain, issuer, holder, next, refund, outsider, collection, item, minted };
    }

    it('routes one ownership notification to newOwner and excess only to refund', async () => {
        const f = await fixture();
        const payload = comment('local-transfer-payload');
        const result = await f.item.send(f.holder.getSender(), { value: toNano('1') }, {
            $$type: 'NFTTransfer', queryId: 42n, newOwner: f.next.address,
            responseDestination: f.refund.address, customPayload: null,
            forwardAmount: toNano('0.1'), forwardPayload: payload
        });
        expect((await f.item.getGetNftData()).ownerAddress.equals(f.next.address)).toBe(true);
        expect(result.transactions).toHaveTransaction({
            from: f.item.address, to: f.next.address, op: 0x05138d91, success: true
        });
        expect(result.transactions).not.toHaveTransaction({
            from: f.item.address, to: f.refund.address, op: 0x05138d91
        });
        expect(result.transactions).toHaveTransaction({
            from: f.item.address, to: f.refund.address, op: 0xd53276db
        });
        const tx = result.transactions.find(t => t.inMessage?.info.type === 'internal'
            && t.inMessage.info.dest.equals(f.item.address))!;
        const notifications = [...tx.outMessages.values()].filter(m =>
            m.body.beginParse().remainingBits >= 32 && m.body.beginParse().preloadUint(32) === 0x05138d91);
        expect(notifications).toHaveLength(1);
        const message = notifications[0];
        expect(message.info.type).toBe('internal');
        if (message.info.type !== 'internal') throw new Error('Expected internal message');
        expect(message.info.dest.equals(f.next.address)).toBe(true);
        // Existing send mode pays forwarding fees from the nominal forward amount.
        expect(message.info.value.coins).toBeGreaterThan(toNano('0.099'));
        expect(message.info.value.coins).toBeLessThanOrEqual(toNano('0.1'));
        const body = loadOwnershipAssigned(message.body.beginParse());
        expect(body.queryId).toBe(42n);
        expect(body.prevOwner.equals(f.holder.address)).toBe(true);
        expect(body.forwardPayload!.equals(payload)).toBe(true);
    });

    it('initial mint follows the same ownership and excess routing', async () => {
        const f = await fixture(toNano('0.1'));
        expect(f.minted.transactions).toHaveTransaction({
            from: f.item.address, to: f.holder.address, op: 0x05138d91
        });
        expect(f.minted.transactions).not.toHaveTransaction({
            from: f.item.address, to: f.refund.address, op: 0x05138d91
        });
        expect(f.minted.transactions).toHaveTransaction({
            from: f.item.address, to: f.refund.address, op: 0xd53276db
        });
    });

    it('zero forwarding emits no ownership notification', async () => {
        const f = await fixture();
        const result = await f.item.send(f.holder.getSender(), { value: toNano('1') }, {
            $$type: 'NFTTransfer', queryId: 3n, newOwner: f.next.address,
            responseDestination: f.refund.address, customPayload: null,
            forwardAmount: 0n, forwardPayload: null
        });
        expect(result.transactions).not.toHaveTransaction({ from: f.item.address, op: 0x05138d91 });
        expect((await f.item.getGetNftData()).ownerAddress.equals(f.next.address)).toBe(true);
        expect(result.transactions).toHaveTransaction({
            from: f.item.address, to: f.refund.address, op: 0xd53276db
        });
    });

    it.each(['self', 'equal-response'])('preserves %s transfer semantics', async (kind) => {
        const f = await fixture();
        const newOwner = kind === 'self' ? f.holder : f.next;
        const response = kind === 'equal-response' ? newOwner : f.refund;
        const result = await f.item.send(f.holder.getSender(), { value: toNano('1') }, {
            $$type: 'NFTTransfer', queryId: 4n, newOwner: newOwner.address,
            responseDestination: response.address, customPayload: null,
            forwardAmount: toNano('0.1'), forwardPayload: null
        });
        expect((await f.item.getGetNftData()).ownerAddress.equals(newOwner.address)).toBe(true);
        expect(result.transactions).toHaveTransaction({
            from: f.item.address, to: newOwner.address, op: 0x05138d91
        });
        expect(result.transactions).toHaveTransaction({
            from: f.item.address, to: response.address, op: 0xd53276db
        });
    });

    it('unauthorized sender cannot change owner or emit a callback', async () => {
        const f = await fixture();
        const result = await f.item.send(f.outsider.getSender(), { value: toNano('1') }, {
            $$type: 'NFTTransfer', queryId: 5n, newOwner: f.outsider.address,
            responseDestination: f.refund.address, customPayload: null,
            forwardAmount: toNano('0.1'), forwardPayload: null
        });
        expect(result.transactions).toHaveTransaction({
            from: f.outsider.address, to: f.item.address, success: false, exitCode: 50003
        });
        expect((await f.item.getGetNftData()).ownerAddress.equals(f.holder.address)).toBe(true);
        expect(result.transactions).not.toHaveTransaction({ from: f.item.address, op: 0x05138d91 });
    });
});
