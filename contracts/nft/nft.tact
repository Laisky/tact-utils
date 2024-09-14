// =====================================
// https://blog.laisky.com/p/ton-tact/
// =====================================

import "@stdlib/deploy";
import "@stdlib/ownable";
import "./messages.tact";
import "./errcodes.tact";
import "../common/traits.tact";

// =====================================
// Contracts
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// =====================================

contract NftCollectionTemplate with NftCollection {
    owner: Address;
    staticTaxFee: Int as coins = ton("0.001");
    lockedValue: Int as coins = ton("0");

    nextItemIndex: Int as uint256 = 0;
    collectionContent: Cell;
    // itemContentUrlPrefix is the prefix of the individual NFT's content url.
    // the full url should be: `${itemContentUrlPrefix}${individualContent}.json`
    itemContentUrlPrefix: String;
    royalty: RoyaltyParams;

    init(owner: Address,
        collectionContent: Tep64TokenData,
        itemContentUrlPrefix: String,
        royalty: RoyaltyParams?) {
        self.owner = owner;
        self.collectionContent = collectionContent.toCell();
        self.itemContentUrlPrefix = itemContentUrlPrefix;

        if (royalty != null) {
            self.royalty = royalty!!;
        } else {
            self.royalty = RoyaltyParams{
                numerator: 0,
                denominator: 10,
                destination: owner,
            };
        }

        nativeThrowUnless(codeRoyaltyNumInvalid, self.royalty.numerator < self.royalty.denominator);
        nativeThrowUnless(codeRoyaltyNumInvalid, self.royalty.denominator > 0);
    }
}


contract NftItemTemplate with NftItem {
    owner: Address;
    staticTaxFee: Int as coins = ton("0.001");
    lockedValue: Int as coins = ton("0");

    initialized: Bool = false;
    collection: Address;
    itemIndex: Int as uint256;
    individualContent: Cell;

    init(collection: Address, index: Int) {
        nativeThrowUnless(codeUnauthorized, sender() == collection);

        self.owner = sender();
        self.collection = collection;
        self.individualContent = emptyCell();
        self.itemIndex = index;
    }
}

// =====================================
// Traits
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// =====================================


trait NftCollection with Common {
    owner: Address;
    staticTaxFee: Int;
    lockedValue: Int;

    nextItemIndex: Int;
    collectionContent: Cell;
    // itemContentUrlPrefix is the prefix of the individual NFT's content url.
    // the full url should be: `${itemContentUrlPrefix}${individualContent}.json`
    itemContentUrlPrefix: String;
    royalty: RoyaltyParams;

    // collection's owner can mint NFTs
    receive(msg: MintNFT) {
        self.receiveMintNFT(msg);
    }

    receive(msg: GetRoyaltyParams) {
        self.receiveGetRoyaltyParams(msg);
    }

    get fun get_collection_data(): CollectionData {
        return self.getCollectionData();
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return self.getNftAddressByIndex(index);
    }

    get fun get_nft_content(index: Int, individualContent: Cell): Cell {
        return self.getNftContent(index, individualContent);
    }

    get fun royalty_params(): RoyaltyParams {
        return self.royaltyParams();
    }

    bounced(msg: bounced<NFTTransfer>) {
        self.receiveBouncedNFTTransfer();
    }

    virtual fun receiveBouncedNFTTransfer() {
        self.nextItemIndex = self.nextItemIndex - 1;
    }

    virtual fun receiveMintNFT(msg: MintNFT) {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= self.staticTaxFee + msg.forwardAmount);

