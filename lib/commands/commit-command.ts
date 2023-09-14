import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
  networks,
  Psbt,
} from "bitcoinjs-lib";
import { jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
import { calculateFundsRequired, logBanner, prepareArgsMetaCtx, prepareCommitRevealConfig, prepareCommitRevealConfig2 } from "./command-helpers";
import { KeyPairInfo, getKeypairInfo } from "../utils/address-keypair-path";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const KEYPAIRS_FILE = 'keypairs.json';
export class CommitCommand implements CommandInterface {
 
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private start: number,
    private end: number,
    private mainUtxoTxid: string,
    private eachUtxoValue: number,
    private file: string,
    private mintOwnerFileName: string,
    private fundingWIF: string,
    private satsbyte: number,
    private address: string
  ) {
 
    this.start = parseInt(start as any, 10);
    this.end = parseInt(end as any, 10);
    this.eachUtxoValue = parseInt(eachUtxoValue as any, 10);
  }

  async run(): Promise<any> {
    if (isNaN(this.start)) {
      throw 'start must be an integer';
    }
    const keypairsFile: any = await jsonFileReader(KEYPAIRS_FILE);
    if (!keypairsFile.phrase) {
      throw new Error(`phrase field not found in ${KEYPAIRS_FILE}`)
    }

    const mintOwnerFile: any = await jsonFileReader(this.mintOwnerFileName);
    if (!mintOwnerFile.phrase) {
      throw new Error(`phrase field not found in mint owner ${this.mintOwnerFileName}`)
    }

    const realmNames: any = await jsonFileReader(this.file);
    if (!realmNames.realms) {
      throw new Error(`realms not found in file`)
    }
  
    logBanner('Send all transactions');
    console.log('mainUtxoTxid', this.mainUtxoTxid);
    console.log('file', this.file);
    // Validate that the addresses are valid
    try {
      detectAddressTypeToScripthash(this.address);
      console.log("Initial mint address:", this.address);
    } catch (ex) {
      console.log('Error validating initial owner address');
      throw ex;
    }
    const totalRealms = realmNames.realms.length;
    console.log('totalRealms', this.start, totalRealms);

    let startingCounter = this.start;
    let endingCounter = this.end;
    if (endingCounter >= totalRealms) {
      endingCounter = totalRealms;
    }
    const broadcastedMap = {};
    for (let i = startingCounter; i < endingCounter; i++) {
      // We must continue and be resilient even on failure
      try {
        // Prepare the keys
        const inputKeypair = ECPair.fromWIF(
          keypairsFile.keypairs[i].WIF,
        );
        const keypairInfo: KeyPairInfo = getKeypairInfo(inputKeypair);
        // Output keypair
        const outputKeypair = ECPair.fromWIF(
          mintOwnerFile.keypairs[i].WIF,
        );
        const outputKeypairInfo: KeyPairInfo = getKeypairInfo(outputKeypair);
        const realmName = realmNames.realms[i];
        const psbt = new Psbt({ network: networks.bitcoin });
        psbt.setVersion(1);
        // Add the funding input
        psbt.addInput({
          hash: this.mainUtxoTxid,
          index: i,
          witnessUtxo: { value: this.eachUtxoValue, script: keypairInfo.output as any },
          tapInternalKey: keypairInfo.childNodeXOnlyPubkey,
        })
        const filesData = await prepareArgsMetaCtx({
          request_realm: realmName
        }, undefined, undefined)
        const { scriptP2TR, hashLockP2TR }: any = prepareCommitRevealConfig2('nft', outputKeypairInfo, filesData)

        const oneInputOneOutputTxSize = 170;
        const utxoValue = this.eachUtxoValue - (oneInputOneOutputTxSize * this.satsbyte);
        psbt.addOutput({
          address: scriptP2TR.address,
          value: utxoValue
        });
        psbt.signInput(0, keypairInfo.tweakedChildNode)
        psbt.finalizeAllInputs();
        let tx = psbt.extractTransaction();
        const rawtx = tx.toHex();
        console.log(`Attempting to broadcast: ${tx.getId()}`);
        await jsonFileWriter(`reveal_txs/${tx.getId()}.json`, {
          rawtx,
        });
        console.log('tx', rawtx)

        broadcastedMap[this.mainUtxoTxid] = broadcastedMap[this.mainUtxoTxid] || {}
        broadcastedMap[this.mainUtxoTxid][i] = {
          txid: tx.getId(),
          outputIndex: 0, // Always the 0'th according to the logic in this area
          rawtx,
          realmName,
          output: mintOwnerFile.keypairs[i].output,
          value: utxoValue,
          WIF: mintOwnerFile.keypairs[i].WIF,
        }
        let txid = await this.electrumApi.broadcast(rawtx);
        console.log('Broadcasted: ', txid);
        logBanner(tx.getId())
      } catch (error) {
        console.log('error', i, error);
      }
    }
    const timestamp = (new Date()).getTime();
    await jsonFileWriter(`commit-command-output-${timestamp}.json`, {
      broadcastedMap,
    });
    console.log(`Success!`);
    return {
      success: true,
      data: {

      }
    }
  }

}