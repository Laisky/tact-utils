// =====================================
// https://blog.laisky.com/p/ton-tact/
// =====================================

import "@stdlib/ownable";
import "./errcodes.tact";
import "./messages.tact";
import "../common/traits.tact";
import "../common/messages.tact";


// =====================================
// Main contract
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// =====================================


// This is your custom jetton's master contract.
contract JettonMaster with Common {
    owner: Address;
    staticTaxFee: Int as coins = ton("0.01");
    lockedValue: Int as coins = 0;

    // Cell to store arbitrary data related to the jetton
    //
    // https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#jetton-metadata-example-offchain
    content: Cell;
    // Total number of tokens in existence.
    totalSupply: Int as coins;
    mintable: Bool;

    init(owner: Address, content: Tep64TokenData){
        self.owner = owner;

        self.content = content.toCell();
        self.totalSupply = 0;
        self.mintable = true;
    }

    fun getJettonContract(owner: Address): StateInit {
        return initOf JettonWallet(myAddress(), owner);
    }

    // this is a non-standard method, it's used to mint new tokens to specified user.
    receive(msg: MintJetton){
        let ctx: Context = context();
        // This is my personal preference: I think nativeThrowUnless more useful
        // than require because it lets you customize the code.
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);

        self.mint(msg);
    }

    // this is a non-standard method, it's used to mint new tokens to multiple users.
    fun mint(msg: MintJetton){
        let ctx = context();
        nativeThrowUnless(codeNotMintable, self.mintable);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.forwardTonAmount);

        self.totalSupply = self.totalSupply + msg.amount;
        let jettonWallet = self.getJettonContract(msg.receiver);

        // deploy the wallet if it's not deployed yet,
        // then send the minted tokens to the wallet.
        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(jettonWallet),
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: TokenTransferInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                from: sender(),
                responseDestination: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload,
            }.toCell(),
            code: jettonWallet.code,
            data: jettonWallet.data
        });
    }

    // this is a non-standard method, it's used to mint new tokens to multiple users.
    receive(msg: MultiMint){
        let ctx: Context = context();
        nativeThrowUnless(codeNotMintable, self.mintable);
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);

        let totalTonAmount: Int = 0;
        let i: Int = 0;
        while (i < msg.receiverCount) {
            let receiver = msg.receivers.get(i);
            nativeThrowUnless(codeMapIndexNotExists, receiver != null);

            self.totalSupply = self.totalSupply + receiver!!.amount;
            totalTonAmount = totalTonAmount + receiver!!.tonAmount;

            let jettonWallet = self.getJettonContract(receiver!!.address);
            send(SendParameters{
                to: contractAddress(jettonWallet),
                value: receiver!!.tonAmount,
                bounce: false,
                body: TokenTransferInternal{
                    queryId: msg.queryId,
                    amount: receiver!!.amount,
                    from: sender(),
                    responseDestination: sender(),
                    forwardTonAmount: 0,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
                code: jettonWallet.code,
                data: jettonWallet.data
            });

            i = i + 1;
        }

        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= totalTonAmount);

        // refund
        self.reserveValue(0);
        send(SendParameters{
            to: sender(),
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: Excesses{queryId: 0}.toCell(),
        });
    }

    // this is a non-standard method, it's used to deposit coins to the wallet.
    receive("deposit") {}

    // this is a non-standard method,
    // allows the owner to withdraw tokens from the wallet.
    receive(msg: Withdraw){
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient, myBalance() > self.lockedValue);

        nativeReserve(self.lockedValue + self.staticTaxFee, ReserveExact);
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: "withdraw".asComment(),
        });
    }

    // this is a TEP-074 standard getter method
    get fun get_jetton_data(): JettonMasterData {
        return JettonMasterData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            owner: self.owner,
            content: self.content,
            walletCode: self.getJettonContract(myAddress()).code
        };
    }

    // this is a TEP-074 standard getter method,
    // generate the jetton wallet address for any user.
    get fun get_wallet_address(owner: Address): Address {
        return contractAddress(self.getJettonContract(owner));
    }
}


