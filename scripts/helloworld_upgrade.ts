import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import { HelloWorld } from "../build/HelloWorld/tact_HelloWorld";
import { HelloWorldV2 } from "../build/HelloWorld/tact_HelloWorldV2";

export async function run(provider: NetworkProvider): Promise<void> {
    const contract = await provider.open(await HelloWorld.fromInit(
        provider.sender().address!!,
    ));
    // show version
    console.log(`version: ${await contract.getVersion()}`)

    // upgrade
    const v2 = await HelloWorldV2.fromInit(
        provider.sender().address!!,
    )
    await contract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "UpgradeContract",
            queryId: BigInt("123"),
            code: v2.init!!.code,
            data: null,
            responseDestination: provider.sender().address!!,
        }
    )

    // show version
    console.log(`version: ${await contract.getVersion()}`)
}
