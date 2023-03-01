import {
  ExtendLutInstructionAccounts,
  ExtendLutInstructionData,
  ExtendLutInstructionDataArgs,
  extendLut as baseExtendLut,
} from '../generated/instructions/extendLut';

export {
  ExtendLutInstructionAccounts,
  ExtendLutInstructionData,
  ExtendLutInstructionDataArgs,
};

export function extendLut(
  context: Parameters<typeof baseExtendLut>[0],
  input: Parameters<typeof baseExtendLut>[1]
): ReturnType<typeof baseExtendLut> {
  return {
    ...baseExtendLut(context, input),
    bytesCreatedOnChain: 32 * input.addresses.length,
  };
}
