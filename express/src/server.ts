import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import helmet from 'helmet';

import express, { NextFunction, Request, Response, Router } from 'express';
import StatusCodes from 'http-status-codes';
import 'express-async-errors';
import NodeCache from 'node-cache';

import logger from 'jet-logger';
import fs from 'fs';

import { Connection, Transaction, ParsedInstruction, Keypair } from '@solana/web3.js';
import { Wallet, Provider, } from '@project-serum/anchor';
import { SolstoryAPI } from '@solstory/api';

// Constants
const app = express();

/***********************************************************************************
 *                                  Infrastructure
 **********************************************************************************/

// let ENDPOINT = 'http://localhost:8899';
let ENDPOINT = 'https://api.devnet.solana.com';
const ANCHOR_WALLET = process.env.ANCHOR_WALLET as string
console.log(ANCHOR_WALLET);
try {
    const raw = fs.readFileSync(path.resolve(ANCHOR_WALLET), 'utf8')
    Keypair.fromSecretKey(JSON.parse(raw));

} catch (err) {
    throw Error(err)
}

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
    ENDPOINT = 'https://api.devnet.solana.com';

}

// Security (helmet recommended in express docs)
if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
    ENDPOINT = 'https://solana-api.projectserum.com'
}
const connection = new Connection(ENDPOINT);


/***********************************************************************************
 *                         API routes and error handling
 **********************************************************************************/

const router = Router()
const { CREATED, OK } = StatusCodes;
const transCache = new NodeCache({stdTTL: 60*60})

const solstoryProgram = new SolstoryAPI({}, new Provider(conn, anchorWallet, {}) );

/*
 * getMin
 * getOwner
 * findProgramAddress("haikupls", owner_id)
 * verify it exists
 * check if head exists create
 * createHeadIfNotExist
 * bundlr upload
 */
router.get('/haiku/:txid', (req: Request, res: Response, next:NextFunction) => {
    const { txid } = req.params;

    // quick bit of ddos prevention - we don't want to infinitely append because
    // non-users could repeatedly send us stale transactions to try and trigger a flood
    const cacheHit = transCache.get(txid);
    if(cacheHit){
        throw Error("Transaction already processed.");
    }

    connection.getParsedTransaction((txid )).then((tx) => {



        console.dir(tx, { depth: 10});

        const timestamp = tx?.blockTime
        if (!timestamp)
            throw Error("Transaction timestamp missing");

        // 1000 here because date works in ms
        if((Date.now() - timestamp*1000) > (60*60 * 1000)) {
            throw Error("Transaction too far past");
        }

        const transferIx = tx.transaction.message.instructions[0] as ParsedInstruction;
        if (transferIx.program != 'system' ||
            transferIx.parsed.destination != provider.payer.publicKey ||
                transferIx.parsed.type != 'transfer' ||


        const ownerShould = transferIx.parsed.source

        const memoIx = tx.transaction.message.instructions[1];

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
