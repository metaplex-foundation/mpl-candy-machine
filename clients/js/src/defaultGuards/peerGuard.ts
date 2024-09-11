import { PublicKey } from '@metaplex-foundation/umi'
import {
    getPeerGuardSerializer,
    PeerGuard,
    PeerGuardArgs,
} from '../generated'
import { GuardManifest, noopParser } from '../guards'

export const peerGuardManifest: GuardManifest<
    PeerGuardArgs,
    PeerGuard,
    PeerGuardMintArgs
> = {
    name: 'peerGuard',
    serializer: getPeerGuardSerializer,
    mintParser: (context, mintContext, args) => {
        const { transactionPda } = args
        return {
            data: new Uint8Array(),
            // Pass in any accounts needed for your custom guard from your mint args.
            // Your guard may or may not need remaining accounts.
            remainingAccounts: [
                { publicKey: transactionPda, isWritable: true },
            ],
        }
    },
    routeParser: noopParser,
}

// Here you would fill out any custom Mint args needed for your guard to operate.
// Your guard may or may not need MintArgs.

export type PeerGuardMintArgs = {
    /**
     * Peer Guard Mint Arg 1
     */
    transactionPda: PublicKey
}