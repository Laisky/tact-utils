// =====================================
// https://testnet.tonviewer.com/transaction/275a294d5a80852ca205449d7cfe4bc015329f0eb4b988a08c4d09bd31556862
// =====================================

import "../common/traits.tact";
import "../jetton/jetton.tact";
import "../staking/staking.tact";
import "../jetton/messages.tact";
import "../nft/nft.tact";
import "../nft/messages.tact";

import "./messages.tact";
import "./errcodes.tact";


contract SampleMaster with Common {
    owner: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    init() {
        self.owner = sender();
    }

    fun getSample(owner: Address): StateInit {
        return initOf Sample(
            myAddress(),
            owner,
        );
    }

    receive(msg: MintJettonSample) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= ton("0.1"));

        let sampleContract = self.getSample(sender());

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(sampleContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: MintJetton{
                queryId: msg.queryId,
                amount: msg.amount,
                receiver: msg.receiver,
                responseDestination: msg.receiver,
                forwardAmount: ton("0.1"),
                forwardPayload: "Newly minted jetton".asComment(),
            }.toCell(),
            data: sampleContract.data,
            code: sampleContract.code,
        });
    }

    receive(msg: MintNftSample) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= ton("0.1"));

        let sampleContract = self.getSample(sender());

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(sampleContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: MintNFT{
                queryId: msg.queryId,
                receiver: msg.receiver,
                responseDestination: msg.receiver,
                forwardAmount: ton("0.1"),
                forwardPayload: "Newly minted nft".asComment(),
            }.toCell(),
            data: sampleContract.data,
            code: sampleContract.code,
        });
    }
}


contract Sample with Common {
    owner: Address;
    master: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    init(master: Address, owner: Address) {
        self.owner = owner;
        self.master = master;
    }

    fun getJettonMaster(): StateInit {
        return initOf JettonMasterTemplate(
            myAddress(),
            Tep64TokenData{
                flag: 1,
                content: "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
            },
        );
    }

    fun getNftCollectionContract(): StateInit {
        return initOf NftCollectionSample(
            myAddress(),
            Tep64TokenData{
                flag: 1,
                content: "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
            },
            "https://s3.laisky.com/uploads/2024/09/nft-sample-item-",
            null,
        );
    }

    fun getStakingMasterContract(): StateInit {
        return initOf StakingMasterTemplate(
            myAddress(),
        );
    }

    fun getStakingWalletContract(): StateInit {
        let master = self.getStakingMasterContract();
        return initOf StakingWalletTemplate(
            contractAddress(master),
            myAddress(),
        );
    }

    bounced(msg: bounced<MintJetton>) {
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }
    bounced(msg: bounced<MintNFT>) {
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    override fun receiveExcesses(msg: Excesses) {
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    // mint new jetton for self, then transfer it to the sender
    receive(msg: MintJetton) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, sender() == self.master);

        let jettonMasterContract = self.getJettonMaster();

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(jettonMasterContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: msg.toCell(),
            code: jettonMasterContract.code,
            data: jettonMasterContract.data,
        });
    }

    // mint new nft for self, then transfer it to the sender
    receive(msg: MintNFT) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, sender() == self.master);

        let nftMasterContract = self.getNftCollectionContract();

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(nftMasterContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: msg.toCell(),
            code: nftMasterContract.code,
            data: nftMasterContract.data,
        });
    }
}


contract NftCollectionSample with NftCollection {
    owner: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = ton("0");

    nextItemIndex: Int as uint256 = 0;
    // collectionContent should follow the format of the TEP-64
    // https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
    collectionContent: Cell;
    // itemContentUrlPrefix is the prefix of the individual NFT's content url.
    // e.g. "https://s3.laisky.com/public/nft/ton-demo/"
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

    // I only prepare 6 items for the demo,
    // so I just return the content by the index % 6.
    override fun getNftContent(index: Int, individualContent: Cell): Cell {
        return Tep64TokenData{
            flag: 1,
            content: beginString()
                .concat(self.itemContentUrlPrefix)
                .concat((index % 6).toString())
                .concat(".json")
                .toString(),
        }.toCell();
    }
}
