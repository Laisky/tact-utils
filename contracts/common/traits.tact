import "@stdlib/ownable";

import "./errcodes.tact";
import "./messages.tact";


trait Txable with OwnableTransferable {
    owner: Address;
    staticTaxFee: Int;

    receive(msg: SetStaticTaxFee){
        self.receiveSetStaticTaxFee(msg);
    }

    get fun staticTaxFee(): Int {
        return self.staticTaxFee;
    }

    virtual fun receiveSetStaticTaxFee(msg: SetStaticTaxFee){
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);

        self.staticTaxFee = msg.staticTaxFee;
        let answer = beginString()
            .concat("set static tax fee to ")
            .concat(msg.staticTaxFee.toString())
            .toString();
        self.reply(answer.asComment());
    }
}

trait Nonce {
    nonce: Int;

    get fun nonce(): Int {
        return self.nonce;
    }

    virtual fun checkAndUpdateNonce(receivedNonce: Int){
        nativeThrowUnless(codeNonceInvalid, receivedNonce > self.nonce);
        self.nonce = receivedNonce;
    }

    virtual fun getNextNonce(): Int {
        self.nonce = self.nonce + 1;
        return self.nonce;
    }
}


// Common is the common trait that will be used by the master contract
trait Common with Txable {
    owner: Address;
    staticTaxFee: Int;
    lockedValue: Int;

    // this is a non-standard method, it's used to deposit coins to the wallet.
    receive(msg: Excesses) {
        self.receiveExcesses(msg);
    }

    // this is a non-standard method,
    // allows the owner to withdraw tokens from the wallet.
    receive("withdraw"){
        self.receiveWithdraw();
    }

    virtual fun receiveWithdraw() {
                let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient,
            myBalance() > self.lockedValue + self.staticTaxFee);

        nativeReserve(self.lockedValue + self.staticTaxFee, ReserveExact);
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: Excesses{
                queryId: 0,
            }.toCell(),
        });
    }

    virtual fun reserveValue(delta: Int) {
        let ctx = context();
        let val = max(myBalance() - ctx.value + self.staticTaxFee, self.lockedValue + self.staticTaxFee);
        nativeReserve(val + delta, ReserveExact);
    }

    virtual fun receiveExcesses(msg: Excesses) {
        return;
    }

    fun verifyMerkleProof(root: Cell, proof: Slice, value: Slice): Bool {
        let hash = value.hash();
        let proofSlice = proof;

        while (proofSlice.bits() > 0) {
            let siblingHash = proofSlice.loadInt(256);
            if (hash < siblingHash) {
                hash = beginCell().storeInt(hash, 256).storeInt(siblingHash, 256).endCell().hash();
            } else {
                hash = beginCell().storeInt(siblingHash, 256).storeInt(hash, 256).endCell().hash();
            }
        }

        return hash == root.hash();
    }
}
