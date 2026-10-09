// =====================================
// https://blog.laisky.com/p/ton-tact/
// =====================================

import "@stdlib/ownable";

import "../common/traits.tact";
import "../common/messages.tact";

import "./errcodes.tact";
import "./messages.tact";
import "./mint_protocol.tact";


// =====================================
// Contracts
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// =====================================


// This is your custom jetton's master contract.
contract JettonMasterTemplate with JettonMaster {
    owner: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    // Cell to store arbitrary data related to the jetton
    //
    // https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#jetton-metadata-example-offchain
    content: Cell;
    // Total number of tokens in existence.
    totalSupply: Int as coins;
    mintable: Bool;
    pendingMints: map<Int as uint64, PendingMint>;
    mintByWallet: map<Address, Int as uint64>;
    pendingMintCount: Int = 0;
    lastMintId: Int = 0;

    init(owner: Address, content: Tep64TokenData) {
        self.owner = owner;

        self.content = content.toCell();
        self.totalSupply = 0;
        self.mintable = true;
        self.pendingMints = emptyMap();
        self.mintByWallet = emptyMap();
    }
}

contract JettonWalletTemplate with JettonWallet {
    // owner is the address of the user who owns the wallet.
    owner: Address;
    // master is the address of the master contract that deployed this wallet.
    master: Address;
    // balance is the number of tokens that the wallet currently holds.
    // unlike the centralized ledger of Ethereum Tokens,
    // TON users keep track of the number of tokens they own in their own wallets.
    balance: Int;
    mintReceipt: Cell? = null;
    lastSettledMintId: Int = 0;
    lastSettledMintAmount: Int = 0;
    // staticTax is the fee that will be charged for each transaction.
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    // The parameters of the init function should not be too complex,
    // as it will be called frequently when generating the jetton wallet address.
    init(master: Address, owner: Address) {
        self.balance = 0;
        self.owner = owner;
        self.master = master;
    }
}

// =====================================
// Traits
//
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// =====================================

@interface("org.ton.jetton.master")
trait JettonMaster with Common {
    owner: Address;
    staticTax: Int;
    lockedValue: Int;

    content: Cell;
    totalSupply: Int;
    mintable: Bool;
    pendingMints: map<Int as uint64, PendingMint>;
    mintByWallet: map<Address, Int as uint64>;
    pendingMintCount: Int;
    lastMintId: Int;

    // this is a non-standard method, it's used to mint new tokens to specified user.
    receive(msg: MintJetton) {
        self.receiveMintJetton(msg);
    }

    // this is a non-standard method, it's used to mint new tokens to multiple users.
    receive(msg: MultiMint) {
        self.receiveMultiMint(msg);
    }

    // this is a TEP-074 standard receiver method,
    // it's used to update the jetton total supply when burning tokens.
    receive(msg: TokenBurnNotification) {
        self.receiveBurnInternal(msg);
    }

    // this is a TEP-89 standard receiver method,
    // it's used to provide the wallet address of the specified owner.
    receive(msg: ProvideWalletAddress) {
        self.receiveProvideWalletAddress(msg);
    }

    // this is a TEP-074 standard getter method
    get fun get_jetton_data(): JettonMasterData {
        return self.getJettonData();
    }

    // this is a TEP-074 standard getter method,
    // generate the jetton wallet address for any user.
    get fun get_wallet_address(owner: Address): Address {
        return self.getWalletAddress(owner);
    }

    virtual fun getWalletAddress(owner: Address): Address {
        return contractAddress(self.getJettonWalletContract(owner));
    }

    virtual fun receiveProvideWalletAddress(msg: ProvideWalletAddress) {
        let walletAddr = self.get_wallet_address(msg.ownerAddress);

        self.reserveValue(0);
        send(SendParameters{
            to: sender(),
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: TakeWalletAddress{
                queryId: msg.queryId,
                walletAddress: walletAddr,
                ownerAddress: msg.includeAddress ? msg.ownerAddress : null,
            }.toCell(),
        });
    }

    virtual fun getJettonWalletContract(owner: Address): StateInit {
        return initOf JettonWalletTemplate(myAddress(), owner);
    }

