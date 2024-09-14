import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { HelloWorld } from "../build/HelloWorld/tact_HelloWorld";

export async function run(provider: NetworkProvider): Promise<void> {
    const contract = await provider.open(await HelloWorld.fromInit(
        provider.sender().address!!,
    ));

    await contract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        "hello"
    );
}
