import "@stdlib/ownable";

import "./errcodes.tact";
import "./messages.tact";

// SetStaticTaxFee is the message that used to set the static tax fee.
message(0x1509a420) SetStaticTaxFee {
    staticTaxFee: Int;
}

trait Txable with OwnableTransferable {
    owner: Address;
    staticTaxFee: Int = ton("0");

    get fun staticTaxFee(): Int {
        return self.staticTaxFee;
    }

    receive(msg: SetStaticTaxFee){
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

    fun checkAndUpdateNonce(receivedNonce: Int){
        nativeThrowUnless(codeNonceInvalid, receivedNonce > self.nonce);
        self.nonce = receivedNonce;
    }

    fun getNonce(): Int {
        self.nonce = self.nonce + 1;
        return self.nonce;
    }
}


// Common is the common trait that will be used by the master contract
trait Common with Txable {
    owner: Address;
    staticTaxFee: Int;
    lockedValue: Int;

    fun reserveValue(delta: Int) {
        let ctx = context();
        let val = max(myBalance() - ctx.value + self.staticTaxFee, self.lockedValue + self.staticTaxFee);
        nativeReserve(val + delta, ReserveExact);
    }

    virtual fun receiveExcesses(msg: Excesses) {
        return;
    }

    // this is a non-standard method, it's used to deposit coins to the wallet.
    receive(msg: Excesses) {
        self.receiveExcesses(msg);
    }

    // this is a non-standard method,
    // allows the owner to withdraw tokens from the wallet.
    receive("withdraw"){
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient, myBalance() > self.lockedValue);

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
}
