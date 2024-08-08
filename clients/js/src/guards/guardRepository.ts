import { Program } from '@metaplex-foundation/umi';
import {
  UnregisteredGumballGuardError,
  VariableSizeGuardError,
} from '../errors';
import { GuardManifest } from './guardManifest';

export type AnyGuardManifest = GuardManifest<any, any, any, any>;

export type CandyGuardProgram = Program & {
  availableGuards: string[];
};

export interface GuardRepository {
  /** Registers one or many guards by providing their manifest. */
  add(...manifests: AnyGuardManifest[]): void;

  /** Gets the manifest of a guard using its name. */
  get<T extends AnyGuardManifest = AnyGuardManifest>(name: string): T;

  /** Gets all registered guard manifests. */
  all(): AnyGuardManifest[];

  /**
   * Gets all guard manifests for a registered Gumball Guard program.
   *
   * It fails if the manifest of any guard expected by the program
   * is not registered. Manifests are returned in the order in which
   * they are defined on the `availableGuards` property of the program.
   */
  forProgram(program: CandyGuardProgram): AnyGuardManifest[];
}

export class DefaultGuardRepository implements GuardRepository {
  protected readonly manifests = new Map<string, AnyGuardManifest>();

  add(...manifests: AnyGuardManifest[]): void {
    manifests.forEach((manifest) => {
      if (manifest.serializer().fixedSize === null) {
        throw new VariableSizeGuardError(manifest.name);
      }
      this.manifests.set(manifest.name, manifest);
    });
  }

  get<T extends AnyGuardManifest = AnyGuardManifest>(name: string): T {
    const manifest = this.manifests.get(name);
    if (!manifest) {
      throw new UnregisteredGumballGuardError(name);
    }
    return manifest as T;
  }

  all(): AnyGuardManifest[] {
    return Array.from(this.manifests.values());
  }

  forProgram(program: CandyGuardProgram): AnyGuardManifest[] {
    return program.availableGuards.map((name) => this.get(name));
  }
}
