import { ElectrumApiInterface } from "../api/electrum-api.interface";
import { CommandInterface } from "./command.interface";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'fs';
const bitcoin = require('bitcoinjs-lib');
bitcoin.initEccLib(ecc);
import {
  initEccLib,
  networks,
  Psbt,
} from "bitcoinjs-lib";
import { jsonFileReader, jsonFileWriter } from "../utils/file-utils";
import { detectAddressTypeToScripthash } from "../utils/address-helpers";
import { logBanner } from "./command-helpers";
import { KeyPairInfo, getKeypairInfo } from "../utils/address-keypair-path";
const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
initEccLib(tinysecp as any);
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const KEYPAIRS_FILE = 'keypairs.json';
export class SplitPrimaryCommand implements CommandInterface {
  constructor(
    private electrumApi: ElectrumApiInterface,
    private count: number,
    private satseach: number,
    private fundingWIF: string,
    private satsbyte: number,
    private address: string
  ) {
  }

  async run(): Promise<any> {
    if (isNaN(this.count)) {
      throw 'count must be an integer';
    }
    if (isNaN(this.satseach)) {
      throw 'satseach must be an integer';
    }

    const keypairs: any = await jsonFileReader(KEYPAIRS_FILE);
    if (!keypairs.phrase) {
      throw new Error(`phrase field not found in ${KEYPAIRS_FILE}`)
    }
    // Prepare the keys
    const keypairRaw = ECPair.fromWIF(
      this.fundingWIF,
    );
    const keypairFundingInfo: KeyPairInfo = getKeypairInfo(keypairRaw);
    logBanner('Split Wallet');
    // Validate that the addresses are valid
    try {
      detectAddressTypeToScripthash(this.address);
      console.log("Initial mint address:", this.address);
    } catch (ex) {
      console.log('Error validating initial owner address');
      throw ex;
    }
    const expectedSatoshisDeposit = this.count * this.satseach + (60 * this.count * this.satsbyte) + 300;
    logBanner(`DEPOSIT ${expectedSatoshisDeposit / 100000000} BTC to ${keypairFundingInfo.address}`)
    qrcode.generate(keypairFundingInfo.address, { });
    console.log(`...`)
    console.log(`...`)
    console.log(`WAITING UNTIL ${expectedSatoshisDeposit / 100000000} BTC RECEIVED AT ${keypairFundingInfo.address}`)
    console.log(`...`)
    console.log(`...`)
    let utxo = await this.electrumApi.waitUntilUTXO(keypairFundingInfo.address, expectedSatoshisDeposit, 5, false);
    console.log(`Detected UTXO (${utxo.txid}:${utxo.vout}) with value ${utxo.value} for funding...`);
    const psbt = new Psbt({ network: networks.bitcoin });
    psbt.setVersion(1);
    // Add the funding input
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.outputIndex,
      witnessUtxo: { value: utxo.value, script: keypairFundingInfo.output as any },
      tapInternalKey: keypairFundingInfo.childNodeXOnlyPubkey,
    })

    for (let i = 0; i < this.count; i++) {
      const nextAddress = keypairs.keypairs[i].address;
      const nextAddressFormatted = detectAddressTypeToScripthash(nextAddress);
      console.log('nextAddressFormatted', nextAddressFormatted);
      console.log('this.satseach', this.satseach);
      psbt.addOutput({
        address: nextAddressFormatted.address,
        value: parseInt(this.satseach as any, 10),
      });
    }

    // Add any change if needed NOT USED FOR NOW
    // psbt.signInput(0, keypairFundingInfo.childNode);
    psbt.signInput(0, keypairFundingInfo.tweakedChildNode)
    psbt.finalizeAllInputs();

    let tx = psbt.extractTransaction();
    const rawtx = tx.toHex();
    console.log(`Attempting to broadcast: ${tx.getId()}`);
    console.log(`Saved raw transaction to: reveal_txs/${tx.getId()}.json`);
    const revealDir = `reveal_txs/`;
    if (!fs.existsSync(revealDir)) {
      fs.mkdirSync(revealDir);
    }
    await jsonFileWriter(`reveal_txs/${tx.getId()}.json`, {
      rawtx,
    });
    console.log('tx', tx, rawtx)
    let txid = await this.electrumApi.broadcast(rawtx);
    console.log(`Success!`);
    return {
      success: true,
      data: {
        txid
      }
    }
  }

}