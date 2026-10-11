import { comment, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import '@ton/test-utils';
import { StakingMasterTemplate } from '../build/Sample/tact_StakingMasterTemplate';
import { StakingWalletTemplate } from '../build/Sample/tact_StakingWalletTemplate';

/** Transaction fees plus the forward-fee portion not included in action fees. */
// fees returns actual transaction and forwarding fees for a local sandbox trace.
function fees(transactions: any[]): bigint {
    return transactions.reduce((total, tx) => {
        const action = tx.description.type === 'generic' ? tx.description.actionPhase : null;
        return total + tx.totalFees.coins + (action?.totalFwdFees ?? 0n) - (action?.totalActionFees ?? 0n);
    }, 0n);
}

/** Sum balances of every local account touched by this fixture. */
// balances returns the total native balance of all local trace participants.
async function balances(chain: Blockchain, accounts: { address: any }[]) {
    let sum = 0n;
    for (const account of accounts) sum += (await chain.getContract(account.address)).balance;
    return sum;
}

describe('Direct TON stake reservation', () => {
    for (const [funding, prefund] of [
        ['0.65', '0'],
        ['2', '0'],
        ['2', '1'],
    ] as const) {
        it(`returns excess without an uncredited stake: funding=${funding}, prefund=${prefund}`, async () => {
            const chain = await Blockchain.create();
            chain.now = 1700000000;
            const admin = await chain.treasury('issuer');
            const user = await chain.treasury('staker');
            const master = chain.openContract(await StakingMasterTemplate.fromInit(admin.address));
            const wallet = chain.openContract(await StakingWalletTemplate.fromInit(master.address, user.address));
            await master.send(admin.getSender(), { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 1n });
            if (prefund !== '0') {
                await admin.send({
                    to: master.address,
                    value: toNano(prefund),
                    bounce: false,
                    body: comment('local retained prefunding'),
                });
                expect((await chain.getContract(master.address)).balance).toBeGreaterThan(toNano('0.9'));
            }
            const preMaster = (await chain.getContract(master.address)).balance;
            if (prefund !== '0') chain.now = chain.now! + 3600;
            const accounts = [admin, user, master, wallet];
            const before = await balances(chain, accounts);
            const userBefore = (await chain.getContract(user.address)).balance;
            const result = await master.send(
                user.getSender(),
                { value: toNano(funding) },
                {
                    $$type: 'StakeToncoin',
                    queryId: 3n,
                    amount: toNano('0.5'),
                    responseDestination: user.address,
                    forwardAmount: toNano('0.1'),
                    forwardPayload: null,
                },
            );
            expect(result.transactions).toHaveTransaction({
                from: master.address,
                to: wallet.address,
                success: true,
                op: 0xa576751e,
            });
            expect((await wallet.getStakedInfo()).stakedTonAmount).toBe(toNano('0.5'));
            expect(before - (await balances(chain, accounts))).toBe(fees(result.transactions));
            const retained = (await chain.getContract(master.address)).balance;
            const stakeTransaction = result.transactions.find(
                (transaction) => transaction.inMessage?.info.type === 'internal'
                    && transaction.inMessage.info.src.equals(user.address)
                    && transaction.inMessage.info.dest.equals(master.address),
            );
            if (stakeTransaction?.description.type !== 'generic') {
                throw new Error('Expected native stake transaction');
            }
            const storageFees = stakeTransaction.description.storagePhase?.storageFeesCollected ?? 0n;
            if (prefund !== '0') expect(storageFees).toBeGreaterThan(0n);
            // Existing balance is protected after native storage fees, plus tax.
            const protectedBalance = preMaster - storageFees;
            const expected =
                protectedBalance + toNano('0.001') > toNano('0.501')
                    ? protectedBalance + toNano('0.001') : toNano('0.501');
            expect(retained).toBe(expected);
            const paid = userBefore - (await chain.getContract(user.address)).balance;
            expect(paid).toBeLessThan(toNano('0.55'));
            const withdrawBefore = await balances(chain, accounts);
            const withdrawal = await master.send(admin.getSender(), { value: toNano('0.05') }, 'withdraw');
            expect(withdrawBefore - (await balances(chain, accounts))).toBe(fees(withdrawal.transactions));
            expect((await chain.getContract(master.address)).balance).toBe(toNano('0.501'));
            expect((await wallet.getStakedInfo()).stakedTonAmount).toBe(toNano('0.5'));
        });
    }

    it('underfunded stake rolls back without wallet credit', async () => {
        const chain = await Blockchain.create();
        const admin = await chain.treasury('issuer');
        const user = await chain.treasury('staker');
        const master = chain.openContract(await StakingMasterTemplate.fromInit(admin.address));
        const wallet = chain.openContract(await StakingWalletTemplate.fromInit(master.address, user.address));
        await master.send(admin.getSender(), { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 1n });
        const result = await master.send(
            user.getSender(),
            { value: toNano('0.501') },
            {
                $$type: 'StakeToncoin',
                queryId: 2n,
                amount: toNano('0.5'),
                responseDestination: user.address,
                forwardAmount: toNano('0.1'),
                forwardPayload: null,
            },
        );
        expect(result.transactions).toHaveTransaction({ from: user.address, to: master.address, success: false });
        expect(result.transactions).not.toHaveTransaction({ from: master.address, to: wallet.address, success: true });
        expect((await chain.getContract(wallet.address)).balance).toBe(0n);
        const withdrawal = await master.send(admin.getSender(), { value: toNano('0.05') }, 'withdraw');
        expect(withdrawal.transactions).toHaveTransaction({ from: master.address, to: admin.address, success: true });
        expect((await chain.getContract(master.address)).balance).toBeLessThan(toNano('0.1'));
    });
});
