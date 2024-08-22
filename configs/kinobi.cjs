const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([
	path.join(idlDir, "mallow_gumball.json"),
	path.join(idlDir, "candy_guard.json"),
]);

// Update programs.
kinobi.update(
	new k.UpdateProgramsVisitor({
		candyGuard: { name: "mplCandyGuard", prefix: "Cg" },
		gumballMachineCore: { name: "mallowGumball", prefix: "Cm" },
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
const gumballGuardSeed = k.publicKeySeed(
	"gumballGuard",
	"The address of the Gumball Guard account"
);
const gumballMachineSeed = k.publicKeySeed(
	"gumballMachine",
	"The address of the Gumball Machine account"
);
const userSeed = k.publicKeySeed("user", "The address of the wallet trying to mint");

// Update accounts.
kinobi.update(
	new k.UpdateAccountsVisitor({
		gumballGuard: {
			internal: true,
			seeds: [
				k.stringConstantSeed("gumball_guard"),
				k.publicKeySeed("base", "The base address which the Gumball Guard PDA derives from"),
			],
		},
		sellerHistory: {
			seeds: [
				k.stringConstantSeed("seller_history"),
				gumballMachineSeed,
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
					"A unique identifier in the context of a Gumball Machine/Gumball Guard combo"
				),
				userSeed,
				gumballGuardSeed,
				gumballMachineSeed,
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
				gumballGuardSeed,
				gumballMachineSeed,
			],
		},
		freezeEscrow: {
			seeds: [
				k.stringConstantSeed("freeze_escrow"),
				k.publicKeySeed("destination", "The wallet that will eventually receive the funds"),
				gumballGuardSeed,
				gumballMachineSeed,
			],
		},
		allocationTracker: {
			size: 4,
			discriminator: k.sizeAccountDiscriminator(),
			seeds: [
				k.stringConstantSeed("allocation"),
				k.variableSeed("id", k.numberTypeNode("u8"), "Unique identifier of the allocation"),
				gumballGuardSeed,
				gumballMachineSeed,
			],
		},
	})
);

// Update defined types.
kinobi.update(
	new k.UpdateDefinedTypesVisitor({
		gumballGuardData: { delete: true },
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
const defaultsToEventAuthorityPda = () =>
	k.pdaDefault("eventAuthority", {
		importFrom: "hooked",
	});
const defaultsToGumballMachineAuthorityPda = (gumballMachine = "gumballMachine") =>
	k.pdaDefault("gumballMachineAuthority", {
		importFrom: "hooked",
		seeds: { gumballMachine: k.accountDefault(gumballMachine) },
	});
const defaultsToGumballGuardPda = (base = "base") =>
	k.pdaDefault("gumballGuard", {
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
	k.programDefault("splAssociatedToken", "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const defaultsToMplCoreProgram = () =>
	k.programDefault("mplCoreProgram", "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const defaultsToProgram = () =>
	k.programDefault("mallowGumball", "MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa");

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
			account: "gumballMachineAuthority",
			ignoreIfOptional: true,
		},
		{
			...defaultsToEventAuthorityPda(),
			account: "eventAuthority",
			ignoreIfOptional: true,
		},
		{
			...defaultsToEventAuthorityPda(),
			account: "gumballEventAuthority",
			ignoreIfOptional: true,
		},
		{
			...defaultsToProgram(),
			account: "program",
			ignoreIfOptional: true,
		},
		{
			...defaultsToProgram(),
			account: "gumballMachineProgram",
			ignoreIfOptional: true,
		},
		{
			...k.payerDefault(),
			account: "payer",
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
			...defaultsToGumballMachineAuthorityPda(),
			account: "authorityPda",
			ignoreIfOptional: true,
		},
		{
			...defaultsToGumballMachineAuthorityPda(),
			account: "gumballMachineAuthorityPda",
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
			name: "initializeGumballGuard",
			internal: true,
			accounts: {
				gumballGuard: {
					defaultsTo: k.pdaDefault("gumballGuard", { importFrom: "hooked" }),
				},
			},
		},
		"mallowGumball.initialize": { name: "initializeGumballMachine" },
		"mallowGumball.addNft": {
			name: "addNft",
			accounts: {
				seller: { defaultsTo: k.identityDefault() },
			},
		},
		"mallowGumball.removeNft": {
			name: "removeNft",
			accounts: {
				authority: { defaultsTo: k.identityDefault() },
				seller: { defaultsTo: k.identityDefault() },
				tokenAccount: {
					defaultsTo: defaultsToAssociatedTokenPda("mint", "authority"),
				},
			},
		},
		"mallowGumball.addCoreAsset": {
			name: "addCoreAsset",
			accounts: {
				seller: { defaultsTo: k.identityDefault() },
			},
		},
		"mallowGumball.removeCoreAsset": {
			name: "removeCoreAsset",
			accounts: {
				authority: { defaultsTo: k.identityDefault() },
				seller: { defaultsTo: k.identityDefault() },
			},
		},
		"mallowGumball.draw": {
			name: "drawFromGumballMachine",
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
				gumballGuard: { defaultsTo: defaultsToGumballGuardPda("gumballMachine") },
				buyer: { defaultsTo: k.identityDefault() },
			},
		},
		"mallowGumball.claimNft": {
			name: "claimNft",
			accounts: {
				buyer: { defaultsTo: k.identityDefault() },
				buyerTokenAccount: {
					defaultsTo: defaultsToAssociatedTokenPda("mint", "buyer"),
				},
			},
		},
		"mallowGumball.claimCoreAsset": {
			name: "claimCoreAsset",
			accounts: {
				buyer: { defaultsTo: k.identityDefault() },
			},
		},
		"mplCandyGuard.route": {
			internal: true,
			args: {
				label: { name: "group" },
			},
			accounts: {
				gumballGuard: { defaultsTo: defaultsToGumballGuardPda("gumballMachine") },
			},
		},
		"mallowGumball.settleNftSale": {
			name: "baseSettleNftSale",
			accounts: {
				buyer: { defaultsTo: k.identityDefault() },
				buyerTokenAccount: { defaultsTo: defaultsToAssociatedTokenPda("mint", "buyer") },
				authorityPdaPaymentAccount: {
					defaultsTo: k.conditionalDefault("account", "paymentMint", {
						ifTrue: defaultsToAssociatedTokenPda("paymentMint", "authorityPda"),
					}),
				},
				authorityPaymentAccount: {
					defaultsTo: k.conditionalDefault("account", "paymentMint", {
						ifTrue: defaultsToAssociatedTokenPda("paymentMint", "authority"),
					}),
				},
				sellerPaymentAccount: {
					defaultsTo: k.conditionalDefault("account", "paymentMint", {
						ifTrue: defaultsToAssociatedTokenPda("paymentMint", "seller"),
					}),
				},
			},
		},
		"mallowGumball.settleCoreAssetSale": {
			name: "baseSettleCoreAssetSale",
			accounts: {
				buyer: { defaultsTo: k.identityDefault() },
				authorityPdaPaymentAccount: {
					defaultsTo: k.conditionalDefault("account", "paymentMint", {
						ifTrue: defaultsToAssociatedTokenPda("paymentMint", "authorityPda"),
					}),
				},
				authorityPaymentAccount: {
					defaultsTo: k.conditionalDefault("account", "paymentMint", {
						ifTrue: defaultsToAssociatedTokenPda("paymentMint", "authority"),
					}),
				},
				sellerPaymentAccount: {
					defaultsTo: k.conditionalDefault("account", "paymentMint", {
						ifTrue: defaultsToAssociatedTokenPda("paymentMint", "seller"),
					}),
				},
			},
		},
		"mallowGumball.SetAuthority": { name: "SetGumballMachineAuthority" },
		"mplCandyGuard.SetAuthority": { name: "SetGumballGuardAuthority" },
		"mplCandyGuard.update": { name: "updateGumballGuard", internal: true },
		"mallowGumball.withdraw": { name: "deleteGumballMachine" },
		"mplCandyGuard.withdraw": { name: "deleteGumballGuard" },
	})
);

kinobi.update(new k.FlattenInstructionArgsStructVisitor());

const addItemDefaultArgs = { sellerProofPath: k.vNone() };
kinobi.update(
	new k.SetStructDefaultValuesVisitor({
		addNftInstructionData: addItemDefaultArgs,
		addCoreAssetInstructionData: addItemDefaultArgs,
		initializeGumballMachineInstructionData: {
			feeConfig: k.vNone(),
		},
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
		gumballMachine: { extract: true },
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