    virtual fun receiveBurnInternal(msg: TokenBurnNotification) {
        let ctx: Context = context();
        nativeThrowUnless(codeJettonBalanceInsufficient, self.totalSupply >= msg.amount);

        let walletAddr = self.get_wallet_address(msg.sender);
        nativeThrowUnless(codeUnauthorized, sender() == walletAddr);

        self.totalSupply -= msg.amount;

        // refund the excess TON to the sender.
        self.reserveValue(0);
        send(SendParameters{
            to: msg.responseDestination,
            value: 0,
            bounce: false,
            mode: SendRemainingBalance,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    // getMintStatus exposes bounded durable in-flight accounting for monitoring.
    get fun mint_status(): MintStatus {
        return MintStatus{pendingCount: self.pendingMintCount, lastOperationId: self.lastMintId};
    }

    // mintBudget caps each outbound delivery independently of the owner's inflow.
    // The payload DAG is bounded to 32 cells; StateInit and envelope fees are
    // priced from chain config. Unused inflow returns directly to the issuer.
    get fun mint_budget(receiver: Address, forwardAmount: Int, payload: Cell?): Int {
        nativeThrowUnless(codeAmountShouldBePositive, forwardAmount >= 0);
        let cells = 0;
        let bits = 0;
        if (payload != null) {
            cells = mintDataCells(payload!!, 32);
            bits = mintDataBits(payload!!, 32);
        }
        let wallet = self.getJettonWalletContract(receiver);
        let deployment = getForwardFee(
            mintDataCells(wallet.code, 65536) + mintDataCells(wallet.data, 65536) + cells + 16,
            mintDataBits(wallet.code, 65536) + mintDataBits(wallet.data, 65536) + bits + 4096,
            false);
        let receipt = getForwardFee(cells + 16, bits + 4096, false);
        return forwardAmount + 4 * mintStepFee() + deployment + 6 * receipt + 4 * self.staticTax;
    }

    // startMint records an uncommitted receipt and sends a bounded bounceable
    // prepare. One outstanding receipt per wallet permits compact replay state.
    fun startMint(receiver: Address, amount: Int, queryId: Int,
                  responseDestination: Address, forwardAmount: Int,
                  forwardPayload: Cell?, budget: Int) {
        let wallet = self.getJettonWalletContract(receiver);
        let address = contractAddress(wallet);
        nativeThrowUnless(codeMintPendingLimit, self.pendingMintCount < maxPendingMints);
        nativeThrowUnless(codeMintWalletBusy, self.mintByWallet.get(address) == null);
        nativeThrowUnless(codeMintReceiptInvalid, self.lastMintId < 0xffffffffffffffff);
        self.lastMintId += 1;
        let prepared = MintPrepare{operationId: self.lastMintId, amount: amount,
            queryId: queryId, issuer: self.owner, responseDestination: responseDestination,
            forwardAmount: forwardAmount, forwardPayload: forwardPayload}.toCell();
        self.pendingMints.set(self.lastMintId, PendingMint{wallet: address,
            amount: amount, prepared: prepared, committed: false, cancelOnBounce: true,
            responseDestination: responseDestination});
        self.mintByWallet.set(address, self.lastMintId);
        self.pendingMintCount += 1;
        send(SendParameters{to: address, value: budget, bounce: true,
            mode: SendPayGasSeparately, body: prepared, code: wallet.code, data: wallet.data});
    }

    // clearMint removes only the exact authenticated operation, freeing capacity.
    fun clearMint(operationId: Int, pending: PendingMint) {
        self.pendingMints.del(operationId);
        self.mintByWallet.del(pending.wallet);
        self.pendingMintCount -= 1;
    }

    // receiveMintAccepted finalizes supply only after the canonical wallet has
    // durably locked the matching credit. Commit retries do not increment again.
    receive(msg: MintAccepted) {
        let pending = self.pendingMints.get(msg.operationId);
        nativeThrowUnless(codeMintReceiptInvalid, pending != null);
        nativeThrowUnless(codeUnauthorized, sender() == pending!!.wallet);
        nativeThrowUnless(codeMintReceiptInvalid, msg.amount == pending!!.amount);
        let item = pending!!;
        if (!item.committed) {
            item.committed = true;
            self.pendingMints.set(msg.operationId, item);
            self.totalSupply += item.amount;
        }
        self.reserveValue(0);
        send(SendParameters{to: item.wallet, value: 0, bounce: true,
            mode: SendRemainingBalance,
            body: MintCommit{operationId: msg.operationId, amount: item.amount}.toCell()});
    }

    // receiveMintSettled releases master receipt capacity after wallet credit.
    receive(msg: MintSettled) {
        let pending = self.pendingMints.get(msg.operationId);
        nativeThrowUnless(codeMintReceiptInvalid, pending != null);
        nativeThrowUnless(codeUnauthorized, sender() == pending!!.wallet);
        nativeThrowUnless(codeMintReceiptInvalid,
            pending!!.committed && msg.amount == pending!!.amount);
        let destination = pending!!.responseDestination;
        self.clearMint(msg.operationId, pending!!);
        self.reserveValue(0);
        send(SendParameters{to: destination, value: 0, bounce: false,
            mode: SendRemainingBalance,
            body: Excesses{queryId: MintPrepare.fromCell(pending!!.prepared).queryId}.toCell()});
    }

    // receiveRetryMint retransmits the stored prepare/commit with fresh issuer
    // funding. There is no unsafe timeout cancellation of uncertain delivery.
    receive(msg: RetryMint) {
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);
        let pending = self.pendingMints.get(msg.operationId);
        nativeThrowUnless(codeMintReceiptInvalid, pending != null);
        let item = pending!!;
        // A retry makes prepare delivery uncertain: another copy may already
        // have locked credit. A later bounced copy cannot prove cancellation.
        if (!item.committed) {
            item.cancelOnBounce = false;
            self.pendingMints.set(msg.operationId, item);
        }
        let prepare = MintPrepare.fromCell(item.prepared);
        let budget = self.mint_budget(self.owner, prepare.forwardAmount, prepare.forwardPayload);
        nativeThrowUnless(codeInflowValueNotSufficient,
            context().value >= budget + mintStepFee() + self.staticTax);
        self.reserveValue(0);
        send(SendParameters{to: item.wallet, value: budget, bounce: true,
            mode: SendPayGasSeparately,
            body: item.committed
                ? MintCommit{operationId: msg.operationId, amount: item.amount}.toCell()
                : item.prepared});
        send(SendParameters{to: self.owner, value: 0, bounce: false,
            mode: SendRemainingBalance, body: Excesses{queryId: prepare.queryId}.toCell()});
    }

    // bouncedMintPrepare clears an unaccepted mint only on its genuine canonical
    // wallet bounce. Supply was never finalized for this operation.
    bounced(msg: bounced<MintPrepare>) {
        let pending = self.pendingMints.get(msg.operationId);
        if (pending != null && sender() == pending!!.wallet
            && msg.amount == pending!!.amount && !pending!!.committed
            && pending!!.cancelOnBounce) {
            self.clearMint(msg.operationId, pending!!);
            self.reserveValue(0);
            send(SendParameters{to: self.owner, value: 0, bounce: false,
                mode: SendRemainingBalance, body: Excesses{queryId: msg.operationId}.toCell()});
        }
    }

    // bouncedMintCommit retains the committed receipt for an idempotent retry;
    // rolling it back could race a previously delivered wallet credit.
    bounced(msg: MintCommit) {
        let pending = self.pendingMints.get(msg.operationId);
        if (pending != null && sender() == pending!!.wallet
            && msg.amount == pending!!.amount && pending!!.committed) {
            self.reserveValue(0);
            send(SendParameters{to: self.owner, value: 0, bounce: false,
                mode: SendRemainingBalance, body: Excesses{queryId: msg.operationId}.toCell()});
        }
    }

    virtual fun receiveMintJetton(msg: MintJetton) {
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);
        nativeThrowUnless(codeNotMintable, self.mintable);
        nativeThrowUnless(codeAmountShouldBePositive, msg.amount > 0);
        let budget = self.mint_budget(msg.receiver, msg.forwardAmount, msg.forwardPayload);
        nativeThrowUnless(codeInflowValueNotSufficient,
            context().value >= budget + mintStepFee() + self.staticTax);
        self.reserveValue(0);
        self.startMint(msg.receiver, msg.amount, msg.queryId, msg.responseDestination,
            msg.forwardAmount, msg.forwardPayload, budget);
        send(SendParameters{to: self.owner, value: 0, bounce: false,
            mode: SendRemainingBalance, body: Excesses{queryId: msg.queryId}.toCell()});
    }

    // receiveMultiMint bounds the batch and correlates each independent receipt.
    // tonAmount remains an outbound budget, never an unlimited inflow forward.
    virtual fun receiveMultiMint(msg: MultiMint) {
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);
        nativeThrowUnless(codeNotMintable, self.mintable);
        nativeThrowUnless(codeMintPendingLimit, msg.receiverCount > 0
            && msg.receiverCount <= maxMintBatch
            && self.pendingMintCount + msg.receiverCount <= maxPendingMints);
        let total = 0;
        let i = 0;
        while (i < msg.receiverCount) {
            let entry = msg.receivers.get(i);
            nativeThrowUnless(codeMapIndexNotExists, entry != null);
            nativeThrowUnless(codeAmountShouldBePositive, entry!!.amount > 0);
            let budget = self.mint_budget(entry!!.receiver,
                entry!!.forwardAmount, entry!!.forwardPayload);
            nativeThrowUnless(codeReceiverInsufficientReceiverTonAmount,
                entry!!.tonAmount >= budget);
            total += entry!!.tonAmount;
            i += 1;
        }
        nativeThrowUnless(codeInflowValueNotSufficient,
            context().value >= total + msg.receiverCount * mintStepFee() + self.staticTax);
        self.reserveValue(0);
        i = 0;
        while (i < msg.receiverCount) {
            let entry = msg.receivers.get(i)!!;
            self.startMint(entry.receiver, entry.amount, msg.queryId,
                entry.responseDestination, entry.forwardAmount,
                entry.forwardPayload, entry.tonAmount);
            i += 1;
        }
        send(SendParameters{to: self.owner, value: 0, bounce: false,
            mode: SendRemainingBalance, body: Excesses{queryId: msg.queryId}.toCell()});
    }

