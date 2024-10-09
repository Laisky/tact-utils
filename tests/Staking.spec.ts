import { comment, toNano } from '@ton/core';
import { Blockchain, printTransactionFees, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { StakingMasterTemplate } from '../build/Staking/tact_StakingMasterTemplate';
import { StakingWalletTemplate } from '../build/Staking/tact_StakingWalletTemplate';

describe('Staking', () => {

    let blockchain: Blockchain;

    let stakeMasterContract: SandboxContract<StakingMasterTemplate>;
    let jettonMasterContract: SandboxContract<JettonMasterTemplate>;
    let userStakeWallet: SandboxContract<StakingWalletTemplate>;
    let userJettonWallet: SandboxContract<JettonWalletTemplate>;
    let userStakeJettonWallet: SandboxContract<JettonWalletTemplate>;

    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();

        admin = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');

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

        stakeMasterContract = blockchain.openContract(
            await StakingMasterTemplate.fromInit(
                admin.address,
            )
        );

        userStakeWallet = blockchain.openContract(
            await StakingWalletTemplate.fromInit(
                stakeMasterContract.address,
                user.address,
            )
        );

        userStakeJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                jettonMasterContract.address,
                userStakeWallet.address,
            )
        );

        userJettonWallet = blockchain.openContract(
            await JettonWalletTemplate.fromInit(
                jettonMasterContract.address,
                user.address,
            )
        );

        console.log(`stakeMasterContract: ${stakeMasterContract.address}`);
        console.log(`jettonMasterContract: ${jettonMasterContract.address}`);
        console.log(`userStakeWallet: ${userStakeWallet.address}`);
        console.log(`userStakeJettonWallet: ${userStakeJettonWallet.address}`);
        console.log(`userJettonWallet: ${userJettonWallet.address}`);
    });

});
