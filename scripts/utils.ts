import { NetworkProvider } from '@ton/blueprint';
import { OpenedContract } from '@ton/core';
import { SampleMaster } from "../build/Sample/tact_SampleMaster";


export const getMasterContract = async (provider: NetworkProvider): Promise<OpenedContract<SampleMaster>> => {
    return provider.open(await SampleMaster.fromInit());
}

export const randomInt = (): number => {
    return Math.floor(Math.random() * 1000);
}
