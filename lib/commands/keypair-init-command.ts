import { CommandResultInterface } from "./command-result.interface";
import { CommandInterface } from "./command.interface";
import { createNKeyPairs } from "../utils/create-key-pair";
import { jsonFileExists, jsonFileWriter } from "../utils/file-utils";
import { createMnemonicPhrase } from "../utils/create-mnemonic-phrase";

const walletPath = "keypairs.json";

export class KeypairInitCommand implements CommandInterface {

    constructor(private count: number) {
    }

    async run(): Promise<CommandResultInterface> {
        if (await this.walletExists()) {
            throw "keypairs.json exists, please remove it first to initialize another";
        }
        const phraseResult = await createMnemonicPhrase();
        const keypairs = await createNKeyPairs(phraseResult.phrase, this.count);

        await jsonFileWriter(walletPath, keypairs);
        return {
            success: true,
            data: keypairs
        }
    }

    async walletExists() {
        if (await jsonFileExists(walletPath)) {
            return true;
        }
    }
}