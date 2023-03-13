const path = require("path");

const programDir = path.join(__dirname, "..", "programs");
function getProgram(dir, programName) {
  return path.join(programDir, dir, "target", "deploy", programName);
}
function getExternalProgram(programName) {
  return path.join(__dirname, "external-programs", programName);
}

module.exports = {
  validator: {
    commitment: "processed",
    programs: [
      {
        label: "Candy Machine Core",
        programId: "CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR",
        deployPath: getProgram(
          "candy-machine-core",
          "mpl_candy_machine_core.so"
        ),
      },
      {
        label: "Candy Guard",
        programId: "Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g",
        deployPath: getProgram("candy-guard", "mpl_candy_guard.so"),
      },
      {
        label: "Token Metadata",
        programId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        deployPath: getExternalProgram("mpl_token_metadata.so"),
      },
      {
        label: "System Extras",
        programId: "SysExL2WDyJi9aRZrXorrjHJut3JwHQ7R9bTyctbNNG",
        deployPath: getExternalProgram("mpl_system_extras.so"),
      },
      {
        label: "Token Extras",
        programId: "TokExjvjJmhKaRBShsBAsbSvEWMA1AgUNK7ps4SAc2p",
        deployPath: getExternalProgram("mpl_token_extras.so"),
      },
      {
        label: "Civic Gateway",
        programId: "gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs",
        deployPath: getExternalProgram("civic_gateway.so"),
      },
    ],
  },
};
