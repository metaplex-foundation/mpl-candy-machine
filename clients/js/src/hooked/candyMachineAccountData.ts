import { Context, Serializer } from '@metaplex-foundation/umi';
import {
  CandyMachineAccountData as BaseCandyMachineAccountData,
  CandyMachineAccountDataArgs as BaseCandyMachineAccountDataArgs,
  getCandyMachineAccountDataSerializer as baseGetCandyMachineAccountDataSerializer,
} from '../generated/types/candyMachineAccountData';

export type CandyMachineAccountData = BaseCandyMachineAccountData;

export type CandyMachineAccountDataArgs = BaseCandyMachineAccountDataArgs;

export function getCandyMachineAccountDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<CandyMachineAccountDataArgs, CandyMachineAccountData> {
  return baseGetCandyMachineAccountDataSerializer(context);
}
