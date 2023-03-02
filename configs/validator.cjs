const path = require("path");

const programDir = path.join(__dirname, "..", "programs");
function getProgram(dir, programName) {
  return path.join(programDir, dir, "target", "deploy", programName);
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
    ],
  },
};
