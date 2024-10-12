import "@stdlib/ownable";
import "@stdlib/deploy";

import "./errcodes.tact";
import "./messages.tact";

trait Txable {
    owner: Address;
    // staticTax is the tax fee that is charged for each transaction.
    // the tax fee will be saved in the contract's balance.
    staticTax: Int;

    receive(msg: SetStaticTax) {
        self.receiveSetStaticTax(msg);
    }

    get fun staticTax(): Int {
        return self.staticTax;
    }

    virtual fun receiveSetStaticTax(msg: SetStaticTax) {
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

// Common is the common trait that contains some common and useful traits.
trait Common with Txable, Deployable {
    owner: Address;
    staticTax: Int;
    // lockedValue is the value that is locked in the contract,
    // can not be withdrawn by the owner.
    lockedValue: Int;

    // default to forward excesses to the owner
    receive(msg: Excesses) {
        self.receiveExcesses(msg);
    }

    // this is a non-standard method,
    // allows the owner to withdraw unlocked balances
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

    // can be used to reserve the balance for SendRemainingBalance.
    // default to reserve the balance before current transaction plus staticTax.
    //
    // if lockedValue has been increased, the delta should be positive.
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

// Upgradable is the trait that allows the contract to be upgraded.
//
// be careful when using this trait, the contract should be designed to be upgradable.
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

        // not fully tested for data upgrade
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
