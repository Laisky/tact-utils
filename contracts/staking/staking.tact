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

    receive(msg: StakingToncoin) {
        self.receiveStakingToncoin(msg);
    }

    receive(msg: TransferNotification) {
        self.receiveTransferNotification(msg);
    }

    // getWalletContract creates a new wallet contract for the specified owner
    virtual fun getWalletContract(owner: Address): StateInit {
        return initOf StakingWalletTemplate(
            myAddress(),
            owner,
        )
    }

    virtual fun receiveStakingToncoin(msg: StakingToncoin) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.amount + msg.forwardTonAmount + self.staticTaxFee);

        // create a new wallet contract
        // and send the staked amount to it
        let wallet = self.getWalletContract(msg.owner);

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(wallet),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: WalletStakingDeposit{
                queryId: msg.queryId,
                amount: msg.amount,
                responseDestination: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload,
            }.toCell(),
        })
    }

    virtual fun receiveTransferNotification(msg: TransferNotification) {
        let ctx = context();
        nativeThrowUnless(codeForwardPayloadInvalid, msg.forwardPayload != null);

        let jettonTransferFee = ton("0.1");
        let stakeMsg = StakingToncoin.fromCell(msg.forwardPayload!!);
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= stakeMsg.amount + stakeMsg.forwardTonAmount + self.staticTaxFee + jettonTransferFee);

        let wallet = self.getWalletContract(msg.sender);

        // transfer jetton to the staking wallet
        send(SendParameters{
            to: sender(),
            bounce: false,
            value: jettonTransferFee,
            body: TokenTransfer{
                queryId: msg.queryId,
                amount: msg.amount,
                destination: contractAddress(wallet),
                responseDestination: stakeMsg.responseDestination,
                forwardTonAmount: 0,
            }.toCell(),
        });

        // transfer ton coin to the staking wallet
        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(wallet),
            bounce: false,
            value: 0,
            mode: SendRemainingBalance,
            body: WalletStakingDeposit{
                queryId: msg.queryId,
                amount: stakeMsg.amount,
                responseDestination: stakeMsg.responseDestination,
                forwardTonAmount: stakeMsg.forwardTonAmount,
                forwardPayload: stakeMsg.forwardPayload,
            }.toCell(),
        })
    }
}

trait StakingWallet with Common {
    owner: Address;
    staticTaxFee: Int;
    lockedValue: Int;

    receive(msg: WalletStakingDeposit) {
        self.receiveWalletStakingDeposit(msg);
    }

    get fun stakedTonAmount(): Int {
        return self.getStakedTonAmount();
    }

    virtual fun getStakedTonAmount(): Int {
        return self.lockedValue;
    }

    virtual fun receiveWalletStakingDeposit(msg: WalletStakingDeposit) {
        let ctx = context();
        nativeThrowUnless(codeInflowValueNotSufficient, ctx.value >= msg.amount + msg.forwardTonAmount + self.staticTaxFee);

        self.lockedValue += msg.amount;

        // send forward if needed
        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: msg.responseDestination,
                value: msg.forwardTonAmount,
                bounce: false,
                body: msg.forwardPayload,
            })
        }

        // send response
        self.reserveValue(0);
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
