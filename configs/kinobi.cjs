const path = require("path");
const {
  Kinobi,
  RenderJavaScriptVisitor,
  SetNumberWrappersVisitor,
  UpdateAccountsVisitor,
  UpdateInstructionsVisitor,
  UpdateProgramsVisitor,
  SetAccountDiscriminatorFromFieldVisitor,
  vScalar,
  TypePublicKeyNode,
  TypeNumberNode,
  SetStructDefaultValuesVisitor,
} = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = new Kinobi([
  path.join(idlDir, "spl_system.json"),
  path.join(idlDir, "spl_memo.json"),
  path.join(idlDir, "spl_token.json"),
  path.join(idlDir, "spl_associated_token.json"),
  path.join(idlDir, "spl_address_lookup_table.json"),
  path.join(idlDir, "mpl_system_extras.json"),
  path.join(idlDir, "mpl_token_extras.json"),
]);

// Update programs.
kinobi.update(
  new UpdateProgramsVisitor({
    splSystem: { prefix: "Sys" },
    splMemo: { prefix: "Memo" },
    splToken: { prefix: "Tok" },
    splAssociatedToken: { prefix: "Ata" },
    splAddressLookupTable: { prefix: "Lut" },
    mplSystemExtras: { prefix: "SysEx" },
    mplTokenExtras: { prefix: "TokEx" },
  })
);

// Update accounts.
kinobi.update(
  new UpdateAccountsVisitor({
    "splToken.mint": { discriminator: { kind: "size" } },
    "splToken.token": { discriminator: { kind: "size" } },
    "splToken.multisig": { discriminator: { kind: "size" } },
    "splAddressLookupTable.addressLookupTable": {
      seeds: [
        {
          kind: "variable",
          name: "authority",
          description: "The address of the LUT's authority",
          type: new TypePublicKeyNode(),
        },
        {
          kind: "variable",
          name: "recentSlot",
          description: "The recent slot associated with the LUT",
          type: new TypeNumberNode("u64"),
        },
      ],
    },
  })
);

// Update accounts.
kinobi.update(
  new SetAccountDiscriminatorFromFieldVisitor({
    "splAddressLookupTable.addressLookupTable": {
      field: "discriminator",
      value: vScalar(1),
    },
  })
);

// Update instructions.
const ataPdaDefaults = {
  kind: "pda",
  pdaAccount: "AssociatedToken",
  dependency: "hooked",
  seeds: {
    owner: { kind: "account", name: "owner" },
    mint: { kind: "account", name: "mint" },
  },
};
kinobi.update(
  new UpdateInstructionsVisitor({
    transferSol: {
      accounts: {
        source: { defaultsTo: { kind: "identity" } },
      },
    },
    transferAllSol: {
      accounts: {
        source: { defaultsTo: { kind: "identity" } },
      },
    },
    mintTokensTo: {
      accounts: {
        mintAuthority: { defaultsTo: { kind: "identity" } },
      },
    },
    createAccount: {
      bytesCreatedOnChain: { kind: "arg", name: "space" },
    },
    createAccountWithRent: {
      bytesCreatedOnChain: { kind: "arg", name: "space" },
    },
    createAssociatedToken: {
      bytesCreatedOnChain: { kind: "account", name: "Token" },
      accounts: {
        owner: { defaultsTo: { kind: "identity" } },
        ata: { defaultsTo: ataPdaDefaults },
      },
    },
    createTokenIfMissing: {
      accounts: {
        ata: { defaultsTo: ataPdaDefaults },
        token: { defaultsTo: { kind: "account", name: "ata" } },
        owner: { defaultsTo: { kind: "identity" } },
      },
    },
    createLut: {
      bytesCreatedOnChain: { kind: "number", value: 56 },
      accounts: {
        address: {
          defaultsTo: { kind: "pda", pdaAccount: "addressLookupTable" },
          pdaBumpArg: "bump",
        },
      },
    },
    extendLut: {
      internal: true,
    },
  })
);

kinobi.update(
  new SetStructDefaultValuesVisitor({
    addressLookupTable: {
      padding: { ...vScalar(0), strategy: "omitted" },
    },
  })
);

// Wrap numbers.
kinobi.update(
  new SetNumberWrappersVisitor({
    "splSystem.CreateAccount.lamports": { kind: "SolAmount" },
    "splSystem.TransferSol.amount": { kind: "SolAmount" },
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(new RenderJavaScriptVisitor(jsDir, { prettier }));
