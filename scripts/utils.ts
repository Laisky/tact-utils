import { OpenedContract } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { SampleMaster } from "../build/Sample/tact_SampleMaster";


export async function getMasterContract(provider: NetworkProvider): Promise<OpenedContract<SampleMaster>> {
    return provider.open(await SampleMaster.fromInit());
}