        self.mint(msg);
    }

    virtual fun mint(msg: MintNFT) {
        let ctx: Context = context();

        let nftItemContract = self.getNftItem(self.nextItemIndex);
        let transferMsg = NFTTransfer {
            queryId: msg.queryId,
            newOwner: msg.newOwner,
            responseDestination: sender(),
            forwardAmount: msg.forwardAmount,
            forwardPayload: NftItemInitForwardPayload{
                index: self.nextItemIndex,
            }.toCell(),
            customPayload: self.nextItemIndex.toString().asSlice().asCell(),
        }.toCell();

        self.reserveValue(0);
        send(SendParameters{
                to: contractAddress(nftItemContract),
                value: 0,
                bounce: true,
                mode: SendRemainingBalance,
                body: transferMsg,
                code: nftItemContract.code,
                data: nftItemContract.data,
            });

        self.nextItemIndex = self.nextItemIndex + 1;
    }

    virtual fun receiveGetRoyaltyParams(msg: GetRoyaltyParams) {
        let ctx: Context = context();

        self.reserveValue(0);
        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: ReportRoyaltyParams{
                queryId: msg.queryId,
                numerator: self.royalty.numerator,
                denominator: self.royalty.denominator,
                destination: self.royalty.destination,
            }.toCell(),
        });
    }

    virtual fun getNftItem(nextItemIndex: Int): StateInit {
        return initOf NftItemTemplate(myAddress(), nextItemIndex);
    }

    virtual fun getCollectionData(): CollectionData {
        return CollectionData{
            nextItemIndex: self.nextItemIndex,
            collectionContent: self.collectionContent,
            ownerAddress: self.owner,
        };
    }

    virtual fun getNftAddressByIndex(index: Int): Address {
        nativeThrowUnless(codeNftIndexNotExists, index < self.nextItemIndex);
        return contractAddress(self.getNftItem(index));
    }

    virtual fun getNftContent(index: Int, individualContent: Cell): Cell {
        return Tep64TokenData{
            flag: 1,
            content: beginString()
                .concat(self.itemContentUrlPrefix)
                .concat(individualContent.asSlice().asString())
                .concat(".json")
                .toString(),
        }.toCell();
    }

    virtual fun royaltyParams(): RoyaltyParams {
        return self.royalty;
    }
}


trait NftItem with Common {
    owner: Address;
    staticTaxFee: Int;
    lockedValue: Int;

    initialized: Bool;
    collection: Address;
    itemIndex: Int;
    individualContent: Cell;

    receive(msg: NFTTransfer) {
        self.receiveNFTTransfer(msg);
    }

    receive(msg: GetStaticData) {
        self.receiveGetStaticData(msg);
    }

    get fun get_nft_data(): GetNftData {
        return self.getNftData();
    }

    virtual fun receiveNFTTransfer(msg: NFTTransfer) {
        let ctx: Context = context();

        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.forwardAmount);
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);

        let prevOwner = self.owner;
        self.owner = msg.newOwner;
        if (self.initialized == false) {
            // only the collection contract can initialize the NFT
            nativeThrowUnless(codeUnauthorized, ctx.sender == self.collection);
            nativeThrowUnless(codeNftCustomPayloadInvalid, msg.customPayload != null);

            // let data: NftItemInitiation = NftItemInitiation.fromCell(msg.customPayload!!);
            // self.itemIndex = data.index;

            self.individualContent = msg.customPayload!!;
            self.initialized = true;
        }

        // forward fee
        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: msg.newOwner,
                value: msg.forwardAmount,
                bounce: false,
                // mode: SendIgnoreErrors,
                body: OwnershipAssigned{
                    queryId: msg.queryId,
                    prevOwner: prevOwner,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // refund the remaining balance to the responseDestination
        self.reserveValue(0);
        send(SendParameters{
            to: msg.responseDestination,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: Excesses{
                queryId: msg.queryId
            }.toCell(),
        });
    }

    virtual fun receiveGetStaticData(msg: GetStaticData) {
        let ctx: Context = context();

        self.reserveValue(0);
        send(SendParameters {
            to: ctx.sender,
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: ReportStaticData{
                queryId: msg.queryId,
                index: self.itemIndex,
                collection: self.collection
            }.toCell(),
        });
    }

    virtual fun getNftData(): GetNftData {
        return GetNftData {
            init: self.initialized,
            index: self.itemIndex,
            collectionAddress: self.collection,
            ownerAddress: self.owner,
            individualContent: self.individualContent
        };
    }
}
