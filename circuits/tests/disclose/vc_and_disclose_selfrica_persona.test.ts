import { wasm as wasmTester } from 'circom_tester';
import * as path from 'path';
import { NON_OFAC_DUMMY_INPUT, OFAC_DUMMY_INPUT, NON_OFAC_PERSONA_DUMMY_INPUT, OFAC_PERSONA_DUMMY_INPUT, SELFRICA_MAX_LENGTH, serializeSmileData } from '@selfxyz/common';
import { SMT } from '@openpassport/zk-kit-smt';
import { poseidon2 } from 'poseidon-lite';
import fs from 'fs';
import { unpackReveal } from '@selfxyz/common/utils/circuits/formatOutputs.js';
import { deepEqual } from 'assert';
import { expect } from 'chai';
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { generateSelfricaDiscloseInput, serializePersonaData, validateAndPadPersonaData } from '@selfxyz/common/utils/selfrica_persona/generateInputs';
import { SelfricaField } from '@selfxyz/common/utils/selfrica_persona/constants';
import { PERSONA_MAX_LENGTH } from '@selfxyz/common/utils/selfrica_persona/persona_constants';

const __dirname = path.dirname(__filename);

// Helper function to compute chunk length (matches computeIntChunkLength in circuit)
const computeChunkLength = (dataLength: number): number => {
  return Math.ceil(dataLength / 31);
};

const testConfigs = [
  {
    name: 'SELFRICA',
    circuitPath: '../../circuits/disclose/selfrica_persona/vc_and_disclose_selfrica.circom',
    isSelfrica: true,
    dummyInputNonOfac: NON_OFAC_DUMMY_INPUT,
    dummyInputOfac: OFAC_DUMMY_INPUT,
    maxLength: SELFRICA_MAX_LENGTH,
    chunkLength: computeChunkLength(SELFRICA_MAX_LENGTH + 2 + 1),
    serializeData: serializeSmileData,
    nameAndDobPath: '../consts/ofac/nameAndDobSelfricaSMT.json',
    nameAndYobPath: '../consts/ofac/nameAndYobSelfricaSMT.json',
  },
  {
    name: 'PERSONA',
    circuitPath: '../../circuits/disclose/selfrica_persona/vc_and_disclose_persona.circom',
    isSelfrica: false,
    dummyInputNonOfac: NON_OFAC_PERSONA_DUMMY_INPUT,
    dummyInputOfac: OFAC_PERSONA_DUMMY_INPUT,
    maxLength: PERSONA_MAX_LENGTH,
    chunkLength: computeChunkLength(PERSONA_MAX_LENGTH + 2 + 1),
    serializeData: (data: any) => serializePersonaData(validateAndPadPersonaData(data)),
    nameAndDobPath: '../consts/ofac/nameAndDobPersonaSMT.json',
    nameAndYobPath: '../consts/ofac/nameAndYobPersonaSMT.json',
  },
];

