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
import { witnessStackToScriptWitness } from "./witness_stack_to_script_witness";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const KEYPAIRS_FILE = 'keypairs.json';
export class RevealCommand implements CommandInterface {
 
  constructor( 
    private electrumApi: ElectrumApiInterface,
    private start: number,
    private end: number,
    private commitFile: string,
    private mintOwnerFileName: string,
    private satsbyte: number,
  ) {
 
    this.start = parseInt(start as any, 10);
    this.end = parseInt(end as any, 10);
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

    const commitFileRead: any = await jsonFileReader(this.commitFile);
    if (!commitFileRead.broadcastedMap) {
      throw new Error(`commitFileRead ${this.commitFile}`)
    }

    logBanner('Reveal all transactions');
    console.log('commitFile', this.commitFile);
    console.log('mintOwnerFileName', this.mintOwnerFileName);
    let startingCounter = this.start;
    let endingCounter = this.end;

    for (const prop in commitFileRead.broadcastedMap) {
      if (!commitFileRead.broadcastedMap.hasOwnProperty(prop)) {
        continue;
      }
      for (const indexProp in commitFileRead.broadcastedMap[prop]) {
        let i = parseInt(indexProp, 10);
        if (!commitFileRead.broadcastedMap[prop].hasOwnProperty(indexProp)) {
          continue;
        }
        if (i < startingCounter) {
          console.log('Skipping because i < startingCounter', i, startingCounter);
          continue;
        }
        if (i > endingCounter) {
          console.log('Skipping because i > endingCounter', i, endingCounter);
          continue;
        }
        const commitEntry = commitFileRead.broadcastedMap[prop][indexProp];
        console.log('Index of realm and keys: ', i);
        console.log('commitEntry: ', commitEntry);
        // We must continue and be resilient even on failure
        try {
          // Output keypair
          const outputKeypair = ECPair.fromWIF(
            mintOwnerFile.keypairs[i].WIF,
          );
          const outputKeypairInfo: KeyPairInfo = getKeypairInfo(outputKeypair);
          const realmName = commitEntry.realmName;
          const psbt = new Psbt({ network: networks.bitcoin });
          psbt.setVersion(1);
          const filesData = await prepareArgsMetaCtx({
            request_realm: realmName
          }, undefined, undefined)
          const { scriptP2TR, hashLockP2TR }: any = prepareCommitRevealConfig2('nft', outputKeypairInfo, filesData)
          console.log('Funding address of the funding private key (WIF): ', scriptP2TR.address);
          const tapLeafScript = {
            leafVersion: hashLockP2TR.redeem.redeemVersion,
            script: hashLockP2TR.redeem.output,
            controlBlock: hashLockP2TR.witness![hashLockP2TR.witness!.length - 1]
          };
          psbt.setVersion(1);
          psbt.addInput({
            hash: commitEntry.txid,
            index: commitEntry.outputIndex,
            witnessUtxo: { value: commitEntry.value, script: hashLockP2TR.output! },
            tapLeafScript: [
              tapLeafScript
            ]
          });
          psbt.addOutput({
            address: outputKeypairInfo.address,
            value: 1000,
          });
          // Add any change if needed NOT USED FOR NOW
          psbt.signInput(0, outputKeypairInfo.childNode);
          // We have to construct our witness script in a custom finalizer
          const customFinalizer = (_inputIndex: number, input: any) => {
            const scriptSolution = [
              input.tapScriptSig[0].signature,
            ];
            const witness = scriptSolution
              .concat(tapLeafScript.script)
              .concat(tapLeafScript.controlBlock);
            return {
              finalScriptWitness: witnessStackToScriptWitness(witness)
            }
          }
          psbt.finalizeInput(0, customFinalizer);
          let tx = psbt.extractTransaction();
          const rawtx = tx.toHex();
          console.log(`Attempting to broadcast: ${tx.getId()}`);
          console.log('tx', rawtx)
          let txid = await this.electrumApi.broadcast(rawtx);
          console.log('Broadcasted: ', txid);
          logBanner(tx.getId())
        } catch (error) {
          console.log('error', i, error);
        }
      }
    } 
    console.log(`Success!`);
    return {
      success: true,
      data: {

      }
    }
  }

}