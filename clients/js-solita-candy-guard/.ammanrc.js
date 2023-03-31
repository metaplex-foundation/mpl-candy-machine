// @ts-check
'use strict';
const path = require('path');

const localDeployDir = path.join(path.dirname(__dirname), 'target', 'deploy');
const {LOCALHOST, tmpLedgerDir} = require('@metaplex-foundation/amman');

function localDeployPath(programName) {
    return path.join(localDeployDir, `${programName}.so`);
}

const programs = {
  candy_guard: {
    label: "Candy Guard",
    programId: 'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g',
    deployPath: localDeployPath('mpl_candy_guard'),
  }
};

const validator = {
    killRunningValidators: true,
    programs: [programs.candy_guard],
    commitment: 'singleGossip',
    resetLedger: true,
    verifyFees: false,
    jsonRpcUrl: LOCALHOST,
    websocketUrl: '',
    ledgerDir: tmpLedgerDir(),
    accountsCluster: 'https://api.devnet.solana.com',
    accounts: [
        {
          label: 'Token Metadata Program',
          accountId:'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
          executable: true,
        },
        {
          label: 'Candy Machine Core',
          accountId:'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR',
          executable: true,
        },
      ]
};

module.exports = {validator};
