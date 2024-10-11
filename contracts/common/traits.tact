import "@stdlib/ownable";
import "@stdlib/deploy";

import "./errcodes.tact";
import "./messages.tact";

trait Txable with OwnableTransferable {
    owner: Address;
    staticTax: Int;

    receive(msg: SetStaticTaxFee) {
        self.receiveSetStaticTaxFee(msg);
    }

    get fun staticTax(): Int {
        return self.staticTax;
    }

    virtual fun receiveSetStaticTaxFee(msg: SetStaticTaxFee) {
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);

        self.staticTax = msg.staticTax;
        let answer = beginString()
            .concat("set static tax fee to ")
            .concat(msg.staticTax.toString())
            .toString();
        self.reply(answer.asComment());
    }
}

trait Nonce {
    nonce: Int;

    get fun nonce(): Int {
        return self.nonce;
    }

    virtual fun checkNonce(receivedNonce: Int) {
        nativeThrowUnless(codeNonceInvalid, receivedNonce > self.nonce);
        self.nonce = receivedNonce;
    }

    virtual fun getNextNonce(): Int {
        self.nonce = self.nonce + 1;
        return self.nonce;
    }
}

// Common is the common trait that will be used by the master contract
trait Common with Txable, Deployable {
    owner: Address;
    staticTax: Int;
    lockedValue: Int;

    // this is a non-standard method, it's used to deposit coins to the wallet.
    receive(msg: Excesses) {
        self.receiveExcesses(msg);
    }

    // this is a non-standard method,
    // allows the owner to withdraw tokens from the wallet.
    receive("withdraw") {
        self.receiveWithdraw();
    }

    virtual fun receiveWithdraw() {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient, myBalance() > (self.lockedValue + self.staticTax));
        nativeReserve(self.lockedValue + self.staticTax, ReserveExact);

        send(SendParameters{
                to: self.owner,
                value: 0,
                mode: SendRemainingBalance,
                bounce: false,
                body: Excesses{queryId: 0}.toCell()
            }
        );
    }

    virtual fun reserveValue(delta: Int) {
        let ctx = context();
        let val = max((myBalance() - ctx.value) + self.staticTax, self.lockedValue + self.staticTax);
        nativeReserve(val + delta, ReserveExact);
    }

    virtual fun receiveExcesses(msg: Excesses) {
        self.reserveValue(0);
        send(SendParameters{
                to: self.owner,
                bounce: false,
                value: 0,
                mode: SendRemainingBalance,
                body: msg.toCell(),
            }
        );
    }
}

@name(set_code)
native setCode(code: Cell);

@name(set_data)
native setData(d: Cell);

trait Upgradable with Ownable {
    owner: Address;

    receive(msg: UpgradeContract) {
        self.receiveUpgradable(msg);
    }

    virtual fun receiveUpgradable(msg: UpgradeContract) {
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);
        if (msg.code != null) {
            setCode(msg.code!!);
        }

        if (msg.data != null) {
            setData(msg.data!!);
        }

        // refund
        send(SendParameters{
                to: msg.responseDestination,
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: Excesses{queryId: msg.queryId}.toCell()
            }
        );
    }
}