contract JettonWallet with Common {
    // owner is the address of the user who owns the wallet.
    owner: Address;
    // master is the address of the master contract that deployed this wallet.
    master: Address;
    // balance is the number of tokens that the wallet currently holds.
    // unlike the centralized ledger of Ethereum Tokens,
    // TON users keep track of the number of tokens they own in their own wallets.
    balance: Int;
    // staticTaxFee is the fee that will be charged for each transaction.
    staticTaxFee: Int as coins = ton("0.01");
    lockedValue: Int as coins = 0;

    // The parameters of the init function should not be too complex,
    // as it will be called frequently when generating the jetton wallet address.
    init(master: Address, owner: Address){
        self.balance = 0;
        self.owner = owner;
        self.master = master;
    }

    fun getJettonContract(owner: Address): StateInit {
        return initOf JettonWallet(self.master, owner);
    }

    bounced(src: bounced<TokenTransferInternal>){
        self.balance = self.balance + src.amount;
    }

    // this is a TEP-074 standard receiver method,
    // owner can transfer tokens to another jetton wallet
    // by sending TokenTransfer message to the contract.
    receive(msg: TokenTransfer){
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient, self.balance >= msg.amount);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.forwardTonAmount);

        self.balance = self.balance - msg.amount;

        // deploy the wallet if it's not deployed yet,
        // then transfer the tokens to the wallet.
        self.reserveValue(0);
        let jettonContract = self.getJettonContract(msg.destination);
        send(SendParameters{
            to: contractAddress(jettonContract),
            value: 0,
            mode: SendRemainingBalance,
            // amount could be negative, it is impossible to pre-confirm whether
            // the receiver has enough balance to cover the negative amount,
            // which means the transfer may fail. If that happens,
            // the contract's balance must be adjusted using a bounced message.
            bounce: true,
            body: TokenTransferInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.owner,
                responseDestination: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload
            }.toCell(),
            code: jettonContract.code,
            data: jettonContract.data
        });
    }

    // this is unspecified by standard, but suggested format of internal message.
    // receive tokens from another jetton wallet
    receive(msg: TokenTransferInternal){
        let ctx: Context = context();

        // only the owner or another jetton wallet can send TokenTransferInternal
        if (ctx.sender != self.master) {
            let peerJettonContractAddr = contractAddress(self.getJettonContract(msg.from));
            nativeThrowUnless(codeUnauthorized, ctx.sender == peerJettonContractAddr);
        }

        nativeThrowUnless(codeInflowValueNotSufficient, self.balance + msg.amount >= 0);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value > msg.forwardTonAmount);

        // Update balance
        self.balance = self.balance + msg.amount;

        // send TransferNotification only if forwardTonAmount > 0
        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                value: msg.forwardTonAmount,
                bounce: false,
                // mode: SendIgnoreErrors,
                body: TransferNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    sender: msg.from,
                    forwardPayload: msg.forwardPayload
                }.toCell()
            });
        }

        // refund the excess TON to the sender.
        //
        // using the SendRemainingBalance mode will transfer all balances
        // that are not locked by nativeReserve.
        // https://docs.tact-lang.org/ref/core-advanced#nativereserve
        self.reserveValue(0);
        send(SendParameters{
            to: msg.responseDestination,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: Excesses{queryId: msg.queryId}.toCell(),
        });
    }

    // this is a TEP-074 standard receiver method
    receive(msg: Burn){
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeInflowValueNotSufficient, msg.amount >= 0);
        nativeThrowUnless(codeBalanceNotSufficient, self.balance >= msg.amount);

        // Update balance
        self.balance = self.balance - msg.amount;

        self.reserveValue(0);
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: Excesses{
                queryId: msg.queryId
            }.toCell(),
        });
    }

    receive("deposit") {}

    // this is a non-standard method,
    // allows the owner to withdraw tokens from the wallet.
    receive(msg: Withdraw){
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient, myBalance() > self.lockedValue);

        nativeReserve(self.lockedValue + self.staticTaxFee, ReserveExact);
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: "withdraw".asComment(),
        });
    }

    // this is a TEP-074 standard getter method
    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            owner: self.owner,
            master: self.master,
            walletCode: self.getJettonContract(self.owner).code,
        };
    }
}
