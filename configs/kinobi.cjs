const path = require("path");
const {
  Kinobi,
  RenderJavaScriptVisitor,
  SetNumberWrappersVisitor,
  UpdateAccountsVisitor,
  UpdateInstructionsVisitor,
  UpdateProgramsVisitor,
  SetStructDefaultValuesVisitor,
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

// Update accounts.
kinobi.update(
  new UpdateAccountsVisitor({
    //
  })
);

// Update instructions.
kinobi.update(
  new UpdateInstructionsVisitor({
    "mplCandyMachineCore.initialize": { name: "initializeCandyMachine" },
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
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(new RenderJavaScriptVisitor(jsDir, { prettier }));
