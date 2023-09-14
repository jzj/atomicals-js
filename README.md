# Atomicals Javascript Library

> atomicals.xyz

![Atomicals](banner.png)

### Install, Build and Run Tests

## Install

```
npm install atomicals
yarn add atomicals
```

```
npm install atomicals
or: npm install (Directly from inside this repo)
npm build
npm test

yarn add atomicals
or: yarn install (Directly from inside this repo)

yarn build
yarn test
```

### Quick Start - Command Line (CLI)

First install packages and build, then follow the steps here to create your first Atomical and query the status. Use `yarn cli`to get a list of all commands available.

#### 0. Environment File (.env)

The environment file comes with defaults (`.env.example`), but it is highly recommend to install and operate your own ElectrumX server. Web browser communication is possible through the `wss` (secure websockets) interface of ElectrumX.

```
ELECTRUMX_WSS=wss://electrumx.atomicals.xyz:50012
```

_ELECTRUMX_WSS_: URL of the ElectrumX with Atomicals support. Note that only `wss` endpoints are accessible from web browsers.

#### 1. Wallet Setup

The purpose of the wallet is to create p2tr (pay-to-taproot) spend scripts and to receive change from the transactions made for the various operations. _Do not put more funds than you can afford to lose, as this is still beta!_ 


To initialize a new `wallet.json` file that will store your address for receiving change use the `wallet-init` command. Alternatively, you may populate the `wallet.json` manually, ensuring that the address at `m/44'/0'/0'/0/0` is equal to the address and the derivePath is set correctly.

```
yarn cli wallet-init

>>>

Wallet created at wallet.json
phrase: maple maple maple maple maple maple maple maple maple maple maple maple
Legacy address (for change): 1FXL2CJ9nAC...u3e9Evdsa2pKrPhkag
Derive Path: m/44'/0'/0'/0/0
WIF: L5Sa65gNR6QsBjqK.....r6o4YzcqNRnJ1p4a6GPxqQQ
------------------------------------------------------
```


To generate a new wallet, use the `wallet-init` command. You can also provide your own 12 word seed phrase instead and decode it with `wallet-phrase-decode` command. For this example, we will just generate and initialize a new wallet.

```
yarn cli wallet-create

>>>

Generated mnemonic phrase:
phrase: maple maple maple maple maple maple maple maple maple maple maple maple
Legacy address (for change): 1FXL2CJ9nAC...u3e9Evdsa2pKrPhkag
Derive Path: m/44'/0'/0'/0/0
WIF: L5Sa65gNR6QsBjqK.....r6o4YzcqNRnJ1p4a6GPxqQQ
 
```

#### Explore the CLI

```
yarn cli --help
```
 
## ElectrumX Server RPC Interface

See updated ElectrumX documentation to interact using JSON-RPC and web sockets

## Any questions or ideas?

atomicals.xyz
@atomicalsxyz (X - Formerly Twitter)

  