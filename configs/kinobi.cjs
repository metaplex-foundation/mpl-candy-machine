const path = require("path");
const {
  Kinobi,
  RenderJavaScriptVisitor,
  SetNumberWrappersVisitor,
  UpdateAccountsVisitor,
  UpdateInstructionsVisitor,
  UpdateProgramsVisitor,
  SetStructDefaultValuesVisitor,
  TypeNumberNode,
  TypePublicKeyNode,
  TypeBytesNode,
  SetInstructionAccountDefaultValuesVisitor,
} = require("@metaplex-foundation/kinobi");
const {
  TransformDefinedTypesIntoAccountsVisitor,
} = require("./visitors/TransformDefinedTypesIntoAccountsVisitor.cjs");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = new Kinobi([
  path.join(idlDir, "candy_machine_core.json"),
  path.join(idlDir, "candy_guard.json"),
]);

// Update programs.
kinobi.update(
  new UpdateProgramsVisitor({
    candyGuard: { name: "mplCandyGuard", prefix: "Cg" },
    candyMachineCore: { name: "mplCandyMachineCore", prefix: "Cm" },
  })
);

// Transform some defined types into accounts.
kinobi.update(
  new TransformDefinedTypesIntoAccountsVisitor([
    "mintCounter",
    "allowListProof",
  ])
);

// Reusable seeds.
const candyGuardSeed = {
  kind: "variable",
  name: "candyGuard",
  description: "The address of the Candy Guard account",
  type: new TypePublicKeyNode(),
};
const candyMachineSeed = {
  kind: "variable",
  name: "candyMachine",
  description: "The address of the Candy Machine account",
  type: new TypePublicKeyNode(),
};
const userSeed = {
  kind: "variable",
  name: "user",
  description: "The address of the wallet trying to mint",
  type: new TypePublicKeyNode(),
};

// Update accounts.
kinobi.update(
  new UpdateAccountsVisitor({
    candyGuard: {
      seeds: [
        { kind: "literal", value: "candy_guard" },
        {
          kind: "variable",
          name: "base",
          description:
            "The base address which the Candy Guard PDA derives from",
          type: new TypePublicKeyNode(),
        },
      ],
    },
    mintCounter: {
      size: 2,
      discriminator: { kind: "size" },
      seeds: [
        { kind: "literal", value: "mint_limit" },
        {
          kind: "variable",
          name: "id",
          description:
            "A unique identifier in the context of a Candy Machine/Candy Guard combo",
          type: new TypeNumberNode("u8"),
        },
        userSeed,
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
    allowListProof: {
      size: 4,
      discriminator: { kind: "size" },
      seeds: [
        { kind: "literal", value: "allow_list" },
        {
          kind: "variable",
          name: "merkleRoot",
          description: "The Merkle Root used when verifying the user",
          type: new TypeBytesNode({ size: { kind: "fixed", bytes: 32 } }),
        },
        userSeed,
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
    freezeEscrow: {
      seeds: [
        { kind: "literal", value: "freeze_escrow" },
        {
          kind: "variable",
          name: "destination",
          description: "The wallet that will eventually receive the funds",
          type: new TypePublicKeyNode(),
        },
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
  })
);

// Reusable PDA defaults.
const defaultsToCandyMachineAuthorityPda = (candyMachine = "candyMachine") => ({
  kind: "pda",
  pdaAccount: "candyMachineAuthority",
  dependency: "hooked",
  seeds: { candyMachine: { kind: "account", name: candyMachine } },
});
const defaultsToMetadataPda = (mint = "mint") => ({
  kind: "pda",
  pdaAccount: "metadata",
  dependency: "mplTokenMetadata",
  seeds: { mint: { kind: "account", name: mint } },
});
const defaultsToMasterEditionPda = (mint = "mint") => ({
  kind: "pda",
  pdaAccount: "masterEdition",
  dependency: "mplTokenMetadata",
  seeds: { mint: { kind: "account", name: mint } },
});
const defaultsToCollectionAuthorityRecordPda = (
  mint = "mint",
  collectionAuthority = "collectionAuthority"
) => ({
  kind: "pda",
  pdaAccount: "collectionAuthorityRecord",
  dependency: "mplTokenMetadata",
  seeds: {
    mint: { kind: "account", name: mint },
    collectionAuthority: { kind: "account", name: collectionAuthority },
  },
});

// Automatically recognize account default values.
kinobi.update(
  new SetInstructionAccountDefaultValuesVisitor([
    {
      kind: "program",
      account: /^tokenMetadataProgram|mplTokenMetadataProgram$/,
      program: {
        name: "mplTokenMetadata",
        publicKey: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
      },
      ignoreIfOptional: true,
    },
    {
      kind: "publicKey",
      account: /^instructionSysvarAccount$/,
      publicKey: "Sysvar1nstructions1111111111111111111111111",
      ignoreIfOptional: true,
    },
    {
      kind: "publicKey",
      account: /^recentSlothashes$/,
      publicKey: "SysvarS1otHashes111111111111111111111111111",
      ignoreIfOptional: true,
    },
  ])
);

// Update instructions.
kinobi.update(
  new UpdateInstructionsVisitor({
    "mplCandyMachineCore.initialize": {
      name: "initializeCandyMachine",
      accounts: {
        authorityPda: {
          defaultsTo: defaultsToCandyMachineAuthorityPda(),
        },
        collectionMetadata: {
          defaultsTo: defaultsToMetadataPda("collectionMint"),
        },
        collectionMasterEdition: {
          defaultsTo: defaultsToMasterEditionPda("collectionMint"),
        },
        collectionAuthorityRecord: {
          defaultsTo: defaultsToCollectionAuthorityRecordPda(
            "collectionMint",
            "authorityPda"
          ),
        },
      },
    },
    "mplCandyGuard.initialize": { name: "initializeCandyGuard" },
    "mplCandyMachineCore.mint": { name: "mintFromCandyMachine" },
    "mplCandyGuard.mint": { name: "mint" },
    "mplCandyMachineCore.SetAuthority": { name: "SetCandyMachineAuthority" },
    "mplCandyGuard.SetAuthority": { name: "SetCandyGuardAuthority" },
    "mplCandyMachineCore.update": { name: "updateCandyMachine" },
    "mplCandyGuard.update": { name: "updateCandyGuard" },
    "mplCandyMachineCore.withdraw": { name: "withdrawCandyMachine" },
    "mplCandyGuard.withdraw": { name: "withdrawCandyGuard" },
  })
);

kinobi.update(
  new SetStructDefaultValuesVisitor({
    //
  })
);

// Wrap numbers.
kinobi.update(
  new SetNumberWrappersVisitor({
    // "splSystem.CreateAccount.lamports": { kind: "SolAmount" },
    // "splSystem.TransferSol.amount": { kind: "SolAmount" },
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
kinobi.accept(
  new RenderJavaScriptVisitor(jsDir, {
    prettier: require(path.join(clientDir, "js", ".prettierrc.json")),
    dependencyMap: {
      mplTokenMetadata: "@metaplex-foundation/mpl-token-metadata",
    },
  })
);
