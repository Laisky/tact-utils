import { NetworkProvider } from '@ton/blueprint';
import { comment, toNano } from '@ton/core';

import {
    loadTep64TokenData
} from '../build/Sample/tact_NftCollectionSample';
import { NftCollectionTemplate } from '../build/Sample/tact_NftCollectionTemplate';
import { NftItemTemplate } from '../build/Sample/tact_NftItemTemplate';
import { randomInt } from './utils';


export async function run(provider: NetworkProvider): Promise<void> {
    // let receiver = await provider.ui().input(
    //     "input the address of the jetton receiver(default to yourself):",
    // );

    // // mint nft
    // // strip prefix and suffix space
    // receiver = receiver.trim();
    // let receiverAddr: Address;
    // if (receiver) {
    //     receiverAddr = Address.parse(receiver);
    // } else {
    //     receiverAddr = provider.sender().address!!;
    // }

    const receiverAddr = provider.sender().address!!;
    console.log(`mint NFT to ${receiverAddr.toString()}`);

    const nftCollectionContract = await provider.open(
        await NftCollectionTemplate.fromInit(
            provider.sender().address!!,
            {
                $$type: "Tep64TokenData",
                flag: BigInt("1"),
                content: "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
            },
            "https://s3.laisky.com/uploads/2024/09/nft-sample-item-",
            null,
    ));

    console.log("-------------------------------------")
    console.log(`mint nft`);
    console.log("-------------------------------------")

    await nftCollectionContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "MintNFT",
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            receiver: receiverAddr,
            responseDestination: receiverAddr,
            forwardAmount: toNano("0.1"),
            forwardPayload: comment("forward payload"),
        }
    );

    console.log("-------------------------------------")
    console.log(`wait nft collection deployed and show info`);
    console.log("-------------------------------------")

    console.log(`nft collection address: ${nftCollectionContract.address}`);
    await provider.waitForDeploy(nftCollectionContract.address, 50);

    const collectionData = await nftCollectionContract.getGetCollectionData();
    const nftItemContract = await provider.open(
        await NftItemTemplate.fromInit(
            nftCollectionContract.address,
            collectionData.nextItemIndex - BigInt(1),
        )
    );
    const collectionContent = loadTep64TokenData(collectionData.collectionContent.asSlice());
    console.log(`nft collection owner: ${collectionData.ownerAddress}`);
    console.log(`nft collection next index: ${collectionData.nextItemIndex}`);
    console.log(`nft collection content: ${collectionContent.content}`);

    console.log("-------------------------------------");
    console.log("wait nft item deployed and show info");
    console.log("-------------------------------------");

    console.log(`nft item address: ${nftItemContract.address}`);
    await provider.waitForDeploy(nftItemContract.address, 50);

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

    console.log("-------------------------------------");
    console.log("update collection content");
    console.log("-------------------------------------");
    await nftCollectionContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "UpdateCollection",
            queryId: BigInt(randomInt()),
            responseDestination: provider.sender().address!!,
            collectionContent: {
                $$type: "Tep64TokenData",
                flag: BigInt(1),
                content: "https://s3.laisky.com/uploads/2024/09/nft-sample-collection-updated.json",
            },
            itemContentUrlPrefix: "https://s3.laisky.com/uploads/2024/09/nft-sample-item-updated-",
            royalty: null
        }
    );

    console.log("-------------------------------------");
    console.log("transfer nft item");
    console.log("-------------------------------------");
    await nftItemContract.send(
        provider.sender(),
        {
            value: toNano("1"),
            bounce: false,
        },
        {
            $$type: "NFTTransfer",
            queryId: BigInt(randomInt()),
            newOwner: receiverAddr,
            responseDestination: receiverAddr,
            customPayload: comment("custom payload"),
            forwardAmount: toNano("0.1"),
            forwardPayload: comment("forward payload"),
        }
    );
}
