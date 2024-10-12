import { comment, toNano } from '@ton/core';
import {
    Blockchain,
    printTransactionFees,
    SandboxContract,
    TreasuryContract
} from '@ton/sandbox';
import '@ton/test-utils';

import { NftCollectionTemplate } from '../build/Sample/tact_NftCollectionTemplate';
import { NftItemTemplate } from '../build/Sample/tact_NftItemTemplate';
import { loadTep64TokenData } from '../build/Sample/tact_NftCollectionSample';

describe('NFT', () => {

    let blockchain: Blockchain;
    let nftCollectionContract: SandboxContract<NftCollectionTemplate>;
    let nftItemContract: SandboxContract<NftItemTemplate>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let forwardReceiver: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');
        forwardReceiver = await blockchain.treasury('forwardReceiver');

        nftCollectionContract = blockchain.openContract(
            await NftCollectionTemplate.fromInit(
                admin.address,
                {
                    $$type: "Tep64TokenData",
                    flag: BigInt("1"),
                    content: "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
                },
                "https://s3.laisky.com/uploads/2024/09/nft-sample-item-",
                null,
            )
        );

        nftItemContract = blockchain.openContract(
            await NftItemTemplate.fromInit(
                nftCollectionContract.address,
                BigInt(0),
            )
        );

        console.log(`admin: ${admin.address}`);
        console.log(`user: ${user.address}`);
        console.log(`forwardReceiver: ${forwardReceiver.address}`);
        console.log(`nftCollectionContract: ${nftCollectionContract.address}`);
        console.log(`nftItemContract: ${nftItemContract.address}`);
    });

    it("mint nft", async () => {
        const tx = await nftCollectionContract.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "MintNFT",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                receiver: user.address,
                responseDestination: forwardReceiver.address,
                forwardAmount: toNano("0.1"),
                forwardPayload: comment("forward payload"),
            }
        );
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: nftCollectionContract.address,
            success: true,
            op: 0xe535b616,  // MintNFT
        });
        expect(tx.transactions).toHaveTransaction({
            from: nftCollectionContract.address,
            to: nftItemContract.address,
            success: true,
            op: 0x5fcc3d14, // NFTTransfer
        });
        expect(tx.transactions).toHaveTransaction({
            from: nftItemContract.address,
            to: forwardReceiver.address,
            success: true,
            op: 0x05138d91, // OwnershipAssigned
        });
        expect(tx.transactions).toHaveTransaction({
            from: nftItemContract.address,
            to: forwardReceiver.address,
            success: true,
            op: 0xd53276db, // Excesses
        });

        const collectionData = await nftCollectionContract.getGetCollectionData();
        expect(collectionData.nextItemIndex).toEqual(BigInt(1));
        expect(collectionData.ownerAddress.equals(admin.address)).toBeTruthy();

        const itemData = await nftItemContract.getGetNftData();
        expect(itemData.ownerAddress.equals(user.address)).toBeTruthy();
        expect(itemData.collectionAddress.equals(nftCollectionContract.address)).toBeTruthy();
        expect(itemData.index).toEqual(BigInt(0));
        expect(itemData.init).toBeTruthy();
    });

    it("transfer nft", async () => {
        const tx = await nftItemContract.send(
            user.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "NFTTransfer",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                newOwner: admin.address,
                responseDestination: forwardReceiver.address,
                customPayload: comment("custom payload"),
                forwardAmount: toNano("0.1"),
                forwardPayload: comment("forward payload"),
            }
        );
        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: user.address,
            to: nftItemContract.address,
            success: true,
            op: 0x5fcc3d14,  // TransferNFT
        });
        expect(tx.transactions).toHaveTransaction({
            from: nftItemContract.address,
            to: forwardReceiver.address,
            success: true,
            op: 0x05138d91, // OwnershipAssigned
        });
        expect(tx.transactions).toHaveTransaction({
            from: nftItemContract.address,
            to: forwardReceiver.address,
            success: true,
            op: 0xd53276db, // Excesses
        });

        const itemData = await nftItemContract.getGetNftData();
        expect(itemData.ownerAddress.equals(admin.address)).toBeTruthy();
    });

    it("update collection content", async () => {
        const tx = await nftCollectionContract.send(
            admin.getSender(),
            {
                value: toNano("1"),
                bounce: false,
            },
            {
                $$type: "UpdateCollection",
                queryId: BigInt(Math.floor(Date.now() / 1000)),
                collectionContent: {
                    $$type: "Tep64TokenData",
                    flag: BigInt("1"),
                    content: "new-content",
                },
                itemContentUrlPrefix: "new-prefix",
                responseDestination: forwardReceiver.address,
                royalty: null,
            }
        );

        console.log("printTransactionFees");
        printTransactionFees(tx.transactions);

        expect(tx.transactions).toHaveTransaction({
            from: admin.address,
            to: nftCollectionContract.address,
            success: true,
            op: 0x48a60907,  // UpdateCollection
        });
        expect(tx.transactions).toHaveTransaction({
            from: nftCollectionContract.address,
            to: forwardReceiver.address,
            success: true,
            op: 0xd53276db, // Excesses
        });

        const collectionData = await nftCollectionContract.getGetCollectionData();
        const collectionContent = loadTep64TokenData(collectionData.collectionContent.asSlice());
        expect(collectionContent.content).toEqual("new-content");

        const itemData = await nftItemContract.getGetNftData();

        const itemContent = await nftCollectionContract.getGetNftContent(
            itemData.index,
            itemData.individualContent,
        );
        const itemContentData = loadTep64TokenData(itemContent.asSlice());
        expect(itemContentData.content).toEqual("new-prefix0.json");
    });
});
