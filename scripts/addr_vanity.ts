import { NetworkProvider } from '@ton/blueprint';
import { Address, beginCell, OpenedContract, toNano } from '@ton/core';
import { HelloWorldVanity } from '../build/HelloWorld/tact_HelloWorldVanity';

import { randomInt } from './utils';
import { randomBytes } from 'crypto';

export async function run(provider: NetworkProvider): Promise<void> {
    let contract: OpenedContract<HelloWorldVanity>;

    // Generate a vanity address
    const target = '_ton';
    const salt = await generateVanityAddr(provider.sender().address!!, target);

    if (!salt) {
        return;
    }

    contract = provider.open(await HelloWorldVanity.fromInit(
        provider.sender().address!!,
        beginCell().storeBuffer(salt).asSlice(),
    ));

    await contract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "Deploy",
            queryId: BigInt(randomInt()),
        }
    );
}

async function generateVanityAddr(owner: Address, target: string): Promise<Buffer | null> {
    // Generate random salt
    let salt = randomBytes(32);

    // Determine increment direction
    let incr = BigInt(1);
    if (Math.random() < 0.5) {
        incr = BigInt(-1);
    }

    console.log(`Start searching from salt: ${salt.toString('hex')}, increment: ${incr}`);

    while (true) {
        try {
            // Convert salt to BigInt for manipulation
            let currentSalt = BigInt('0x' + salt.toString('hex'));
            currentSalt += incr;

            // Check for overflow
            if (currentSalt < BigInt(0) || currentSalt > BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')) {
                console.log('Overflow, exit');
                return null;
            }

            // Update salt buffer
            salt = Buffer.from(currentSalt.toString(16).padStart(64, '0'), 'hex');

            let contract = await HelloWorldVanity.fromInit(
                owner,
                beginCell().storeBuffer(salt).asSlice(),
            );

            // The tail of the address should be '_ton'
            const contractAddress = contract.address.toString();
            if (contractAddress.endsWith(target)) {
                console.log(`Vanity address found: ${contractAddress}`);
                console.log(`Salt used: ${salt.toString('hex')}`);
                return salt;
            }
        } catch (error) {
            console.error('Error generating vanity address:', error);
        }
    }
}
