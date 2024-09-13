// =====================================
// https://testnet.tonviewer.com/transaction/275a294d5a80852ca205449d7cfe4bc015329f0eb4b988a08c4d09bd31556862
// =====================================

import "../jetton/jetton.tact";
import "../jetton/messages.tact";
import "../nft/nft.tact";
import "../nft/messages.tact";
import "../common/traits.tact";
import "./messages.tact";
import "./errcodes.tact";


contract SampleMaster with Common {
    owner: Address;
    staticTaxFee: Int as coins = ton("0.01");
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
            body: msg.toCell(),
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
            body: msg.toCell(),
            data: sampleContract.data,
            code: sampleContract.code,
        });
    }
}


contract Sample with Common {
    owner: Address;
    master: Address;
    staticTaxFee: Int as coins = ton("0.01");
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
    receive(msg: MintJettonSample) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, sender() == self.master);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= ton("0.1"));

        let jettonMasterContract = self.getJettonMaster();

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(jettonMasterContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: MintJetton{
                queryId: msg.queryId,
                amount: msg.amount,
                receiver: myAddress(),
                responseDestination: myAddress(),
                forwardTonAmount: ton("0.1"),
                forwardPayload: emptyCell(),
            }.toCell(),
            code: jettonMasterContract.code,
            data: jettonMasterContract.data,
        });
    }

    // transfer jetton to the destination
    receive(msg: TransferNotification) {
        let jettonMasterContract = self.getJettonMaster();
        let jettonWalletContract = initOf JettonWalletTemplate(
            contractAddress(jettonMasterContract),
            myAddress(),
        );

        nativeThrowUnless(codeUnauthorized, sender() == contractAddress(jettonWalletContract));

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(jettonWalletContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: TokenTransfer{
                queryId: msg.queryId,
                amount: msg.amount,
                destination: self.owner,
                responseDestination: self.owner,
                forwardTonAmount: ton("0"),
            }.toCell(),
        });
    }

    // mint new nft for self, then transfer it to the sender
    receive(msg: MintNftSample) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, sender() == self.master);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= ton("0.1"));

        let nftMasterContract = initOf NftCollection(
            myAddress(),
            "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
            "https://s3.laisky.com/uploads/2024/09/nft-sample-item-",
            null,
        );

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(nftMasterContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: MintNFT{
                queryId: msg.queryId,
                newOwner: myAddress(),
                forwardAmount: ton("0.1"),
                forwardPayload: emptyCell(),
            }.toCell(),
            code: nftMasterContract.code,
            data: nftMasterContract.data,
        });
    }

    // transfer nft to the destination
    receive(msg: OwnershipAssigned) {
        nativeThrowUnless(codeForwardPayloadInvalid, msg.forwardPayload != null);
        let forwardData = NftItemInitForwardPayload.fromCell(msg.forwardPayload!!);

        let nftMasterContract = initOf NftCollection(
            myAddress(),
            "https://s3.laisky.com/uploads/2024/09/nft-sample-collection.json",
            "https://s3.laisky.com/uploads/2024/09/nft-sample-item-",
            null,
        );
        let nftItemContract = initOf NftItem(
            contractAddress(nftMasterContract),
            forwardData.index,
        );

        nativeThrowUnless(codeUnauthorized, sender() == contractAddress(nftItemContract));

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(nftItemContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: NFTTransfer{
                queryId: msg.queryId,
                newOwner: self.owner,
                responseDestination: self.owner,
                forwardAmount: ton("0"),
                forwardPayload: emptyCell(),
                customPayload: emptyCell(),
            }.toCell(),
        });
    }
}
