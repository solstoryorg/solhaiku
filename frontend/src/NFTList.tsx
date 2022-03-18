import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import { PublicKey, Keypair, SystemProgram, Connection, TokenAccountsFilter } from "@solana/web3.js";
import { NFTItem } from './NFTItem';
import React, { useState, useEffect } from 'react';

import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';
import { useWallet, useConnection, useAnchorWallet, ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
    LedgerWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    SolletExtensionWalletAdapter,
    SolletWalletAdapter,
    TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { Provider } from '@project-serum/anchor';

//hackathon bullshit because of es6 commonjs stuff

import { useSnackbar } from 'notistack';

const TOKEN_PROGRAM_KEY = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export function NFTList() {
    const { publicKey, signMessage, sendTransaction }= useWallet();
    const { connection }= useConnection();
    const anchorWallet = useAnchorWallet();
    let [nfts, setNfts] = useState([]);


    const getNFTs = function(ownerAddress:PublicKey|null){
        if (connection == undefined||ownerAddress == undefined)
              return;
        console.log("conection", connection);
        connection.getParsedTokenAccountsByOwner(ownerAddress, {programId: TOKEN_PROGRAM_KEY})
                .then((resp_and_ctx:any) => {
                    console.log("token get ctx", resp_and_ctx.context);
                    console.log("token get val", resp_and_ctx.value);
                    setNfts(resp_and_ctx.value.slice(0, 50).filter((item)=>{console.log(item.account.data.parsed.info.tokenAmount.amount); return item.account.data.parsed.info.tokenAmount.amount <= 1.0})
                            .map((item, i) => { console.log("mint?", item.account.data.parsed.info.mint); return item.account.data.parsed.info.mint}));
                    console.log('nfts', nfts)
              })
  };

  useEffect(() => {getNFTs(publicKey)}, [publicKey]);


  return (
        <Grid container direction="row" spacing={2}>
        {nfts.map((nft, index) => {return (
          <NFTItem key={nft} nft={nft} />
        )})}
  </Grid>
  )

}
