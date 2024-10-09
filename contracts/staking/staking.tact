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
    staticTaxFee: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    init(owner: Address) {
        self.owner = owner;
    }
}

contract StakingWalletTemplate with StakingWallet {
    owner: Address;
    master: Address;
    staticTaxFee: Int as coins = ton("0.001");
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
    staticTaxFee: Int;
    lockedValue: Int;

    get fun userWallet(owner: Address): Address {
        return contractAddress(self.getUserWallet(owner));
    }

    receive(msg: StakeRelease) {
        self.receiveRelease(msg);
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
            body: StakeReleaseInternal{
                queryId: msg.queryId,
                amount: msg.amount,
                jettons: msg.jettons,
                jettonsIdx: msg.jettonsIdx,
                destination: msg.destination,
                responseDestination: msg.responseDestination,
                customPayload: msg.customPayload,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload,
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
    staticTaxFee: Int;
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

    receive(msg: TransferNotification) {
        self.receiveTransferNotification(msg);
    }

    receive(msg: StakeReleaseInternal) {
        self.receiveRelease(msg);
    }

    virtual fun receiveRelease(msg: StakeReleaseInternal) {
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
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= totalCost + self.staticTaxFee);

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

    // user transfer jetton to users' staking wallet address,
    // and send TransferNotification to the staking wallet.
    virtual fun receiveTransferNotification(msg: TransferNotification) {
        let ctx = context();
        nativeThrowUnless(codeForwardPayloadInvalid, msg.forwardPayload != null);

        let stakeMsg = StakeJetton.fromCell(msg.forwardPayload!!);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= stakeMsg.tonAmount + stakeMsg.forwardTonAmount + self.staticTaxFee);

        // update staked info
        self.lockedValue += stakeMsg.tonAmount;
        self.stakedJettons.set(
            stakeMsg.jettonWallet,
            StakedJettonInfo{
                jettonAmount: msg.amount,
            }
        );

        if (stakeMsg.forwardTonAmount > 0) {
            send(SendParameters{
                to: stakeMsg.responseDestination,
                bounce: false,
                value: stakeMsg.forwardTonAmount,
                body: StakeNotification{
                    queryId: msg.queryId,
                    amount: stakeMsg.tonAmount,
                    jetton: stakeMsg,
                    sender: msg.sender,
                    forwardPayload: stakeMsg.forwardPayload,
                }.toCell(),
            });
        }

        // refund
        self.reserveValue(stakeMsg.tonAmount);
        send(SendParameters{
            to: stakeMsg.responseDestination,
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: Excesses{
                queryId: msg.queryId,
            }.toCell(),
        });
    }

    virtual fun receiveStakeToncoin(msg: StakeToncoin) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.amount + msg.forwardTonAmount + self.staticTaxFee);

        self.lockedValue += msg.amount;

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
