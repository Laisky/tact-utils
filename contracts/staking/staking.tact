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

    receive(msg: StakeToncoin) {
        self.receiveStakeToncoin(msg);
    }

    receive(msg: TransferNotification) {
        self.receiveTransferNotification(msg);
    }

    // user transfer jetton to staking master address,
    // and also set responseDestination to the staking master address.
    virtual fun receiveTransferNotification(msg: TransferNotification) {
        let ctx = context();
        nativeThrowUnless(codeForwardPayloadInvalid, msg.forwardPayload != null);
        nativeThrowUnless(codeStakeAmountMustBePositive, msg.amount >= 0);

        let stakeMsg = StakeJetton.fromCell(msg.forwardPayload!!);
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= stakeMsg.tonAmount + stakeMsg.forwardAmount + self.staticTax);
        nativeThrowUnless(codeStakeAmountMustBePositive, stakeMsg.tonAmount >= 0);

        // update stake info
        self.lockedValue += stakeMsg.tonAmount;

        if (stakeMsg.forwardAmount > 0) {
            send(SendParameters{
                to: stakeMsg.responseDestination,
                bounce: false,
                value: stakeMsg.forwardAmount,
                body: StakeNotification{
                    queryId: msg.queryId,
                    amount: stakeMsg.tonAmount,
                    jettonAmount: msg.amount,
                    jetton: stakeMsg,
                    jettonWallet: sender(),
                    sender: msg.sender,
                    forwardPayload: stakeMsg.forwardPayload,
                }.toCell(),
            });
        }

        let userWallet = self.getUserWallet(msg.sender);

        // notify stake wallet to update staked info
        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(userWallet),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: StakeInternal{
                queryId: msg.queryId,
                jettonWallet: sender(),
                jettonAmount: msg.amount,
                amount: stakeMsg.tonAmount,
                responseDestination: stakeMsg.responseDestination,
            }.toCell(),
            data: userWallet.data,
            code: userWallet.code,
        });
    }

    virtual fun receiveStakeToncoin(msg: StakeToncoin) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient,
            ctx.value >= msg.amount + msg.forwardAmount + self.staticTax);
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
            self.lockedValue -= msg.amount;
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
                to: jetton.jettonWallet,
                bounce: false,
                value: jetton.tonAmount,
                body: TokenTransfer{
                    queryId: msg.queryId,
                    amount: jetton.jettonAmount,
                    destination: jetton.destination,
                    responseDestination: msg.responseDestination,
                    customPayload: jetton.customPayload,
                    forwardAmount: jetton.forwardAmount,
                    forwardPayload: jetton.forwardPayload,
                }.toCell(),
            });

            i += 1;
        }

        // check cost
        totalCost += msg.forwardAmount;
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= totalCost + self.staticTax);

        // forward
        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                bounce: false,
                value: msg.forwardAmount,
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

    receive(msg: StakeInternal) {
        self.receiveStakeInternal(msg);
    }

    virtual fun receiveStakeInternal(msg: StakeInternal) {
        let ctx = context();
        nativeThrowUnless(codeUnauthorized, ctx.sender == self.master);

        // update staked info
        self.stakedTon += msg.amount;
        let stakeInfo = self.stakedJettons.get(msg.jettonWallet);
        if (stakeInfo == null) {
            self.stakedJettons.set(
                msg.jettonWallet,
                StakedJettonInfo{
                    jettonAmount: msg.jettonAmount,
                }
            );
        } else {
            self.stakedJettons.set(
                msg.jettonWallet,
                StakedJettonInfo{
                    jettonAmount: stakeInfo!!.jettonAmount + msg.jettonAmount,
                }
            );
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
        totalCost += msg.forwardAmount;
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
            ctx.value >= msg.forwardAmount + self.staticTax);

        self.stakedTon += msg.amount;

        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                bounce: false,
                value: msg.forwardAmount,
                body: StakeNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    jetton: null,
                    jettonAmount: 0,
                    jettonWallet: null,
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
