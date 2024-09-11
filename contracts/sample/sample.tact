import "../jetton/jetton.tact";
import "../jetton/messages.tact";
import "../common/traits.tact";
import "./messages.tact";


contract Sample with Common {
    owner: Address;
    staticTaxFee: Int = ton("0.01");
    lockedValue: Int as coins = 0;
    nonce: Int = 0;

    init() {
        self.owner = sender();
    }

    receive(msg: MintJettonSample) {
        self.checkAndUpdateNonce(msg.queryId);
        nativeThrowUnless(codeUnauthorized, sender() == self.owner);

        let JettonMasterContract = initOf JettonMaster(
            myAddress(),
            "https://s3.laisky.com/uploads/2024/09/jetton-sample.json",
        );

        self.reserveValue(0);
        send(SendParameters{
            to: contractAddress(JettonMasterContract),
            value: 0,
            mode: SendRemainingBalance,
            bounce: false,
            body: MintJetton{
                queryId: msg.queryId,
                amount: ton("1"),
                receiver: sender(),
                forwardTonAmount: 0,
                responseDestination: sender(),
            }.toCell(),
            code: JettonMasterContract.code,
            data: JettonMasterContract.data,
        });
    }
}
