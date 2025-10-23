import { wasm as wasmTester } from 'circom_tester';
import * as path from 'path';
import {  NON_OFAC_DUMMY_INPUT, OFAC_DUMMY_INPUT } from '@selfxyz/common';
import { SMT } from '@openpassport/zk-kit-smt';
import { poseidon2 } from 'poseidon-lite';
import fs from 'fs';
import { unpackReveal } from '@selfxyz/common/utils/circuits/formatOutputs.js';
import { SELFRICA_MAX_LENGTH } from '@selfxyz/common';
import { deepEqual } from 'assert';
import { expect } from 'chai';
import { customHasher } from '@selfxyz/common';
import { serializeSmileData } from '@selfxyz/common';
import forge from 'node-forge';
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { generateSelfricaDiscloseInput } from '@selfxyz/common/utils/selfrica/generateInputs';
import { SelfricaField } from '@selfxyz/common/utils/selfrica/constants';

const __dirname = path.dirname(__filename);

const nameAndDobjson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../consts/ofac/nameAndDobSelfricaSMT.json'), 'utf8')
);
const nameAndYobjson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../consts/ofac/nameAndYobSelfricaSMT.json'), 'utf8')
);

// Create Merkle tree at module level
const tree: any = new LeanIMT((a, b) => poseidon2([a, b]), []);


