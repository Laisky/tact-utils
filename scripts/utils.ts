import { Address, beginCell } from '@ton/core';


export const randomInt = (): number => {
    return Math.floor(Math.random() * 10000);
}

export const emptyAddress = () => Address.parseRaw('0:0000000000000000000000000000000000000000000000000000000000000000');

export const emptySlice = () => beginCell().endCell().asSlice();
