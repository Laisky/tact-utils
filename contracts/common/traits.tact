import "@stdlib/ownable";
import "@stdlib/deploy";

import "./errcodes.tact";
import "./messages.tact";

// The native sha256 in Tact truncates the input, computing only the first 128 bytes.
// Using fullSha256 allows computing the complete sha256 value.
//
// - https://github.com/tact-lang/tact/issues/1056
// - https://docs.tact-lang.org/book/assembly-functions/#onchainsha256
fun fullSha256(data: String): Int {
    _onchainShaPush(data);
    while (_onchainShaShouldProceed()) {
        _onchainShaOperate();
    }
    return _onchainShaHashExt();
}

// Helper assembly functions,
// each manipulating the stack in their own ways
// in different parts of the `fullSha256()` function
asm fun _onchainShaPush(data: String) { ONE }
asm fun _onchainShaShouldProceed(): Bool { OVER SREFS 0 NEQINT }
asm fun _onchainShaOperate() { OVER LDREF s0 POP CTOS s0 s1 XCHG INC }
asm fun _onchainShaHashExt(): Int { HASHEXT_SHA256 }

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

    get fun tonBalance(): Int {
        return myBalance();
    }

    virtual fun receiveWithdraw() {
        let ctx: Context = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);
        nativeThrowUnless(codeBalanceNotSufficient,
            myBalance() > (self.lockedValue + self.staticTax));

        // if there is some locked value in the contract,
        // should reserve the balance a little more than the locked value.
        if (self.lockedValue != 0) {
            nativeReserve(self.lockedValue + self.staticTax, ReserveExact);
        }

        send(SendParameters{
                to: self.owner,
                value: 0,
                mode: SendRemainingBalance,
                bounce: false,
                body: Excesses{queryId: 0}.toCell()
            }
        );
    }

    fun fullSha256(data: String): Int {
        return fullSha256(data);
    }

    fun verifyMerkleSha256(proof: MerkleProof) {
        nativeThrowUnless(codeMerkleNotEnoughProof, proof.proofLen > 1);

        let cur = proof.data.hash();
        let i = 0;
        while (i < proof.proofLen) {
            let right = proof.proof.get(i);

            nativeThrowUnless(codeMerkleInvalidNullRight, right != null);

            cur = self.fullSha256(beginString()
                .concat(self.int2hex(cur))
                .concat(self.int2hex(right!!))
                .toString());

            i += 1;
        }

        nativeThrowUnless(codeMerkleInvalidRoot, cur == proof.root);
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

    fun int2hex(n: Int): String {
        let store: map<Int, Int> = emptyMap();
        let nextPos = 63; // Fixed 64 chars (32 bytes) output

        // Convert to positive BigInt
        let num = n;
        if (num < 0) {
            num = -num;
        }

        // Calculate hex digits
        while (num > 0) {
            let remainder = num % 16;
            store.set(nextPos, remainder);
            nextPos -= 1;
            num = num / 16;
        }

        // Pad with zeros
        while (nextPos >= 0) {
            store.set(nextPos, 0);
            nextPos -= 1;
        }

        // Build hex string
        let result = beginString();
        let i = 0;
        while (i < 64) {
            let v = store.get(i) != null ? store.get(i)!! : 0;
            if (v < 10) {
                result.append(v.toString());
            } else {
                // Use ASCII values for A-F
                result.append(
                    (v == 10 ? "a" :
                        v == 11 ? "b" :
                        v == 12 ? "c" :
                        v == 13 ? "d" :
                        v == 14 ? "e" : "f")
                );
            }

            i += 1;
        }

        return result.toString();
    }}

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
