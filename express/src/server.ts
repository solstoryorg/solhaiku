import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';

import express, { NextFunction, Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';
import 'express-async-errors';
import NodeCache from 'node-cache';

import logger from 'jet-logger';
import fs from 'fs';

import { Connection, Transaction, ParsedInstruction, ParsedAccountData, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet, Provider, } from '@project-serum/anchor';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { SolstoryAPI, utils, SolstoryItemInner, SolstoryItemType } from '@solstory/api';
import { TextEncoder } from 'util';

// Constants
const app = express();
const ANCHOR_WALLET = process.env.ANCHOR_WALLET as string
let ENDPOINT = 'https://api.devnet.solana.com';
let BUNDLR_ENDPOINT = 'devnet';


/***********************************************************************************
 *                                  Middlewares
 **********************************************************************************/


// Common middlewares
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

// Show routes called in console during development
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
    ENDPOINT = 'http://localhost:8899'
    // ENDPOINT = 'https://api.devnet.solana.com';
    BUNDLR_ENDPOINT = 'devnet';

}
//
// Security (helmet recommended in express docs)
if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
    ENDPOINT = 'https://api.devnet.solana.com'
    BUNDLR_ENDPOINT = 'devnet';
}



/***********************************************************************************
 *                                  Infrastructure
 **********************************************************************************/


console.log("Using wallet: ", ANCHOR_WALLET);

// Same code you'd use to initialize anchor.
const connection = new Connection(ENDPOINT);
const raw = fs.readFileSync(path.resolve(ANCHOR_WALLET), 'utf8');
const wallet = new Wallet(Keypair.fromSecretKey(Buffer.from(JSON.parse(raw))));
const provider = new Provider(connection, wallet, { commitment: 'confirmed' });

const solstoryApi = new SolstoryAPI({}, provider);
// Just one extra step to configure automatic data uploading
solstoryApi.configureBundlrServer(Buffer.from(JSON.parse(raw)), BUNDLR_ENDPOINT);

const jsonRaw = fs.readFileSync(path.resolve(__dirname + '/../haikus.json'))
type HaikuType = {
    line1: string,
    line2: string,
    line3: string
}
const haikus = JSON.parse(jsonRaw.toString()) as HaikuType[];

/***********************************************************************************
 *                         API routes and error handling
 **********************************************************************************/

const router = Router()
const { CREATED, OK } = StatusCodes;
const transCache = new NodeCache({stdTTL: 60*60})

/*
 * This function is just an easy way for us to handle one time setup for solstory. It would
 * be totally reasonable to do this as a yarn script. Actually it would make a lot
 * more sense as a yarn script. But I was feeling lazy the morning I wrote this.
 */
router.get('/init',  async (req: Request, res: Response, next:NextFunction):Promise<string> => {
    const [solstoryPda, _nonce2] = await PublicKey.findProgramAddress(
      [Buffer.from((new TextEncoder()).encode("solstory_pda"))],
      solstoryApi.programId
    );

    return solstoryApi.server.writer.createWriterMetadata({
        writerKey: wallet.payer.publicKey,
        cdn: "",
        label: "Haiku!",
        description: "AI generated haikus for your NFTs",
        url: "http://solhaiku.is",
        metadata: JSON.stringify({}),
        hasExtendedMetadata:false,
        systemValidated: false,
        logo: "",
        baseUrl:"",
        apiVersion: 1,
        visible: true,
    })

});

router.get('/haiku/:txid', (req: Request, res: Response, next:NextFunction) => {
    const { txid } = req.params;

    // quick bit of ddos prevention - we don't want to infinitely append because
    // non-users could repeatedly send us stale transactions to try and trigger a flood
    const cacheHit = transCache.get(txid);
    if(cacheHit){
        throw Error("Transaction already processed.");
    }

    console.log("Attempting to confirm ", txid);
    connection.confirmTransaction(txid).then((res) => {
        console.log("confirmed transaction: ", res)
        // get the transaction
        return connection.getParsedTransaction((txid ))
    }).then(async (tx) => {
        if(tx==null)
            throw Error("Transaction not found")




        const timestamp = tx.blockTime
        if (!timestamp)
            throw Error("Transaction timestamp missing");

        // 1000 here because date works in ms
        // if((Date.now() - timestamp*1000) > (60*60 * 1000)) {
        //     throw Error("Transaction too far past");
        // }

        //Verify that the given transaction has the correct shape.
        const transferIx = tx.transaction.message.instructions[0] as ParsedInstruction;
        if (transferIx.program != 'system' ||
            transferIx.parsed.info.destination != wallet.payer.publicKey.toBase58() ||
                transferIx.parsed.type != 'transfer'){
            throw Error("Invalid transaction")
        }


        const memoIx = tx.transaction.message.instructions[1] as ParsedInstruction;
        if(memoIx.program != 'spl-memo' ||
          memoIx.parsed.length > 44 || memoIx.parsed.length < 32)
            throw Error("Invalid transaction");

        // Drag out the owner (ty Solana Cookbook)
        const nftId:string = memoIx.parsed;
        const bigActs = await connection.getTokenLargestAccounts(new PublicKey(nftId));
        const largestAccountInfo = await connection.getParsedAccountInfo(bigActs.value[0].address);
        if(largestAccountInfo.value == undefined)
            throw Error("Invalid transaction");
        const ownerActual = (largestAccountInfo.value.data as ParsedAccountData).parsed.info.owner;

        const ownerShould = transferIx.parsed.info.source;

        // Verify that the nft owner is the one who made the transaction request
        if(ownerActual != ownerShould)
            throw Error("Invalid transaction");

        const haiku = (haikus as []).pop() as unknown as HaikuType
        const haikuText = haiku.line1 + "\n" + haiku.line2 + "\n" + haiku.line3;

        //Juicy solstory bits!
        const item:SolstoryItemInner = {
            type: SolstoryItemType.Item,
            display:{
                label: "Haiku!",
                description: haikuText,
                helpText: "This haiku was generated by a GPT-2 neural net.",
                img: "https://solstory.is/static/logo.jpg"
            },
            data: {
                haiku:haiku,
            }
        }
        const out = await solstoryApi.server.writer.appendItemCreate(new PublicKey(nftId), item);



        // tx.meta?.innerInstructions?.length == 2
        // const message = tx?.transaction.message;
        // message?.instructions.forEach((ix, index) =>  {

        //     const programId = message?.accountKeys[ix.programIdIndex]
        //     ix.program;
        // });



        transCache.set(txid, true);
        res.status(OK).json(tx);
    }).catch(next);
});

app.use(cors())

app.use(router);


// Add api router
// app.use('/api', apiRouter);

// Error handling
app.use((err: Error, _: Request, res: Response, __: NextFunction) => {
    logger.err(err, true);
    return res.status(500).json({
        error: err.message,
    });
});


/***********************************************************************************
 *                                  Front-end content
 **********************************************************************************/

// Set static dir
const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));



// Export here and start in a diff file (for testing).
export default app;