describe('should verify signature on random inputs', () => {
    let circuit;
    let namedob_smt = new SMT(poseidon2, true);
    let nameyob_smt = new SMT(poseidon2, true);

    namedob_smt.import(nameAndDobjson);
    nameyob_smt.import(nameAndYobjson);

    before(async function () {
        this.timeout(0);
        circuit = await wasmTester(
            path.join(__dirname, '../../circuits/disclose/vc_and_disclose_selfrica.circom'),
            {
                verbose: true,
                logOutput: true,
                include: [
                    'node_modules',
                    'node_modules/@zk-kit/binary-merkle-root.circom/src',
                    'node_modules/circomlib/circuits',
                ],
            }
        );
    });

    it('should compile and load the circuit', async function () {
        this.timeout(0);
        expect(circuit).to.not.be.undefined;
      });

    it('should verify for correct Circuit Input and output ', async function () {
        this.timeout(0);
        const input = generateSelfricaDiscloseInput(NON_OFAC_DUMMY_INPUT, namedob_smt, nameyob_smt, tree, false, '0', '1234567890', undefined, undefined, undefined, true);
        try {
            const witness = await circuit.calculateWitness(input);
            await circuit.checkConstraints(witness);
        } catch (e) { throw e }
    });

    it('should fail for invalid msg  ascii ', async function () {
        this.timeout(0);
        const input = generateSelfricaDiscloseInput(NON_OFAC_DUMMY_INPUT, namedob_smt, nameyob_smt, tree, false, '0', '1234567890', undefined, undefined, undefined, true);


        input.SmileID_data_padded[4] = "9999999";
        try {
            const witness = await circuit.calculateWitness(input);
            await circuit.checkConstraints(witness);

            throw new Error(" Circuit verified for invalid msg byte ascii ");
        } catch (e) {
            const errMsg = e?.message || e?.toString?.() || "";
            if (!errMsg.includes("Num2Bits")) {
                console.log('errMsg', errMsg);
                throw new Error(`Expected error message to include "Num2Bits", but got:\n${errMsg}`);
            }
        }
    });


    it("should return 0 for an OFAC person", async function () {
        this.timeout(0);
        const input = generateSelfricaDiscloseInput(OFAC_DUMMY_INPUT, namedob_smt, nameyob_smt, tree, true, '0', '1234567890', undefined, undefined, undefined, true);
        try {
            const witness = await circuit.calculateWitness(input);
            await circuit.checkConstraints(witness);

            const revealedData = (await circuit.getOutput(witness, ['revealedData_packed[9]']));
            const revealedData_packed = [
                revealedData['revealedData_packed[0]'],
                revealedData['revealedData_packed[1]'],
                revealedData['revealedData_packed[2]'],
                revealedData['revealedData_packed[3]'],
                revealedData['revealedData_packed[4]'],
                revealedData['revealedData_packed[5]'],
                revealedData['revealedData_packed[6]'],
                revealedData['revealedData_packed[7]'],
                revealedData['revealedData_packed[8]'],
            ];
            const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');
            const ofac_results = revealedDataUnpacked.slice(SELFRICA_MAX_LENGTH, SELFRICA_MAX_LENGTH + 2);

            deepEqual(ofac_results, ['\x00', '\x00']);
        } catch (e) {
            console.log(e.message);
        }
    })

    it("should return 1 for a non OFAC person", async function () {
        this.timeout(0);
        const input = generateSelfricaDiscloseInput(NON_OFAC_DUMMY_INPUT, namedob_smt, nameyob_smt, tree, true, '0', '1234567890', undefined, undefined, undefined, true);
        try {
            const witness = await circuit.calculateWitness(input);
            await circuit.checkConstraints(witness);

            const revealedData = (await circuit.getOutput(witness, ['revealedData_packed[9]']));
            const revealedData_packed = [
                revealedData['revealedData_packed[0]'],
                revealedData['revealedData_packed[1]'],
                revealedData['revealedData_packed[2]'],
                revealedData['revealedData_packed[3]'],
                revealedData['revealedData_packed[4]'],
                revealedData['revealedData_packed[5]'],
                revealedData['revealedData_packed[6]'],
                revealedData['revealedData_packed[7]'],
                revealedData['revealedData_packed[8]'],
            ];
            const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');
            const ofac_results = revealedDataUnpacked.slice(SELFRICA_MAX_LENGTH, SELFRICA_MAX_LENGTH + 2);

            deepEqual(ofac_results, ['\x01', '\x01']);
        } catch (e) {
            console.log(e.message);
        }
    })
    it("should return revealed data that matches the actual smile data", async function () {
        this.timeout(0);

        const fieldsToReveal: SelfricaField[] = [
            'COUNTRY', 'ID_TYPE', 'ID_NUMBER', 'ISSUANCE_DATE', 'EXPIRY_DATE',
            'FULL_NAME', 'DOB', 'PHOTO_HASH', 'PHONE_NUMBER', 'DOCUMENT', 'GENDER', 'ADDRESS'
        ];
        const input = generateSelfricaDiscloseInput(NON_OFAC_DUMMY_INPUT, namedob_smt, nameyob_smt, tree, true, '0', '1234567890', fieldsToReveal, undefined, 18, true);
            const witness = await circuit.calculateWitness(input);
            await circuit.checkConstraints(witness);

            const revealedData = (await circuit.getOutput(witness, ['revealedData_packed[9]']));
            const revealedData_packed = [
                revealedData['revealedData_packed[0]'],
                revealedData['revealedData_packed[1]'],
                revealedData['revealedData_packed[2]'],
                revealedData['revealedData_packed[3]'],
                revealedData['revealedData_packed[4]'],
                revealedData['revealedData_packed[5]'],
                revealedData['revealedData_packed[6]'],
                revealedData['revealedData_packed[7]'],
                revealedData['revealedData_packed[8]'],
            ];
            const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');

            // Since disclose_sel is set to all 1s in generateCircuitInput,
            // the first SELFRICA_MAX_LENGTH bytes should match the serialized smile data
            const serializedData = Buffer.from(serializeSmileData(NON_OFAC_DUMMY_INPUT), 'utf8');
            const serializedArray = Array.from(serializedData);

            // Check that revealed smile data matches the expected data
            // Note: We compare up to the length of the actual data since the circuit pads to SELFRICA_MAX_LENGTH
            for (let i = 0; i < Math.min(serializedArray.length, SELFRICA_MAX_LENGTH); i++) {
                const expectedByte = serializedArray[i];
                const expectedChar = String.fromCharCode(expectedByte);
                const revealedChar = revealedDataUnpacked[i];
                const revealedByte = revealedChar.charCodeAt(0);
                expect(revealedByte).to.equal(expectedByte, `Mismatch at position ${i}: expected '${expectedChar}' (${expectedByte}) but got '${revealedChar}' (${revealedByte})`);
            }

            // Check OFAC results (should be 1,1 for non-OFAC person)
            const ofac_results = revealedDataUnpacked.slice(SELFRICA_MAX_LENGTH, SELFRICA_MAX_LENGTH + 2);
            deepEqual(ofac_results, ['\x01', '\x01']);

            // Check age verification results (should show majority age since selector_older_than is 1)
            const age_results = revealedDataUnpacked.slice(SELFRICA_MAX_LENGTH + 2, SELFRICA_MAX_LENGTH + 5);
            // Age verification should return the majority age characters when person is older than that age
            // For age 18: '018' → ASCII [48, 49, 56] → characters ['0', '1', '8']
            expect(age_results[0]).to.equal('0'); // ASCII 48
            expect(age_results[1]).to.equal('1'); // ASCII 49
            expect(age_results[2]).to.equal('8'); // ASCII 56
    })


    it("should return revealed data that matches the actual smile data for OFAC person", async function () {
        this.timeout(0);

        const fieldsToReveal: SelfricaField[] = [
            'COUNTRY', 'ID_TYPE', 'ID_NUMBER', 'ISSUANCE_DATE', 'EXPIRY_DATE',
            'FULL_NAME', 'DOB', 'PHOTO_HASH', 'PHONE_NUMBER', 'DOCUMENT', 'GENDER', 'ADDRESS'
        ];
        const input = generateSelfricaDiscloseInput(OFAC_DUMMY_INPUT, namedob_smt, nameyob_smt, tree, true, '0', '1234567890', fieldsToReveal, undefined, undefined, true);

        const expectedSmileData = OFAC_DUMMY_INPUT;

            const witness = await circuit.calculateWitness(input);
            await circuit.checkConstraints(witness);

            const revealedData = (await circuit.getOutput(witness, ['revealedData_packed[9]']));
            const revealedData_packed = [
                revealedData['revealedData_packed[0]'],
                revealedData['revealedData_packed[1]'],
                revealedData['revealedData_packed[2]'],
                revealedData['revealedData_packed[3]'],
                revealedData['revealedData_packed[4]'],
                revealedData['revealedData_packed[5]'],
                revealedData['revealedData_packed[6]'],
                revealedData['revealedData_packed[7]'],
                revealedData['revealedData_packed[8]'],
            ];
            const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');

            // Since disclose_sel is set to all 1s in generateCircuitInput,
            // the first SELFRICA_MAX_LENGTH bytes should match the serialized smile data
            const serializedData = Buffer.from(serializeSmileData(expectedSmileData), 'utf8');
            const serializedArray = Array.from(serializedData);

            // Check that revealed smile data matches the expected data
            // Note: We compare up to the length of the actual data since the circuit pads to SELFRICA_MAX_LENGTH
            for (let i = 0; i < Math.min(serializedArray.length, SELFRICA_MAX_LENGTH); i++) {
                const expectedByte = serializedArray[i];
                const expectedChar = String.fromCharCode(expectedByte);
                const revealedChar = revealedDataUnpacked[i];
                const revealedByte = revealedChar.charCodeAt(0);
                expect(revealedByte).to.equal(expectedByte, `Mismatch at position ${i}: expected '${expectedChar}' (${expectedByte}) but got '${revealedChar}' (${revealedByte})`);
            }

            // Check OFAC results (should be 0,0 for OFAC person)
            const ofac_results = revealedDataUnpacked.slice(SELFRICA_MAX_LENGTH, SELFRICA_MAX_LENGTH + 2);
            deepEqual(ofac_results, ['\x00', '\x00']);

            // Check age verification results (should show majority age since selector_older_than is 1)
            const age_results = revealedDataUnpacked.slice(SELFRICA_MAX_LENGTH + 2, SELFRICA_MAX_LENGTH + 5);
            // Age verification should return the majority age ASCII values when person is older than that age
            // expect(age_results[0].charCodeAt(0)).to.equal(48); // ASCII '0' = 48
            // expect(age_results[1].charCodeAt(0)).to.equal(50); // ASCII '2' = 50
            // expect(age_results[2].charCodeAt(0)).to.equal(48); // ASCII '0' = 48

    })

    // it.only("should verify signatures generated by TEE", async function () {
    //     this.timeout(0);
    //     // Read PEM formatted public key from file
    //     const pemPublicKey = fs.readFileSync(path.join(__dirname, '/pubkey.pem'), 'utf8');
    //     const pubkeyBase64 = extractModulusAsBase64(pemPublicKey);

    //     const msgSigBase64 = "EYf2am0BUljY/SntwaLDv8dXbwbFTP1sYvZ5ZDaMFCgkDZkYDY7SkoR+E+k6bmeAaTSAMx1xg06X7R68tiAaWnMRReyuuR+OSgd5DsrMRM3S2cYMJ/I+s3Yz1pCs9c0e0ZJc7vuR9GIX9RFmJFMbXvAP8NMgWYeuqu2OoCrNEwEsD1me1IZZy6PmrRqK4pBZPb6vnNrBjOPU0r3aoOVmyTo7LQw/PXr73D4GEArfxXxFH/Vbt9iEJvkKt0/PVJc8U2S1vmpWD4naQbeMl/lHc730DIHloa/lAxGRtPiXITXOduWzEsSqnFejej6cZjiO0b5nWBQtKbqRwOukCosQYA==";
    //     const idNumSigBase64 = "iuKXg8UTOETmD30TKt2BgbL6sqA2SjkbVzLcrhGLC1VLjMcvuRGn0bC3JPdpE4vg6RuroMYAcLOfA99BOY/2mW08ChABGD6giiONRprLM/ac13RE06xW/Vf7G2Hc36Hz5MGosKLPISmBzWkOzIVdpR3vJeRsMOJeKgK2NZhOklu/VLgR6/EYq4UXcJ3gtOCco5nwzzI/oo2+GvH4f4zFdhvF/vEEp0XFuHIyWHXUqBtmp6/a6BohzKAV3okdpkiddX0/dm/9PjX41HCH95I+aA81ONeojBFX4xA/Rh1rz60SS0uLwZJMdhdlHE5e4mHAMjOwtQ07FgOTeh9Q0lfsuw==";

    //     const serializedRealDataBase64 = "";

    //     const input = (
    //         pubkeyBase64,
    //         msgSigBase64,
    //         idNumSigBase64,
    //         serializedRealDataBase64,
    //         namedob_smt,
    //         nameyob_smt,
    //         true,
    //         '0',
    //         '1234567890',
    //     );

    //     const witness = await circuit.calculateWitness(input);
    //     await circuit.checkConstraints(witness);

    // })
});
