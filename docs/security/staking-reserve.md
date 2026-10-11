# Direct native stake reservation

The stake receiver increments lockedValue before reserving funds. reserveValue already accounts for the current lockedValue, so passing the stake as an additional delta counted it twice. The receiver now uses a zero additional delta, consistent with the Jetton stake path. The helper comment describes that existing convention.

On unchanged source, a 0.5 TON stake with 0.65 TON funding reached action error 37 and never credited its stake wallet. Generous 2 TON funding retained 1.001 TON instead of 0.501 TON; actual prior master prefunding also retained an extra 0.5 TON.

Retained local TON sandbox cases assert successful wallet credit, exact total balance conservation after transaction/forwarding fees, excess returned to the staker, protection of prior master balances, owner withdrawal preserving the locked stake, and underfunded transaction rollback. The complete local suite passes 43 tests in eight suites, including existing Jetton notification and stake release controls.

Compile Sample and HelloWorld, then run `yarn test --runInBand`. No wallet/RPC command or on-chain transaction is involved.

Refs #9. Compiled contract code changes require any future release to use the new code; no deployment is part of this PR.
