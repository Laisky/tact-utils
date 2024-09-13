import { TonConnectUI } from '@tonconnect/ui';
import { toNano, comment, beginCell } from '@ton/core';
import { storeMintNftSample, storeMintJettonSample} from "./tact_build/Sample/tact_SampleMaster";

const SampleMasterContractAddress = "EQDLlb3XF8RbcXNuucI7iLGF4UOcMTeTPrb692mTD_NWS6Jl";

const tonConnectUI = new TonConnectUI({
    manifestUrl: 'https://s3.laisky.com/uploads/2024/09/connect-manifest-v2.json',
    buttonRootId: 'ton-connect'
});

tonConnectUI.onStatusChange(async (walletInfo) => {
    console.log('walletInfo', walletInfo);

    const getJettonButton = document.getElementById("getJetton") as HTMLButtonElement;
    const getNftButton = document.getElementById("getNft") as HTMLButtonElement;

    if (walletInfo) {
        // enable buttons
        getJettonButton.disabled = false;
        getNftButton.disabled = false;
    } else {
        // disable buttons
        getJettonButton.disabled = true;
        getNftButton.disabled = true;
    }
});

document.getElementById("getJetton")
    ?.addEventListener("click", async (evt) => {
        evt.preventDefault();

        // random int from 1 to 100
        const number = Math.floor(Math.random() * 100) + 1;

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 60, // 60 sec
            messages: [
                {
                    address: SampleMasterContractAddress,
                    amount: toNano("1").toString(),
                    payload: beginCell()
                        .store(storeMintJettonSample({
                            $$type: "MintJettonSample",
                            queryId: BigInt(Math.floor(Date.now() / 1000)),
                            amount: toNano(number)
                        }))
                        .endCell()
                        .toBoc().toString("base64")
                },
            ]
        }

        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('result', result);
    });

document.getElementById("getNft")
    ?.addEventListener("click", async (evt) => {
        evt.preventDefault();

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 60, // 60 sec
            messages: [
                {
                    address: SampleMasterContractAddress,
                    amount: toNano("1").toString(),
                    payload: beginCell()
                        .store(storeMintNftSample({
                            $$type: "MintNftSample",
                            queryId: BigInt(Math.floor(Date.now() / 1000)),
                        }))
                        .endCell()
                        .toBoc().toString("base64")
                },
            ]
        }


        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('result', result);
    });
