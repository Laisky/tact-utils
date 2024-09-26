import { toNano } from '@ton/core';
import { NetworkProvider, sleep } from '@ton/blueprint';

import { HelloWorld } from "../build/HelloWorld/tact_HelloWorld";
import { HelloWorldV2 } from "../build/HelloWorld/tact_HelloWorldV2";

export async function run(provider: NetworkProvider): Promise<void> {
    // -------------------------------------
    // degrade
    // -------------------------------------

    const v1 = await provider.open(await HelloWorld.fromInit(
        provider.sender().address!!,
    ));

    // degrade
    await v1.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "UpgradeContract",
            queryId: BigInt("123"),
            code: v1.init!!.code,
            data: null,
            responseDestination: provider.sender().address!!,
        }
    )

    await provider.waitForDeploy(v1.address)
    await sleep(2000); // wait for setcode finished

    // show version
    console.log(`before upgrade, version: ${await v1.getVersion()}`)

    // -------------------------------------
    // upgrade
    // -------------------------------------
    const v2 = await HelloWorldV2.fromInit(
        provider.sender().address!!,
    )
    await v1.send(
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

    await provider.waitForDeploy(v1.address);
    await sleep(2000); // wait for setcode finished

    // show version
    console.log(`after upgrade, version: ${await v1.getVersion()}`)
}