    virtual fun getJettonData(): JettonMasterData {
        return JettonMasterData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            owner: self.owner,
            content: self.content,
            walletCode: self.getJettonWalletContract(myAddress()).code
        };
    }
}

@interface("org.ton.jetton.wallet")
trait JettonWallet with Common {
    // owner is the address of the user who owns the wallet.
    owner: Address;
    // master is the address of the master contract that deployed this wallet.
    master: Address;
    // balance is the number of tokens that the wallet currently holds.
    // unlike the centralized ledger of Ethereum Tokens,
    // TON users keep track of the number of tokens they own in their own wallets.
    balance: Int;
    mintReceipt: Cell?;
    lastSettledMintId: Int;
    lastSettledMintAmount: Int;
    // staticTax is the fee that will be charged for each transaction.
    staticTax: Int;
    lockedValue: Int;

    // this is a TEP-074 standard receiver method,
    // owner can transfer tokens to another jetton wallet
    // by sending TokenTransfer message to the contract.
    receive(msg: TokenTransfer) {
        self.receiveTokenTransfer(msg);
    }

    // this is unspecified by standard, but suggested format of internal message.
    // receive tokens from another jetton wallet
    receive(msg: TokenTransferInternal) {
        self.receiveTokenTransferInternal(msg);
    }

