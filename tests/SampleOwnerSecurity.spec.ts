import { toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import '@ton/test-utils';
import { SampleMaster } from '../build/Sample/tact_SampleMaster';

describe('SampleMaster committed owner', () => {
    it.each(['owner', 'outsider'])('keeps the init owner when %s activates first', async (first) => {
        const chain = await Blockchain.create();
        const owner = await chain.treasury('intended-owner');
        const outsider = await chain.treasury('first-sender');
        const master = chain.openContract(await SampleMaster.fromInit(owner.address));
        const sameInit = await SampleMaster.fromInit(owner.address);
        expect(sameInit.address.equals(master.address)).toBe(true);
        const sender = first === 'owner' ? owner : outsider;
        const deployed = await master.send(sender.getSender(), { value: toNano('1') },
            { $$type: 'Deploy', queryId: 1n });
        expect(deployed.transactions).toHaveTransaction({
            from: sender.address, to: master.address, deploy: true, success: true
        });

        const rejected = await master.send(outsider.getSender(), { value: toNano('0.1') },
            { $$type: 'SetStaticTax', staticTax: toNano('0.009') });
        expect(rejected.transactions).toHaveTransaction({
            from: outsider.address, to: master.address, success: false, exitCode: 50003
        });
        expect(await master.getStaticTax()).toBe(toNano('0.001'));

        const accepted = await master.send(owner.getSender(), { value: toNano('0.1') },
            { $$type: 'SetStaticTax', staticTax: toNano('0.002') });
        expect(accepted.transactions).toHaveTransaction({
            from: owner.address, to: master.address, success: true, op: 0x1509a420
        });
        expect(await master.getStaticTax()).toBe(toNano('0.002'));

        const unauthorizedWithdrawal = await master.send(outsider.getSender(),
            { value: toNano('0.1') }, 'withdraw');
        expect(unauthorizedWithdrawal.transactions).toHaveTransaction({
            from: outsider.address, to: master.address, success: false, exitCode: 50003
        });
        expect(unauthorizedWithdrawal.transactions).not.toHaveTransaction({
            from: master.address, to: outsider.address, op: 0xd53276db
        });
        const withdrawal = await master.send(owner.getSender(), { value: toNano('0.1') }, 'withdraw');
        expect(withdrawal.transactions).toHaveTransaction({
            from: owner.address, to: master.address, success: true
        });
        expect(withdrawal.transactions).toHaveTransaction({
            from: master.address, to: owner.address, op: 0xd53276db
        });
    });

    it('a later deploy message cannot replace the committed owner', async () => {
        const chain = await Blockchain.create();
        const owner = await chain.treasury('owner');
        const outsider = await chain.treasury('outsider');
        const master = chain.openContract(await SampleMaster.fromInit(owner.address));
        await master.send(owner.getSender(), { value: toNano('1') },
            { $$type: 'Deploy', queryId: 1n });
        await master.send(outsider.getSender(), { value: toNano('0.1') },
            { $$type: 'Deploy', queryId: 2n });
        const rejected = await master.send(outsider.getSender(), { value: toNano('0.1') },
            { $$type: 'SetStaticTax', staticTax: toNano('0.009') });
        expect(rejected.transactions).toHaveTransaction({
            from: outsider.address, to: master.address, success: false, exitCode: 50003
        });
        const accepted = await master.send(owner.getSender(), { value: toNano('0.1') },
            { $$type: 'SetStaticTax', staticTax: toNano('0.003') });
        expect(accepted.transactions).toHaveTransaction({
            from: owner.address, to: master.address, success: true
        });
        expect(await master.getStaticTax()).toBe(toNano('0.003'));
    });
});
