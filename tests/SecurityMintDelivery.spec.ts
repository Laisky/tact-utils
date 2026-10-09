import { Dictionary, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import '@ton/test-utils';
import { JettonMasterTemplate, MultiMintReceiver } from '../build/Sample/tact_JettonMasterTemplate';
import { JettonWalletTemplate } from '../build/Sample/tact_JettonWalletTemplate';

test('mint commits supply when a high-tax recipient rejects', async () => {
  const chain = await Blockchain.create();
  const admin = await chain.treasury('issuer');
  const receiver = await chain.treasury('recipient');
  const master = chain.openContract(await JettonMasterTemplate.fromInit(
    admin.address, { $$type: 'Tep64TokenData', flag: 1n, content: 'local-test' }
  ));
  const wallet = chain.openContract(await JettonWalletTemplate.fromInit(
    master.address, receiver.address
  ));
  await master.send(admin.getSender(), { value: toNano('0.1') },
    { $$type: 'Deploy', queryId: 1n });
  await wallet.send(receiver.getSender(), { value: toNano('0.1') },
    { $$type: 'Deploy', queryId: 2n });
  await wallet.send(receiver.getSender(), { value: toNano('0.1') },
    { $$type: 'SetStaticTax', staticTax: toNano('10') });
  const before = await master.getGetJettonData();
  const balanceBefore = (await chain.getContract(wallet.address)).balance;
  const r = await master.send(admin.getSender(), { value: toNano('1') }, {
    $$type: 'MintJetton', queryId: 3n, amount: 100n,
    receiver: receiver.address, responseDestination: admin.address,
    forwardAmount: 0n, forwardPayload: null
  });
  expect(r.transactions).toHaveTransaction({
    from: master.address, to: wallet.address, success: false, exitCode: 50001
  });
  expect((await master.getGetJettonData()).totalSupply).toBe(before.totalSupply + 100n);
  expect((await wallet.getGetWalletData()).balance).toBe(0n);
  expect((await chain.getContract(wallet.address)).balance).toBeGreaterThan(balanceBefore);
});

test('mixed mint preserves a successful sibling while failed amount stays in supply', async () => {
  const chain = await Blockchain.create();
  const admin = await chain.treasury('issuer');
  const good = await chain.treasury('good');
  const bad = await chain.treasury('rejecting');
  const master = chain.openContract(await JettonMasterTemplate.fromInit(
    admin.address, {$$type:'Tep64TokenData',flag:1n,content:'local-test'}));
  const goodWallet = chain.openContract(await JettonWalletTemplate.fromInit(master.address, good.address));
  const badWallet = chain.openContract(await JettonWalletTemplate.fromInit(master.address, bad.address));
  await master.send(admin.getSender(),{value:toNano('0.1')},{$$type:'Deploy',queryId:1n});
  await badWallet.send(bad.getSender(),{value:toNano('0.1')},{$$type:'Deploy',queryId:2n});
  await badWallet.send(bad.getSender(),{value:toNano('0.1')},{$$type:'SetStaticTax',staticTax:toNano('10')});
  const receivers = Dictionary.empty<number, MultiMintReceiver>();
  receivers.set(0, {$$type:'MultiMintReceiver',receiver:good.address,amount:100n,tonAmount:toNano('0.3'),responseDestination:admin.address,forwardAmount:0n,forwardPayload:null});
  receivers.set(1, {$$type:'MultiMintReceiver',receiver:bad.address,amount:200n,tonAmount:toNano('0.3'),responseDestination:admin.address,forwardAmount:0n,forwardPayload:null});
  const result = await master.send(admin.getSender(),{value:toNano('1')},{$$type:'MultiMint',queryId:3n,receivers,receiverCount:2n});
  expect(result.transactions).toHaveTransaction({from:master.address,to:goodWallet.address,success:true});
  expect(result.transactions).toHaveTransaction({from:master.address,to:badWallet.address,success:false,exitCode:50001});
  expect((await goodWallet.getGetWalletData()).balance).toBe(100n);
  expect((await badWallet.getGetWalletData()).balance).toBe(0n);
  expect((await master.getGetJettonData()).totalSupply).toBe(300n);
  const retainedBefore = (await chain.getContract(badWallet.address)).balance;
  await badWallet.send(bad.getSender(),{value:toNano('0.1')},{$$type:'SetStaticTax',staticTax:0n});
  const withdrawn = await badWallet.send(bad.getSender(),{value:toNano('0.05')},'withdraw');
  expect(withdrawn.transactions).toHaveTransaction({from:badWallet.address,to:bad.address,success:true});
  expect((await chain.getContract(badWallet.address)).balance).toBeLessThan(toNano('0.01'));
  expect(retainedBefore).toBeGreaterThan(toNano('0.25'));
  expect((await master.getGetJettonData()).totalSupply).toBe(300n);
  console.log('MIXED_MINT', {supply:'300',credited:'100',uncredited:'200',retainedTON:retainedBefore.toString()});
});

test('normal fresh wallet receives a generously funded single mint', async () => {
  const chain = await Blockchain.create();
  const admin = await chain.treasury('issuer');
  const receiver = await chain.treasury('fresh');
  const master = chain.openContract(await JettonMasterTemplate.fromInit(admin.address,{$$type:'Tep64TokenData',flag:1n,content:'local-test'}));
  const wallet = chain.openContract(await JettonWalletTemplate.fromInit(master.address,receiver.address));
  await master.send(admin.getSender(),{value:toNano('0.1')},{$$type:'Deploy',queryId:1n});
  const result = await master.send(admin.getSender(),{value:toNano('1')},{$$type:'MintJetton',queryId:3n,amount:100n,receiver:receiver.address,responseDestination:admin.address,forwardAmount:0n,forwardPayload:null});
  expect(result.transactions).toHaveTransaction({from:master.address,to:wallet.address,success:true});
  expect((await wallet.getGetWalletData()).balance).toBe(100n);
  expect((await master.getGetJettonData()).totalSupply).toBe(100n);
});

test('underfunded fresh-wallet mint rolls back master supply', async () => {
  const chain = await Blockchain.create();
  const admin = await chain.treasury('issuer');
  const receiver = await chain.treasury('fresh-small');
  const master = chain.openContract(await JettonMasterTemplate.fromInit(admin.address,{$$type:'Tep64TokenData',flag:1n,content:'local-test'}));
  const wallet = chain.openContract(await JettonWalletTemplate.fromInit(master.address,receiver.address));
  await master.send(admin.getSender(),{value:toNano('0.1')},{$$type:'Deploy',queryId:1n});
  const result = await master.send(admin.getSender(),{value:toNano('0.005')},{$$type:'MintJetton',queryId:3n,amount:100n,receiver:receiver.address,responseDestination:admin.address,forwardAmount:0n,forwardPayload:null});
  expect(result.transactions).toHaveTransaction({from:admin.address,to:master.address,success:false});
  expect((await master.getGetJettonData()).totalSupply).toBe(0n);
  expect((await chain.getContract(wallet.address)).balance).toBe(0n);
  expect(result.transactions).not.toHaveTransaction({to:wallet.address});
  console.log('UNDERFUNDED_CONTROL', {supply:'0',credited:'0',funding:'0.005'});
});
