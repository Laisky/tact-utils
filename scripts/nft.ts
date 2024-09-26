import { toNano, Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import { getMasterContract } from './utils';
import {
    loadTep64TokenData,
    NftCollectionSample
} from '../build/Sample/tact_NftCollectionSample';
import { Sample } from '../build/Sample/tact_Sample';
import { NftItemTemplate } from '../build/Sample/tact_NftItemTemplate';


export async function run(provider: NetworkProvider): Promise<void> {
    let receiver = await provider.ui().input(
        "input the address of the jetton receiver(default to yourself):",
    );

    // mint nft
    // strip prefix and suffix space
    receiver = receiver.trim();
    let receiverAddr: Address;
    if (receiver) {
        receiverAddr = Address.parse(receiver);
    } else {
        receiverAddr = provider.sender().address!!;
    }
    console.log(`mint NFT to ${receiverAddr.toString()}`);

    const sampleMasterContract = await getMasterContract(provider);
    const sampleContract = await provider.open(
        await Sample.fromInit(
            sampleMasterContract.address,
            provider.sender().address!!,
        )
    );

    await sampleMasterContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "MintNftSample",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            receiver: provider.sender().address!!,
        }
    );

    // wait nft collection deployed and show info
    console.log("-------------------------------------");
    const nftCollectionContract = await provider.open(
        await NftCollectionSample.fromInit(
            sampleContract.address,
            {
                $$type: "Tep64TokenData",
                flag: BigInt("1"),
                content: "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
            },
            "https://s3.laisky.com/uploads/2024/09/nft-sample-item-",
            null,
        )
    );
    console.log(`nft collection address: ${nftCollectionContract.address}`);
    await provider.waitForDeploy(nftCollectionContract.address, 30);

    const collectionData = await nftCollectionContract.getGetCollectionData();
    const collectionContent = loadTep64TokenData(collectionData.collectionContent.asSlice());
    console.log(`nft collection owner: ${collectionData.ownerAddress}`);
    console.log(`nft collection next index: ${collectionData.nextItemIndex}`);
    console.log(`nft collection content: ${collectionContent.content}`);

    // wait nft item deployed and show info
    console.log("-------------------------------------");
    const nftItemContract = await provider.open(
        await NftItemTemplate.fromInit(
            nftCollectionContract.address,
            collectionData.nextItemIndex - BigInt(1),
        )
    );
    console.log(`nft item address: ${nftItemContract.address}`);
    await provider.waitForDeploy(nftItemContract.address, 30);

    const itemData = await nftItemContract.getGetNftData();
    const itemContentCell = await nftCollectionContract.getGetNftContent(
        itemData.index,
        itemData.individualContent,
    );
    const itemContent = loadTep64TokenData(itemContentCell.asSlice());
    console.log(`nft item owner: ${itemData.ownerAddress}`);
    console.log(`nft item collection: ${itemData.collectionAddress}`);
    console.log(`nft item index: ${itemData.index}`);
    console.log(`nft item content: ${itemContent.content}`);
}
