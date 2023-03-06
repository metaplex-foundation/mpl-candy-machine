import {
  generateSigner,
  none,
  percentAmount,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, updateCandyMachine } from '../src';
import { createCandyMachine, createUmi } from './_setup';

test('it can update the data of a candy machine', async (t) => {
  // Given a Candy Machine with the following data.
  const umi = await createUmi();
  const creatorA = generateSigner(umi).publicKey;
  const candyMachine = await createCandyMachine(umi, {
    itemsAvailable: 1000,
    symbol: 'OLD',
    sellerFeeBasisPoints: percentAmount(1),
    maxEditionSupply: 1n,
    isMutable: true,
    creators: [{ address: creatorA, percentageShare: 100, verified: false }],
    configLineSettings: some({
      prefixName: 'My Old NFT #',
      nameLength: 4,
      prefixUri: 'https://arweave.net/',
      uriLength: 50,
      isSequential: true,
    }),
  });

  // When we update its data.
  const creatorB = generateSigner(umi).publicKey;
  await transactionBuilder(umi)
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: {
          itemsAvailable: 1000, // Cannot be updated.
          symbol: 'NEW',
          sellerFeeBasisPoints: percentAmount(2),
          maxEditionSupply: 2,
          isMutable: false,
          creators: [
            { address: creatorB, percentageShare: 100, verified: false },
          ],
          configLineSettings: some({
            prefixName: 'My New NFT #$ID+1$',
            nameLength: 0,
            prefixUri: 'https://my.app.com/nfts/$ID+1$',
            uriLength: 0,
            isSequential: false,
          }),
          hiddenSettings: none(),
        },
      })
    )
    .sendAndConfirm();

  // Then the Candy Machine's data was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    data: {
      itemsAvailable: 1000n,
      symbol: 'NEW',
      sellerFeeBasisPoints: percentAmount(2),
      maxEditionSupply: 2n,
      isMutable: false,
      creators: [{ address: creatorB, percentageShare: 100, verified: false }],
      configLineSettings: some({
        prefixName: 'My New NFT #$ID+1$',
        nameLength: 0,
        prefixUri: 'https://my.app.com/nfts/$ID+1$',
        uriLength: 0,
        isSequential: false,
      }),
      hiddenSettings: none(),
    },
  });
});
