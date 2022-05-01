# SolDracula

This is a demo project of a simple way to use the solstory api to append data to NFTs.

Relevant and interesting:

`express/src/server.ts` is the backend file. It checks for a sol payment (which is basically
confirmation that the wallet that holds the NFT we're attaching to has actually
requested it). Then it appends a haiku to the NFT in question using the Solstory API.

The frontend is pretty much a bog standard [sol-wallet-adapter](https://github.com/project-serum/sol-wallet-adapter)
template with a trigger to send the transaction and then send the backend
a note to check for the transaction.

