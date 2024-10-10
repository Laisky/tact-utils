// =====================================
// https://blog.laisky.com/p/ton-tact/
// =====================================

import "@stdlib/ownable";
import "@stdlib/deploy";

import "../common/traits.tact";
import "../common/messages.tact";

import "./errcodes.tact";
import "./messages.tact";

// =====================================
// Contract Templates
// =====================================

contract StakingMasterTemplate with StakingMaster {
    owner: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    init(owner: Address) {
        self.owner = owner;
    }
}

contract StakingWalletTemplate with StakingWallet {
    owner: Address;
    master: Address;
    staticTax: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    stakedJettons: map<Address, StakedJettonInfo> = emptyMap();
    stakedTon: Int as coins = 0;

    init(master: Address, owner: Address) {
        self.owner = owner;
        self.master = master;
    }
}

// =====================================
// Contract Traits
// =====================================

trait StakingMaster with Common {
    owner: Address;
    staticTax: Int;
    lockedValue: Int;

    get fun userWallet(owner: Address): Address {
        return contractAddress(self.getUserWallet(owner));
    }

    receive(msg: StakeRelease) {
        self.receiveRelease(msg);
    }

    receive(msg: TransferNotification) {
        self.receiveTransferNotification(msg);
    }

    receive(msg: StakeToncoin) {
        self.receiveStakeToncoin(msg);
    }

    virtual fun receiveStakeToncoin(msg: StakeToncoin) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= msg.amount + msg.forwardTonAmount + self.staticTax);
        nativeThrowUnless(codeStakeAmountMustBePositive, msg.amount > 0);

        self.lockedValue += msg.amount;

        let userStakeWallet = self.getUserWallet(sender());

        self.reserveValue(msg.amount);
        send(SendParameters{
            to: contractAddress(userStakeWallet),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: msg.toCell(),
            data: userStakeWallet.data,
            code: userStakeWallet.code,
        });
    }

    virtual fun receiveRelease(msg: StakeRelease) {
        let ctx = context();

        // check sender
        nativeThrowUnless(codeUnauthorized,
            ctx.sender == contractAddress(self.getUserWallet(msg.owner)));

        let totalCost: Int = msg.amount;

        // release ton coins
        if (msg.amount > 0) {
            nativeThrowUnless(codeBalanceNotSufficient, self.lockedValue >= msg.amount);
            send(SendParameters{
                to: msg.destination,
                bounce: false,
                value: msg.amount,
                body: msg.customPayload,
            });
        }

        // release jettons
        let i: Int = 0;
        while (i < msg.jettonsIdx) {
            let jetton = msg.jettons.get(i)!!;
            totalCost += jetton.tonAmount;

            send(SendParameters{
                to: jetton.destination,
                bounce: false,
                value: jetton.tonAmount,
                body: TokenTransfer{
                    queryId: msg.queryId,
                    amount: jetton.jettonAmount,
                    destination: jetton.destination,
                    responseDestination: msg.responseDestination,
                    customPayload: jetton.customPayload,
                    forwardTonAmount: jetton.forwardTonAmount,
                    forwardPayload: jetton.forwardPayload,
                }.toCell(),
            });

            i += 1;
        }

        // check cost
        totalCost += msg.forwardTonAmount;
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= totalCost + self.staticTax);

        // forward
        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                bounce: false,
                value: msg.forwardTonAmount,
                body: StakeReleaseNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    jettons: msg.jettons,
                    jettonsIdx: msg.jettonsIdx,
                    destination: msg.destination,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // refund
        self.reserveValue(-msg.amount);
        send(SendParameters{
            to: msg.responseDestination,
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    // user transfer jetton to staking master address,
    // and send TransferNotification to the staking master.
    virtual fun receiveTransferNotification(msg: TransferNotification) {
        let ctx = context();
        nativeThrowUnless(codeForwardPayloadInvalid, msg.forwardPayload != null);
        nativeThrowUnless(codeStakeAmountMustBePositive, msg.amount >= 0);

        let stakeMsg = StakeJetton.fromCell(msg.forwardPayload!!);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= stakeMsg.tonAmount + stakeMsg.forwardTonAmount + self.staticTax);
        nativeThrowUnless(codeStakeAmountMustBePositive, stakeMsg.tonAmount >= 0);

        let userStakeWallet = self.getUserWallet(msg.sender);
        stakeMsg.queryId = msg.queryId;
        stakeMsg.jettonWallet = sender();
        stakeMsg.sender = msg.sender;
        stakeMsg.jettonAmount = msg.amount;

        // update balance for user's stake wallet
        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(userStakeWallet),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: stakeMsg.toCell(),
            data: userStakeWallet.data,
            code: userStakeWallet.code,
        });
    }

    // getWalletContract creates a new wallet contract for the specified owner
    virtual fun getUserWallet(owner: Address): StateInit {
        let init = initOf StakingWalletTemplate(
            myAddress(),
            owner,
        );

        return init;
    }
}

