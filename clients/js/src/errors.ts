import { UmiError } from '@metaplex-foundation/umi';
import { GUMBALL_GUARD_LABEL_SIZE } from './constants';

export class GumballMachineError extends UmiError {
  readonly name: string = 'GumballMachineError';

  constructor(message: string, cause?: Error) {
    super(message, 'plugin', 'Gumball Machine', cause);
  }
}

export class VariableSizeGuardError extends GumballMachineError {
  readonly name: string = 'VariableSizeGuardError';

  constructor(name: string) {
    const message =
      `Trying add a guard [${name}] with a variable-size serializer. ` +
      `The Gumball Guard program only works with fixed-size guards. ` +
      'Please use the `fixSerializer` helper method to make it a fixed-size guard.';
    super(message);
  }
}

export class UnregisteredGumballGuardError extends GumballMachineError {
  readonly name: string = 'UnregisteredGumballGuardError';

  constructor(name: string) {
    const message =
      `Trying to access a custom guard named [${name}] that ` +
      `guard was not registered on the guard repository. ` +
      'Register your custom guard by calling the `umi.guards.add()` method.';
    super(message);
  }
}

export class GuardGroupRequiredError extends GumballMachineError {
  readonly name: string = 'GuardGroupRequiredError';

  constructor(availableGroups: string[]) {
    const message =
      'The provided Gumball Machine defines groups of guards but no' +
      'group label was provided to identity which group we should select. ' +
      'Please provide the label of the group you wish to select from via the `group` parameter. ' +
      `The available groups are [${availableGroups.join(', ')}]`;
    super(message);
  }
}

export class SelectedGuardGroupDoesNotExistError extends GumballMachineError {
  readonly name: string = 'SelectedGuardGroupDoesNotExistError';

  constructor(selectedGroup: string, availableGroups: string[]) {
    const message =
      `You're trying to select the guard group [${selectedGroup}] from a ` +
      `Gumball Machine but this group does not exists on this Gumball Machine. ${
        availableGroups.length > 0
          ? 'Please provide the label of a group that exists on the Gumball Machine. ' +
            `The available groups are [${availableGroups.join(', ')}]`
          : 'There are no guard groups defined on the Gumball Machine. ' +
            'Please set the `group` parameter to `null` or remove it altogether.'
      }`;
    super(message);
  }
}

export class GuardMintSettingsMissingError extends GumballMachineError {
  readonly name: string = 'GuardMintSettingsMissingError';

  constructor(guardName: string) {
    const message =
      `The Gumball Machine you are trying to mint from has the [${guardName}] guard enabled. ` +
      'This guard requires you to provide some additional settings when minting which you did not provide. ' +
      `Please provide some minting settings for the [${guardName}] guard ` +
      `via the \`guards\` parameter like so: \`guards.${guardName} = {...}\`.`;
    super(message);
  }
}

export class GuardRouteNotSupportedError extends GumballMachineError {
  readonly name: string = 'GuardRouteNotSupportedError';

  constructor(guardName: string) {
    const message =
      `You are trying to call the route instruction of the [${guardName}] guard ` +
      'but this guard does not support this feature or did not register it on the SDK. ' +
      'Please select a guard that support the route instruction feature. ' +
      'If you are using a custom guard, make sure you registered the route instruction ' +
      'feature by implementing the `routeSettingsParser` method on the guard manifest.';
    super(message);
  }
}

export class GumballGuardRequiredOnGumballMachineError extends GumballMachineError {
  readonly name: string = 'GumballGuardRequiredOnGumballMachineError';

  constructor() {
    const message =
      `The provided Gumball Machine does not have a Gumball Guard associated with ` +
      `it yet, it is required for the operation you are trying to execute. ` +
      'Please provide a Gumball Machine with an associated Gumball Guard account.';
    super(message);
  }
}

export class GuardNotEnabledError extends GumballMachineError {
  readonly name: string = 'GuardNotEnabledError';

  constructor(guard: string, group: string | null) {
    const message =
      `${
        group
          ? `The guard [${guard}] is not enabled on the group [${group}] of the Gumball Machine.`
          : `The guard [${guard}] is not enabled on the Gumball Machine. `
      }Please provide a different guard or select a different group ` +
      `such that the provided guard is enabled on the selected group.`;
    super(message);
  }
}

export class GuardGroupLabelTooLongError extends GumballMachineError {
  readonly name: string = 'GuardGroupLabelTooLongError';

  constructor(label: string) {
    const message =
      `The provided group label [${label}] is too long. ` +
      `Group labels cannot be longer than ${GUMBALL_GUARD_LABEL_SIZE} characters. ` +
      'Please provide a shorter group label.';
    super(message);
  }
}

export class UnrecognizePathForRouteInstructionError extends GumballMachineError {
  readonly name: string = 'UnrecognizePathForRouteInstructionError';

  constructor(guard: string, path: never) {
    const message =
      `The provided path [${path}] does not exist on the route instruction of the [${guard}] guard. ` +
      'Please provide a recognized path.';
    super(message);
  }
}

export class MintOwnerMustBeMintPayerError extends GumballMachineError {
  readonly name: string = 'MintOwnerMustBeMintPayerError';

  constructor(guard: string) {
    const message =
      `The payer must be the owner when using the [${guard}] guard. ` +
      'Please remove the `owner` attribute from the mint input so they can be the same.';
    super(message);
  }
}

export class MaximumOfFiveAdditionalProgramsError extends GumballMachineError {
  readonly name: string = 'MaximumOfFiveAdditionalProgramsError';

  constructor() {
    const message =
      `There is a maximum of five additional programs when using the [programGate] guard. ` +
      'Please reduce the number of additional programs to <= 5.';
    super(message);
  }
}
