import { percentAmount, createSignerFromKeypair, generateSigner, some, signerIdentity, publicKey, PublicKey as UmiPk } from '@metaplex-foundation/umi'
import { TokenStandard, createNft, } from '@metaplex-foundation/mpl-token-metadata'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplCandyMachine, create, addConfigLines, mintV2, fetchCandyMachine } from '@metaplex-foundation/mpl-candy-machine'
import { ComputeBudgetProgram, Connection, PublicKey } from '@solana/web3.js'
import * as anchor from "@coral-xyz/anchor"
import {
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Ed25519Program,
    Transaction,
    Keypair,
} from "@solana/web3.js";
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import adminKey from "./admin-key.json"
import wallet from "./fee-wallet.json"
import base58 from "bs58";
import assert from 'assert';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'

const confirmTx = async (signature: string) => {
    const latestBlockhash = await anchor
        .getProvider()
        .connection.getLatestBlockhash();
    await anchor.getProvider().connection.confirmTransaction({
        signature,
        ...latestBlockhash,
    });
    return signature;
};

const log = async (signature: string): Promise<string> => {
    console.log(
        `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${anchor.getProvider().connection.rpcEndpoint
        }`
    );
    return signature.toString();
};

describe("peer_guard", () => {
    // Use the RPC endpoint of your choice.
    const umi = createUmi('https://api.devnet.solana.com').use(mplCandyMachine());
    let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
    let keypairJs = Keypair.fromSecretKey(new Uint8Array(wallet));
    const signer = createSignerFromKeypair(umi, keypair);
    const collectionMint = generateSigner(umi)
    umi.use(signerIdentity(signer));
    let candyMachinePk: UmiPk;
    let CollectionMintPk: UmiPk;
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminKey));
    const connection = new Connection("https://devnet.helius-rpc.com/?api-key=53adb904-7c5a-48ba-9807-c85a06a9b1f8", 'confirmed');
    const provider = new anchor.AnchorProvider(connection, new NodeWallet(keypairJs), anchor.AnchorProvider.defaultOptions());

    it("Creates collection nft", async () => {
        try {
            const createCollectionTx = await createNft(umi, {
                mint: collectionMint,
                authority: signer,
                name: 'PeerGuard Test NFT',
                uri: "",
                sellerFeeBasisPoints: percentAmount(9.99, 2), // 9.99%
                isCollection: true,
            }).sendAndConfirm(umi)

            CollectionMintPk = collectionMint.publicKey

            const signature = base58.encode(createCollectionTx.signature);

            console.log(
                `Collection NFT Minted! TX \nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`
            );
        } catch (e) {
            console.error(`Oops, something went wrong: ${e}`);
        }
    });

    it("Creates candy machine with peer guard", async () => {
        const candyMachine = generateSigner(umi)
        candyMachinePk = candyMachine.publicKey;
        try {
            const createCandyMachine = await create(umi, {
                candyMachine: candyMachine,
                collectionMint: collectionMint.publicKey,
                collectionUpdateAuthority: signer,
                tokenStandard: TokenStandard.NonFungible,
                sellerFeeBasisPoints: percentAmount(25, 2), // 9.99%
                itemsAvailable: 3,
                sysvarInstructions: publicKey(SYSVAR_INSTRUCTIONS_PUBKEY.toString()),
                guards: {
                    peerGuard: {
                        authority: publicKey("CaRLggMLuz9mYKwkv76Q5hXJvBgu9vqKyxgnxNZEDeHj"),
                    },
                },
                creators: [
                    {
                        address: umi.identity.publicKey,
                        verified: true,
                        percentageShare: 100,
                    },
                ],
                configLineSettings: some({
                    prefixName: '',
                    nameLength: 32,
                    prefixUri: '',
                    uriLength: 200,
                    isSequential: false,
                })
            });
            createCandyMachine.sendAndConfirm(umi)
            const signature = base58.encode((await createCandyMachine.sendAndConfirm(umi)).signature);

            console.log(
                `Candy Machine Created! TX \nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`
            );
            console.log(
                `Candy Machine PublicKey ${candyMachinePk}`
            );
        } catch (e) {
            console.error(`Oops, something went wrong: ${e}`);
        }
    })

    it("Inserts Items", async () => {
        try {
            const insertItems =
                await addConfigLines(umi, {
                    candyMachine: candyMachinePk,
                    index: 0,
                    configLines: [
                        { name: 'TEST NFT #1', uri: '' },
                        { name: 'TEST NFT #2', uri: '' },
                        { name: 'TEST NFT #3', uri: '' },
                    ],
                }).sendAndConfirm(umi);
            const signature = base58.encode(insertItems.signature);

            assert.equal((await fetchCandyMachine(umi, candyMachinePk)).itemsLoaded, 3, "Candy Machine Should Have 3 Items Loaded")

            console.log(
                `Items Inserted! TX \nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`
            );
        } catch (e) {
            console.error(`Oops, something went wrong: ${e}`);
        }
    });

    it("Mints with PeerGuard", async () => {

        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1000000
        });

        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1
        });

        const transactionId = Array.from({ length: 28 }, () =>
            Math.random().toString(36)[2]).join('');

        let idMsg = anchor.utils.bytes.utf8.encode(transactionId);

        let transactionIdPda = PublicKey.findProgramAddressSync(
            [
                idMsg,
            ],
            new PublicKey("3tvCcjNW6iQHhb5muybaB1i14FcR57t9CacG7pMBMG53")
        )[0];

        const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
            privateKey: adminKeypair.secretKey,
            message: idMsg,
        });

        const nftMint = generateSigner(umi)

        const mintV2Instructions =
            mintV2(umi, {
                candyMachine: candyMachinePk,
                nftMint,
                collectionMint: CollectionMintPk,
                collectionUpdateAuthority: signer.publicKey,
                tokenStandard: TokenStandard.NonFungible,
                mintArgs: {
                    peerGuard: {
                        transactionPda: publicKey(transactionIdPda.toString()),
                    },
                }
            }).getInstructions();

        const tx = new Transaction();
        tx.add(ed25519Ix);

        for (let i = 0; i < mintV2Instructions.length; i++) {
            tx.add(toWeb3JsInstruction(mintV2Instructions[i])).add(modifyComputeUnits)
                .add(addPriorityFee);
        }

        const nftMintSigner = Keypair.fromSecretKey(nftMint.secretKey);
        await provider.sendAndConfirm(tx, [nftMintSigner]).then(confirmTx).then(log);

        assert.equal((await fetchCandyMachine(umi, candyMachinePk)).itemsRedeemed.toString(), "1", "Candy Machine Should Have One Item Minted")

    });
});
