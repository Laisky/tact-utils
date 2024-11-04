import { NetworkProvider } from '@ton/blueprint';
import { beginCell, toNano } from '@ton/core';
import { keyPairFromSeed, sign, KeyPair, getSecureRandomBytes } from 'ton-crypto';

import { randomInt } from './utils';
import { SampleMaster } from '../build/Sample/tact_SampleMaster';


export async function run(provider: NetworkProvider): Promise<void> {
    const contract = provider.open(
        await SampleMaster.fromInit(
            provider.sender().address!!,
        )
    );

    const data = Buffer.from('Hello wordl!');
    const dataCell = beginCell().storeBuffer(data).endCell();

    // Create Keypair
    const seed: Buffer = await getSecureRandomBytes(32);
    const keypair: KeyPair = keyPairFromSeed(seed);

    // Sign
    const signature = sign(dataCell.hash(), keypair.secretKey);

    const pubkey: bigint = BigInt('0x' + keypair.publicKey.toString('hex'));

    await contract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false
        },
        {
            $$type: "VerifyDataSignature",
            queryId: BigInt(randomInt()),
            data: dataCell,
            signature: beginCell().storeBuffer(signature).asSlice(),
            publicKey: pubkey,
        }
    )
}
