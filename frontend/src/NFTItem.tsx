import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
import {utils} from '@metaplex/js';
import { PublicKey, SystemProgram, Connection, Transaction, TransactionInstruction } from "@solana/web3.js";
import axios from 'axios';

const HAIKU_ADDRESS = "HAikuupsQpJViwtxtz2sGrgQ2hw18RYZ2pYQjLkNDcPw"
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
import { useWallet, useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';

import React, { useState, useEffect } from 'react';

const SERVER_URL = "https://solhaiku.is:8081"
/*
 * This one sets up NFT display, which includes the popup
 * NFTPopup displaying all the attached programs.
 */
export function NFTItem(props: {nft: any}) {
  const [metadata, setMetadata] = useState(undefined);
  const [extendedMetadata, setExtendedMetadata] = useState(undefined);
  const [displayState, setDisplayState] = useState('init');
  const [signature, setSignature] = useState('');

  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  useEffect(() => {
    Metadata.getPDA(props.nft).
      then((metadata_pda) => {
            return Metadata.load(connection, metadata_pda)

    }).then((metadata)=>{
      console.log("got metadata", metadata);
      utils.metadata.lookup(metadata.data.data.uri)
      .then((output)=>{
        console.log(output)
        setExtendedMetadata(output)
      });
      setMetadata(metadata)
    });
  }, [props.nft]);

  const requestHaiku = async (event:any) => {
      console.log(event);

      if(publicKey == undefined) {
          throw "cannot request haiku after disconnecting wallet"
      }

      const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(HAIKU_ADDRESS),
            lamports: 1,
          })
        );

        await transaction.add(
          new TransactionInstruction({
            keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
            data: Buffer.from(props.nft, 'utf-8'),
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
          })
        )

        const localSignature = await sendTransaction(transaction, connection);
        setDisplayState('sending');

        console.log(localSignature);
        setSignature(localSignature);
        setDisplayState('sending');
        try {
          await connection.confirmTransaction(localSignature, 'finalized')
        }catch(err) {
          setDisplayState("error getting confirmation");
        }


        axios.get(SERVER_URL+'/haiku/'+localSignature).then((resp)=>{
          console.log('res', resp);
          setDisplayState('success');
        }).catch((err)=> {
          setDisplayState("server confirmation unsuccessful - you might need to try again if devnet is slow");
        });
        setDisplayState('sent');
  }

  const sendSignature = (e:any) => {
      e.stopPropagation()
      axios.get(SERVER_URL+'/haiku/'+signature).then((resp)=>{
        console.log('res', resp);
        setDisplayState('success');
      }).catch((err)=> {
        setDisplayState("server confirmation unsuccessful - you might need to try again if devnet is slow");
      });
      setDisplayState('sent');
  };


  const displayDialogue = () => {
    switch (displayState) {
        case 'init':
            return (<Typography>init</Typography>);
        case 'confirmation':
            return (<Button onClick={requestHaiku}>send haiku</Button>);
        case 'sending':
            return (<Typography>sending</Typography>);
        case 'sent':
            return (<Typography>sent</Typography>);
        case 'success':
            return (<Typography>success!</Typography>);
        default:
            console.error("Error sending.");
        return (<Grid container> <Grid item><Typography>Error: {displayState}</Typography></Grid>
                <Grid item><Button onClick={sendSignature}>Server Confirm</Button></Grid></Grid>);
    }
  }



  const renderExtMetadata = (extMetadata) => {
    if (extMetadata == undefined)
      return 'loading...';
    return (
      <Paper sx={{display: 'flex', aspectRatio: 1.0, height:1.0, cursor: "pointer"}} onClick={(e)=>setDisplayState('confirmation')} title={extMetadata.description}>
          <Box sx={{display: 'inline-flex', maxWidth:0.3, m:1}} component="img" src={extMetadata.image}/>
          <Box sx={{flexDirection: "column", display: 'inline-flex', maxWidth:0.7, m:1}}>
        <Typography variant="h6">{extMetadata.name}</Typography>
        {displayDialogue()}

          </Box>
        </Paper>

    )

  }


  console.log(props.nft);
  return (
    <Grid item xs={12} sm={6} md={4} sx={{
      }}>
      <Box>
    {renderExtMetadata(extendedMetadata) }
  </Box>
    </Grid>
  )
}
