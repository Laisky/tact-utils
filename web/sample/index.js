import { TonConnectUI } from '@tonconnect/ui';
import { toNano, comment } from '@ton/core';


const tonConnectUI = new TonConnectUI({
    manifestUrl: 'https://s3.laisky.com/uploads/2024/09/connect-manifest-v2.json',
    buttonRootId: 'ton-connect'
});

tonConnectUI.onStatusChange(async (walletInfo) => {
    console.log('walletInfo', walletInfo);

    if (walletInfo) {
        // enable buttons
        document.getElementById("getJetton").disabled = false;
        document.getElementById("getNft").disabled = false;
    }else {
        // disable buttons
        document.getElementById("getJetton").disabled = true;
        document.getElementById("getNft").disabled = true;
    }
});

document.getElementById("getJetton")
    .addEventListener("click", async (evt) => {
        evt.preventDefault();

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 60, // 60 sec
            messages: [
                {
                    address: "kQCGbkfO57weT9WAXImPvM7ZJY82eyfdGbCrtWY-wSuD5KxO",
                    amount: toNano("1").toString(),
                    payload: comment("airdrop").toBoc().toString("base64")
                },
            ]
        }

        const result = await tonConnectUI.sendTransaction(transaction);

        // you can use signed boc to find the transaction
        // const someTxData = await myAppExplorerService.getTransaction(result.boc);
    });

document.getElementById("getNft")
    .addEventListener("click", async (evt) => {
        evt.preventDefault();

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 60, // 60 sec
            messages: [
                {
                    address: "EQB1AEou_RPjMGOWH8qz1pXnFES7EG2b2EV_Xj4DbiiMxbmq",
                    amount: toNano("1").toString(),
                    payload: comment("airdrop").toBoc().toString("base64")
                },
            ]
        }

        const result = await tonConnectUI.sendTransaction(transaction);

        // you can use signed boc to find the transaction
        // const someTxData = await myAppExplorerService.getTransaction(result.boc);
        // alert('Transaction was sent successfully', someTxData);
    });
