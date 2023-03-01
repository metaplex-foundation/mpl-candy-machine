import test from 'ava';
import { createUmi } from './_setup';

test('example test', async (t) => {
  // Given a Umi context.
  const umi = await createUmi();

  // When
  console.log({ umi });

  // Then
  t.pass();
});
