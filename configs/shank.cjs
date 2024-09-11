const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "candy_machine_core",
  programId: "CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "candy-machine-core", "program"),
  rustbin: {
    locked: true,
    versionRangeFallback: "0.27.0",
  },
});

generateIdl({
  generator: "anchor",
  programName: "candy_guard",
  programId: "3tvCcjNW6iQHhb5muybaB1i14FcR57t9CacG7pMBMG53",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "candy-guard", "program"),
  rustbin: {
    locked: true,
    versionRangeFallback: "0.27.0",
  },
});