testConfigs.forEach(({ name, circuitPath, isSelfrica, dummyInputNonOfac, dummyInputOfac, maxLength, chunkLength, serializeData, nameAndDobPath, nameAndYobPath }) => {
  describe(`VC_AND_DISCLOSE ${name} Circuit Tests`, () => {
    let circuit: any;
    let namedob_smt: SMT;
    let nameyob_smt: SMT;
    let tree: LeanIMT;

    // Helper function to extract revealed data packed array
    const getRevealedDataPacked = async (witness: any): Promise<string[]> => {
      // circuit.getOutput with the array length returns all elements 0 to length-1
      const revealedData = await circuit.getOutput(witness, [`revealedData_packed[${chunkLength}]`]);
      return Array.from({ length: chunkLength }, (_, i) => revealedData[`revealedData_packed[${i}]`].toString());
    };

    before(async function () {
      this.timeout(0);

      // Load provider-specific OFAC trees
      const nameAndDobjson = JSON.parse(
        fs.readFileSync(path.join(__dirname, nameAndDobPath), 'utf8')
      );
      const nameAndYobjson = JSON.parse(
        fs.readFileSync(path.join(__dirname, nameAndYobPath), 'utf8')
      );

      namedob_smt = new SMT(poseidon2, true);
      nameyob_smt = new SMT(poseidon2, true);
      namedob_smt.import(nameAndDobjson);
      nameyob_smt.import(nameAndYobjson);
      tree = new LeanIMT((a, b) => poseidon2([a, b]), []);

      circuit = await wasmTester(
        path.join(__dirname, circuitPath),
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

    it('should verify for correct Circuit Input and output', async function () {
      this.timeout(0);
      const input = generateSelfricaDiscloseInput(false, namedob_smt, nameyob_smt, tree as any, false, '0', '1234567890', undefined, undefined, undefined, true, '1234', isSelfrica);
      const witness = await circuit.calculateWitness(input);
      await circuit.checkConstraints(witness);
    });

    it('should fail for invalid msg ascii', async function () {
      this.timeout(0);
      const input = generateSelfricaDiscloseInput(false, namedob_smt, nameyob_smt, tree as any, false, '0', '1234567890', undefined, undefined, undefined, true, '1234', isSelfrica);

      input.data_padded[4] = "9999999";
      try {
        const witness = await circuit.calculateWitness(input);
        await circuit.checkConstraints(witness);
        throw new Error("Circuit verified for invalid msg byte ascii");
      } catch (e) {
        const errMsg = e?.message || e?.toString?.() || "";
        if (!errMsg.includes("Num2Bits")) {
          throw new Error(`Expected error message to include "Num2Bits", but got:\n${errMsg}`);
        }
      }
    });

    it("should return 0 for an OFAC person", async function () {
      this.timeout(0);
      const input = generateSelfricaDiscloseInput(true, namedob_smt, nameyob_smt, tree as any, true, '0', '1234567890', undefined, undefined, undefined, true, '1234', isSelfrica);
      const witness = await circuit.calculateWitness(input);
      await circuit.checkConstraints(witness);

      const revealedData_packed = await getRevealedDataPacked(witness);
      const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');
      const ofac_results = revealedDataUnpacked.slice(maxLength, maxLength + 2);

      deepEqual(ofac_results, ['\x00', '\x00']);
    });

    it("should return 1 for a non OFAC person", async function () {
      this.timeout(0);
      const input = generateSelfricaDiscloseInput(false, namedob_smt, nameyob_smt, tree as any, true, '0', '1234567890', undefined, undefined, undefined, true, '1234', isSelfrica);
      const witness = await circuit.calculateWitness(input);
      await circuit.checkConstraints(witness);

      const revealedData_packed = await getRevealedDataPacked(witness);
      const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');
      const ofac_results = revealedDataUnpacked.slice(maxLength, maxLength + 2);

      deepEqual(ofac_results, ['\x01', '\x01']);
    });

    it("should return revealed data that matches the actual data", async function () {
      this.timeout(0);

      const fieldsToReveal: SelfricaField[] = [
        'COUNTRY', 'ID_TYPE', 'ID_NUMBER', 'ISSUANCE_DATE', 'EXPIRY_DATE',
        'FULL_NAME', 'DOB', 'PHOTO_HASH', 'PHONE_NUMBER', 'DOCUMENT', 'GENDER', 'ADDRESS'
      ];
      const input = generateSelfricaDiscloseInput(false, namedob_smt, nameyob_smt, tree as any, true, '0', '1234567890', fieldsToReveal, undefined, 18, true, '1234', isSelfrica);
      const witness = await circuit.calculateWitness(input);
      await circuit.checkConstraints(witness);

      const revealedData_packed = await getRevealedDataPacked(witness);
      const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');

      const serializedData = Buffer.from(serializeData(dummyInputNonOfac as any), 'utf8');
      const serializedArray = Array.from(serializedData);

      for (let i = 0; i < Math.min(serializedArray.length, maxLength); i++) {
        const expectedByte = serializedArray[i];
        const expectedChar = String.fromCharCode(expectedByte);
        const revealedChar = revealedDataUnpacked[i];
        const revealedByte = revealedChar.charCodeAt(0);
        expect(revealedByte).to.equal(expectedByte, `Mismatch at position ${i}: expected '${expectedChar}' (${expectedByte}) but got '${revealedChar}' (${revealedByte})`);
      }

      const ofac_results = revealedDataUnpacked.slice(maxLength, maxLength + 2);
      deepEqual(ofac_results, ['\x01', '\x01']);

      const age_result_byte = revealedDataUnpacked[maxLength + 2].charCodeAt(0);
      expect(age_result_byte).to.equal(18);
    });

    it("should return revealed data that matches the actual data for OFAC person", async function () {
      this.timeout(0);

      const fieldsToReveal: SelfricaField[] = [
        'COUNTRY', 'ID_TYPE', 'ID_NUMBER', 'ISSUANCE_DATE', 'EXPIRY_DATE',
        'FULL_NAME', 'DOB', 'PHOTO_HASH', 'PHONE_NUMBER', 'DOCUMENT', 'GENDER', 'ADDRESS'
      ];
      const input = generateSelfricaDiscloseInput(true, namedob_smt, nameyob_smt, tree as any, true, '0', '1234567890', fieldsToReveal, undefined, undefined, true, '1234', isSelfrica);

      const witness = await circuit.calculateWitness(input);
      await circuit.checkConstraints(witness);

      const revealedData_packed = await getRevealedDataPacked(witness);
      const revealedDataUnpacked = unpackReveal(revealedData_packed, 'id');

      const serializedData = Buffer.from(serializeData(dummyInputOfac as any), 'utf8');
      const serializedArray = Array.from(serializedData);

      for (let i = 0; i < Math.min(serializedArray.length, maxLength); i++) {
        const expectedByte = serializedArray[i];
        const expectedChar = String.fromCharCode(expectedByte);
        const revealedChar = revealedDataUnpacked[i];
        const revealedByte = revealedChar.charCodeAt(0);
        expect(revealedByte).to.equal(expectedByte, `Mismatch at position ${i}: expected '${expectedChar}' (${expectedByte}) but got '${revealedChar}' (${revealedByte})`);
      }

      const ofac_results = revealedDataUnpacked.slice(maxLength, maxLength + 2);
      deepEqual(ofac_results, ['\x00', '\x00']);

      const age_result_byte = revealedDataUnpacked[maxLength + 2].charCodeAt(0);
      expect(age_result_byte).to.equal(0);
    });
  });
});
