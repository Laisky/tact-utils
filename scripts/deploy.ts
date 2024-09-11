import { OpenedContract } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { Sample } from "../build/Sample/tact_Sample";


export async function getMasterContract(provider: NetworkProvider): Promise<OpenedContract<Sample>> {
    return provider.open(await Sample.fromInit());
}