    // this is a TEP-074 standard receiver method
    receive(msg: Burn) {
        self.receiveBurn(msg);
    }

    // this is a TEP-074 standard getter method
    get fun get_wallet_data(): JettonWalletData {
        return self.getWalletData();
    }

    // getWalletMintStatus exposes prepared credit excluded from spendable balance.
    get fun mint_status(): WalletMintStatus {
        let operationId = 0;
        let locked = 0;
        if (self.mintReceipt != null) {
            let receipt = MintPrepare.fromCell(self.mintReceipt!!);
            operationId = receipt.operationId;
            locked = receipt.amount;
        }
        return WalletMintStatus{operationId: operationId,
            lockedAmount: locked, lastSettledId: self.lastSettledMintId};
    }

    // receiveMintPrepare locks a canonical master credit and sends a mandatory
    // acknowledgement. Failed ACK sending rolls back the entire prepare.
    receive(msg: MintPrepare) {
        nativeThrowUnless(codeUnauthorized, sender() == self.master);
        nativeThrowUnless(codeAmountShouldBePositive, msg.amount > 0);
        nativeThrowUnless(codeMintReceiptInvalid, msg.operationId > 0);
        if (msg.operationId == self.lastSettledMintId) {
            nativeThrowUnless(codeMintReceiptInvalid, msg.amount == self.lastSettledMintAmount);
            self.sendMintSettled(msg.operationId, msg.amount);
        } else {
            nativeThrowUnless(codeMintReceiptInvalid, msg.operationId > self.lastSettledMintId);
            nativeThrowUnless(codeInflowValueNotSufficient,
                context().value > msg.forwardAmount + self.staticTax + 3 * mintStepFee());
            if (self.mintReceipt != null) {
                nativeThrowUnless(codeMintReceiptInvalid,
                    self.mintReceipt!!.hash() == msg.toCell().hash());
            } else {
                self.mintReceipt = msg.toCell();
            }
            self.reserveValue(0);
            send(SendParameters{to: self.master, value: 0, bounce: true,
                mode: SendRemainingBalance,
                body: MintAccepted{operationId: msg.operationId, amount: msg.amount}.toCell()});
        }
    }