trait StakingWallet with Common {
    owner: Address;
    master: Address;
    staticTax: Int;
    lockedValue: Int;

    // stakedJettons is the map of staked jettons.
    // key is the address of the jetton wallet contract.
    stakedJettons: map<Address, StakedJettonInfo>;
    stakedTon: Int;

    get fun stakedInfo(): StakedInfo {
        return self.getStakedInfo();
    }

    receive(msg: StakeToncoin) {
        self.receiveStakeToncoin(msg);
    }

    receive(msg: StakeRelease) {
        self.receiveRelease(msg);
    }

    receive(msg: StakeJetton) {
        self.receiveStakeJetton(msg);
    }

    virtual fun receiveStakeJetton(msg: StakeJetton) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.master);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= msg.tonAmount + msg.forwardTonAmount + self.staticTax);
        nativeThrowUnless(codeMsgValueInvalid, msg.jettonWallet != null);
        nativeThrowUnless(codeMsgValueInvalid, msg.sender != null);
        nativeThrowUnless(codeMsgValueInvalid, msg.queryId != null);
        nativeThrowUnless(codeMsgValueInvalid, msg.jettonAmount != null);
        nativeThrowUnless(codeStakeAmountMustBePositive, msg.tonAmount >= 0);
        nativeThrowUnless(codeStakeAmountMustBePositive, msg.jettonAmount!! >= 0);

        dump("stake jetton wallet");
        dump(msg.jettonWallet!!.toString());

        // update staked info
        self.stakedTon += msg.tonAmount;
        self.stakedJettons.set(
            msg.jettonWallet!!,
            StakedJettonInfo{
                jettonAmount: msg.jettonAmount!!,
            }
        );

        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                bounce: false,
                value: msg.forwardTonAmount,
                body: StakeNotification{
                    queryId: msg.queryId!!,
                    amount: msg.tonAmount,
                    jetton: msg,
                    sender: msg.sender!!,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // refund
        self.reserveValue(0);
        send(SendParameters{
            to: msg.responseDestination,
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: Excesses{
                queryId: msg.queryId!!,
            }.toCell(),
        });
    }

    virtual fun receiveRelease(msg: StakeRelease) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);

        // release ton coins
        if (msg.amount > 0) {
            nativeThrowUnless(codeInsufficientStakedTon, self.stakedTon >= msg.amount);
            self.stakedTon -= msg.amount;
        }

        // release jettons
        let totalCost = 0;
        let i: Int = 0;
        while (i < msg.jettonsIdx) {
            let jetton = msg.jettons.get(i)!!;
            totalCost += jetton.tonAmount;

            // update staked info
            let stakedInfo = self.stakedJettons.get(jetton.jettonWallet);

            nativeThrowUnless(codeStakeJettonNotFound, stakedInfo != null);
            nativeThrowUnless(codeInsufficientStakedJetton,
                stakedInfo!!.jettonAmount >= jetton.jettonAmount);

            self.stakedJettons.set(
                jetton.jettonWallet,
                StakedJettonInfo{
                    jettonAmount: stakedInfo!!.jettonAmount - jetton.jettonAmount,
                }
            );

            i += 1;
        }

        // check cost
        totalCost += msg.forwardTonAmount;
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= totalCost + self.staticTax);

        // told staking master to transfer released jetton
        self.reserveValue(0);
        send(SendParameters{
            to: self.master,
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: msg.toCell(),
        });
    }

    virtual fun getStakedInfo(): StakedInfo {
        return StakedInfo{
            stakedTonAmount: self.stakedTon,
            stakedJettons: self.stakedJettons,
        }
    }

    virtual fun receiveStakeToncoin(msg: StakeToncoin) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.master);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= msg.forwardTonAmount + self.staticTax);

        self.stakedTon += msg.amount;

        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                bounce: false,
                value: msg.forwardTonAmount,
                body: StakeNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    jetton: null,
                    sender: ctx.sender,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            })
        }

        // refund
        self.reserveValue(0);
        send(SendParameters{
            to: msg.responseDestination,
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }
}
