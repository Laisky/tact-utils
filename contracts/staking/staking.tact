// =====================================
// https://blog.laisky.com/p/ton-tact/
// =====================================

import "@stdlib/ownable";

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
    staticTaxFee: Int as coins = ton("0.001");
    lockedValue: Int as coins = 0;

    master: Address;
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
        return self.getUserWallet(owner);
    }

    // getWalletContract creates a new wallet contract for the specified owner
    virtual fun getUserWallet(owner: Address): Address {
        let init = initOf StakingWalletTemplate(
            myAddress(),
            owner,
        );

        return contractAddress(init);
    }
}

trait StakingWallet with Common {
    owner: Address;
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
                body: stakeMsg.forwardPayload,
            })
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
        })
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
                body: msg.forwardPayload,
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
        })
    }
}
