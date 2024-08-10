const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
	generator: "anchor",
	programName: "mallow_gumball",
	programId: "MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa",
	idlDir,
	binaryInstallDir,
	programDir: path.join(programDir, "mallow-gumball", "program"),
	rustbin: {
		locked: true,
		versionRangeFallback: "0.27.0",
	},
});

generateIdl({
	generator: "anchor",
	programName: "candy_guard",
	programId: "GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF",
	idlDir,
	binaryInstallDir,
	programDir: path.join(programDir, "candy-guard", "program"),
	rustbin: {
		locked: true,
		versionRangeFallback: "0.27.0",
	},
});
