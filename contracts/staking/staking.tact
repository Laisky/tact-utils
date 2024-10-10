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
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.owner);

        let wallet = self.getUserWallet(msg.owner);

        send(SendParameters{
            to: contractAddress(wallet),
            bounce: false,
            value: 0,
            mode: SendRemainingValue,
            body: msg.toCell(),
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

        // update staked info
        self.lockedValue += msg.tonAmount;
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
        self.reserveValue(msg.tonAmount);
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
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.master);

        // release ton coins
        if (msg.amount > 0) {
            nativeThrowUnless(codeBalanceNotSufficient, self.lockedValue >= msg.amount);
            self.lockedValue -= msg.amount;
            send(SendParameters{
                to: msg.destination,
                bounce: false,
                value: msg.amount,
                body: msg.customPayload,
            });
        }

        // release jettons
        let totalCost = 0;
        let i: Int = 0;
        while (i < msg.jettonsIdx) {
            let jetton = msg.jettons.get(i)!!;
            totalCost += jetton.tonAmount;

            // update staked info
            let stakedInfo = self.stakedJettons.get(jetton.jettonWallet);
            nativeThrowUnless(codeInsufficientStakedJetton,
                stakedInfo != null && stakedInfo!!.jettonAmount >= jetton.jettonAmount);
            self.stakedJettons.set(
                jetton.jettonWallet,
                StakedJettonInfo{
                    jettonAmount: stakedInfo!!.jettonAmount - jetton.jettonAmount,
                }
            );

            send(SendParameters{
                to: jetton.jettonWallet,
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

        if (msg.forwardTonAmount > 0) {
            totalCost += msg.forwardTonAmount;
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

        // check cost
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= totalCost + self.staticTax);

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

    virtual fun getStakedInfo(): StakedInfo {
        return StakedInfo{
            stakedTonAmount: self.lockedValue,
            stakedJettons: self.stakedJettons,
        }
    }

    virtual fun receiveStakeToncoin(msg: StakeToncoin) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.master);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= msg.forwardTonAmount + self.staticTax);

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
        self.reserveValue(msg.amount);
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
