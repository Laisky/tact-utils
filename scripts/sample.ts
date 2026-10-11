import { NetworkProvider } from '@ton/blueprint';
import { comment, toNano } from '@ton/core';

import { JettonMasterTemplate } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';
import { loadTep64TokenData } from '../build/Sample/tact_Sample';
import { randomInt } from './utils';
import { SampleMaster } from '../build/Sample/tact_SampleMaster';


export async function run(provider: NetworkProvider): Promise<void> {
    const admin = provider.sender().address!!;

    const sampleMasterContract = await provider.open(await SampleMaster.fromInit(
        admin,
    ))

    // deploy sample master contract
    await sampleMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "Deploy",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
        }
    )

    await provider.waitForDeploy(sampleMasterContract.address, 50);
}