    // receiveMintCommit unlocks only the receipt whose supply the master already
    // committed. It remembers the last settled ID to make retries idempotent.
    receive(msg: MintCommit) {
        nativeThrowUnless(codeUnauthorized, sender() == self.master);
        if (msg.operationId == self.lastSettledMintId) {
            nativeThrowUnless(codeMintReceiptInvalid, msg.amount == self.lastSettledMintAmount);
            self.sendMintSettled(msg.operationId, msg.amount);
        } else {
            nativeThrowUnless(codeMintReceiptInvalid, self.mintReceipt != null);
            let receipt = MintPrepare.fromCell(self.mintReceipt!!);
            nativeThrowUnless(codeMintReceiptInvalid,
                msg.operationId == receipt.operationId && msg.amount == receipt.amount);
            self.balance += receipt.amount;
            self.lastSettledMintId = receipt.operationId;
            self.lastSettledMintAmount = receipt.amount;
            self.mintReceipt = null;
            if (receipt.forwardAmount > 0) {
                send(SendParameters{to: self.owner, value: receipt.forwardAmount,
                    bounce: false, mode: SendIgnoreErrors,
                    body: TransferNotification{queryId: receipt.queryId,
                        amount: receipt.amount, sender: receipt.issuer,
                        forwardPayload: receipt.forwardPayload}.toCell()});
            }
            self.sendMintSettled(msg.operationId, msg.amount);
        }
    }

    // sendMintSettled preserves preexisting TON without letting a tax change
    // interrupt a prepared mint. Only prepare charges the wallet's static tax.
    fun sendMintSettled(operationId: Int, amount: Int) {
        nativeReserve(max(myBalance() - context().value, self.lockedValue), ReserveExact);
        send(SendParameters{to: self.master, value: 0, bounce: true,
            mode: SendRemainingBalance,
            body: MintSettled{operationId: operationId, amount: amount}.toCell()});
    }

    // Bounced receipts never unlock unconfirmed tokens or roll back delivered
    // credit. The issuer can fund RetryMint against the durable master receipt.
    bounced(msg: MintAccepted) {}
    bounced(msg: MintSettled) {}

    bounced(src: bounced<TokenTransferInternal>) {
        self.balance += src.amount;
    }

    bounced(src: bounced<TokenBurnNotification>) {
        self.balance += src.amount;
    }

    virtual fun getJettonWalletContract(owner: Address): StateInit {
        return initOf JettonWalletTemplate(self.master, owner);
    }

    virtual fun receiveTokenTransfer(msg: TokenTransfer) {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeJettonBalanceInsufficient, self.balance >= msg.amount);
        nativeThrowUnless(codeAmountShouldBePositive, msg.amount > 0);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= msg.forwardAmount + self.staticTax);

        self.balance -= msg.amount;

        let destJettonContract = self.getJettonWalletContract(msg.destination);

        // deploy the wallet if it's not deployed yet,
        // then transfer the tokens to the wallet.
        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(destJettonContract),
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
                forwardAmount: msg.forwardAmount,
                forwardPayload: msg.forwardPayload
            }.toCell(),
            code: destJettonContract.code,
            data: destJettonContract.data
        });
    }

    virtual fun receiveTokenTransferInternal(msg: TokenTransferInternal){
        let ctx: Context = context();
        nativeThrowUnless(codeAmountShouldBePositive, msg.amount > 0);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value > msg.forwardAmount + self.staticTax);

        // only the owner or another jetton wallet can send TokenTransferInternal
        nativeThrowUnless(codeUnauthorized, ctx.sender != self.master);
        if (ctx.sender != self.master) {
            let peerJettonContractAddr = contractAddress(self.getJettonWalletContract(msg.from));
            nativeThrowUnless(codeUnauthorized, ctx.sender == peerJettonContractAddr);
        }

        // Update balance
        self.balance += msg.amount;

        // https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
        // if forward_amount > 0 ensure that receiver's jetton-wallet
        // send message to destination address, which means the new owner of the token
        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: self.owner,
                value: msg.forwardAmount,
                bounce: false,
                mode: SendIgnoreErrors,
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

    virtual fun receiveBurn(msg: Burn) {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient, self.balance >= msg.amount);
        nativeThrowUnless(codeAmountShouldBePositive, msg.amount > 0);

        // Update balance
        self.balance -= msg.amount;

        // notify master to update totalSupply
        self.reserveValue(0);
        send(SendParameters{
            to: self.master,
            value: 0,
            mode: SendRemainingBalance,
            bounce: true,
            body: TokenBurnNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.owner,
                responseDestination: msg.responseDestination,
            }.toCell(),
        });
    }

    virtual fun getWalletData(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            owner: self.owner,
            master: self.master,
            walletCode: self.getJettonWalletContract(self.owner).code,
        };
    }
}
