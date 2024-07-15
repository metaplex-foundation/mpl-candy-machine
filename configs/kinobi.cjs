const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([
  path.join(idlDir, "candy_machine_core.json"),
  path.join(idlDir, "candy_guard.json"),
]);

// Update programs.
kinobi.update(
  new k.UpdateProgramsVisitor({
    candyGuard: { name: "mplCandyGuard", prefix: "Cg" },
    candyMachineCore: { name: "mplCandyMachineCore", prefix: "Cm" },
  })
);

// Transform some defined types into accounts.
kinobi.update(
  new k.TransformDefinedTypesIntoAccountsVisitor([
    "mintCounter",
    "allowListProof",
    "allocationTracker",
  ])
);

// Reusable seeds.
const candyGuardSeed = k.publicKeySeed(
  "candyGuard",
  "The address of the Candy Guard account"
);
const candyMachineSeed = k.publicKeySeed(
  "candyMachine",
  "The address of the Candy Machine account"
);
const userSeed = k.publicKeySeed(
  "user",
  "The address of the wallet trying to mint"
);

// Update accounts.
kinobi.update(
  new k.UpdateAccountsVisitor({
    candyGuard: {
      internal: true,
      seeds: [
        k.stringConstantSeed("candy_guard"),
        k.publicKeySeed(
          "base",
          "The base address which the Candy Guard PDA derives from"
        ),
      ],
    },
    sellerHistory: {
      seeds: [
        k.stringConstantSeed("seller_history"),
        candyMachineSeed,
        k.publicKeySeed("seller", "The seller this history is tracking"),
      ],
    },
    mintCounter: {
      size: 2,
      discriminator: k.sizeAccountDiscriminator(),
      seeds: [
        k.stringConstantSeed("mint_limit"),
        k.variableSeed(
          "id",
          k.numberTypeNode("u8"),
          "A unique identifier in the context of a Candy Machine/Candy Guard combo"
        ),
        userSeed,
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
    allowListProof: {
      size: 8,
      discriminator: k.sizeAccountDiscriminator(),
      seeds: [
        k.stringConstantSeed("allow_list"),
        k.variableSeed(
          "merkleRoot",
          k.bytesTypeNode(k.fixedSize(32)),
          "The Merkle Root used when verifying the user"
        ),
        userSeed,
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
    freezeEscrow: {
      seeds: [
        k.stringConstantSeed("freeze_escrow"),
        k.publicKeySeed(
          "destination",
          "The wallet that will eventually receive the funds"
        ),
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
    allocationTracker: {
      size: 4,
      discriminator: k.sizeAccountDiscriminator(),
      seeds: [
        k.stringConstantSeed("allocation"),
        k.variableSeed(
          "id",
          k.numberTypeNode("u8"),
          "Unique identifier of the allocation"
        ),
        candyGuardSeed,
        candyMachineSeed,
      ],
    },
  })
);

// Update defined types.
kinobi.update(
  new k.UpdateDefinedTypesVisitor({
    candyGuardData: { delete: true },
    guardSet: { delete: true },
    group: { delete: true },
  })
);

// Update fields.
kinobi.update(
  new k.TransformNodesVisitor([
    {
      selector: { type: "structFieldTypeNode", name: "merkleRoot" },
      transformer: (node) => {
        return k.structFieldTypeNode({
          ...node,
          child: k.bytesTypeNode(k.fixedSize(32)),
        });
      },
    },
  ])
);

const defaultsToAssociatedTokenPda = (mint = "mint", owner = "owner") =>
  k.pdaDefault("associatedToken", {
    importFrom: "mplEssentials",
    seeds: { mint: k.accountDefault(mint), owner: k.accountDefault(owner) },
  });
const defaultsToSellerHistoryPda = (seller = "seller") =>
  k.pdaDefault("sellerHistory", {
    importFrom: "generated",
    seeds: { seller: k.accountDefault(seller) },
  });
const defaultsToCandyMachineAuthorityPda = (candyMachine = "candyMachine") =>
  k.pdaDefault("candyMachineAuthority", {
    importFrom: "hooked",
    seeds: { candyMachine: k.accountDefault(candyMachine) },
  });
const defaultsToCandyGuardPda = (base = "base") =>
  k.pdaDefault("candyGuard", {
    importFrom: "hooked",
    seeds: { base: k.accountDefault(base) },
  });
const defaultsToMetadataPda = (mint = "mint") =>
  k.pdaDefault("metadata", {
    importFrom: "mplTokenMetadata",
    seeds: { mint: k.accountDefault(mint) },
  });
const defaultsToMasterEditionPda = (mint = "mint") =>
  k.pdaDefault("masterEdition", {
    importFrom: "mplTokenMetadata",
    seeds: { mint: k.accountDefault(mint) },
  });
const defaultsToSplAssociatedTokenProgram = () =>
  k.programDefault(
    "splAssociatedToken",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
  );
const defaultsToMplCoreProgram = () =>
  k.programDefault(
    "mplCoreProgram",
    "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
  );

// Automatically recognize account default values.
kinobi.update(
  new k.SetInstructionAccountDefaultValuesVisitor([
    {
      ...k.publicKeyDefault("SysvarS1otHashes111111111111111111111111111"),
      account: /^recentSlothashes$/,
      ignoreIfOptional: true,
    },
    {
      ...k.identityDefault(),
      account: "candyMachineAuthority",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToSellerHistoryPda(),
      account: "sellerHistory",
      ignoreIfOptional: true,
    },
    {
      ...k.identityDefault(),
      account: "mintAuthority",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToCandyMachineAuthorityPda(),
      account: "authorityPda",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToCandyMachineAuthorityPda(),
      account: "candyMachineAuthorityPda",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToMetadataPda("mint"),
      account: "metadata",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToMasterEditionPda("mint"),
      account: "edition",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToAssociatedTokenPda("mint", "seller"),
      account: "tokenAccount",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToAssociatedTokenPda("mint", "authorityPda"),
      account: "tmpTokenAccount",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToMplCoreProgram(),
      account: "mplCoreProgram",
      ignoreIfOptional: true,
    },
    {
      ...defaultsToSplAssociatedTokenProgram(),
      account: "associatedTokenProgram",
      ignoreIfOptional: true,
    },
  ])
);

// Update instructions.
kinobi.update(
  new k.UpdateInstructionsVisitor({
    "mplCandyGuard.initialize": {
      name: "createCandyGuard",
      internal: true,
      accounts: {
        candyGuard: {
          defaultsTo: k.pdaDefault("candyGuard", { importFrom: "hooked" }),
        },
      },
    },
    "mplCandyMachineCore.initialize": { name: "initializeCandyMachine" },
    "mplCandyMachineCore.addNft": {
      name: "addNft",
      accounts: {
        seller: { defaultsTo: k.identityDefault() },
      },
    },
    "mplCandyMachineCore.removeNft": {
      name: "removeNft",
      accounts: {
        authority: { defaultsTo: k.identityDefault() },
        seller: { defaultsTo: k.identityDefault() },
        tokenAccount: {
          defaultsTo: defaultsToAssociatedTokenPda("mint", "authority"),
        },
      },
    },
    "mplCandyMachineCore.addCoreAsset": {
      name: "addCoreAsset",
      accounts: {
        seller: { defaultsTo: k.identityDefault() },
      },
    },
    "mplCandyMachineCore.removeCoreAsset": {
      name: "removeCoreAsset",
      accounts: {
        authority: { defaultsTo: k.identityDefault() },
        seller: { defaultsTo: k.identityDefault() },
      },
    },
    "mplCandyMachineCore.draw": {
      name: "drawFromCandyMachine",
      accounts: {
        buyer: { defaultsTo: k.identityDefault() },
      },
    },
    "mplCandyGuard.draw": {
      internal: true,
      args: {
        label: { name: "group" },
      },
      accounts: {
        candyGuard: { defaultsTo: defaultsToCandyGuardPda("candyMachine") },
        buyer: { defaultsTo: k.identityDefault() },
      },
    },
    "mplCandyGuard.route": {
      internal: true,
      args: {
        label: { name: "group" },
      },
      accounts: {
        candyGuard: { defaultsTo: defaultsToCandyGuardPda("candyMachine") },
      },
    },
    "mplCandyMachineCore.SetAuthority": { name: "SetCandyMachineAuthority" },
    "mplCandyGuard.SetAuthority": { name: "SetCandyGuardAuthority" },
    "mplCandyGuard.update": { name: "updateCandyGuard", internal: true },
    "mplCandyMachineCore.withdraw": { name: "deleteCandyMachine" },
    "mplCandyGuard.withdraw": { name: "deleteCandyGuard" },
  })
);

kinobi.update(new k.FlattenInstructionArgsStructVisitor());

const addItemDefaultArgs = { sellerProofPath: k.vNone() };
kinobi.update(
  new k.SetStructDefaultValuesVisitor({
    addNftInstructionData: addItemDefaultArgs,
    addCoreAssetInstructionData: addItemDefaultArgs,
  })
);

// Wrap numbers.
kinobi.update(
  new k.SetNumberWrappersVisitor({
    "startDate.date": { kind: "DateTime" },
    "endDate.date": { kind: "DateTime" },
    "botTax.lamports": { kind: "SolAmount" },
    "solPayment.lamports": { kind: "SolAmount" },
  })
);

// Custom serializers.
kinobi.update(
  new k.UseCustomAccountSerializerVisitor({
    candyMachine: { extract: true },
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
kinobi.accept(
  new k.RenderJavaScriptVisitor(jsDir, {
    prettier: require(path.join(clientDir, "js", ".prettierrc.json")),
    dependencyMap: {
      mplTokenMetadata: "@metaplex-foundation/mpl-token-metadata",
    },
  })
);
