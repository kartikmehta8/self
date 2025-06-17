import { expect } from 'chai';
import { wasm as wasm_tester } from 'circom_tester';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fullSigAlgs } from '../../register/test_cases.js';
import { PassportData, SignatureAlgorithm } from '@selfxyz/common/utils/types';
import { hash } from '@selfxyz/common/utils/hash';
import {
  COMMITMENT_TREE_DEPTH,
  formatMrz,
  genAndInitMockPassportData,
  getLeafDscTree,
  MAX_PADDED_ECONTENT_LEN,
  PASSPORT_ATTESTATION_ID,
} from '@selfxyz/common';
import { poseidon2 } from 'poseidon-lite';
import { findIndexInTree, formatInput } from '@selfxyz/common/utils/circuits/generateInputs';
import {
  generateCommitment,
  getPassportSignatureInfos,
  pad,
} from '@selfxyz/common/utils/passports/passport';
import { LeanIMT } from '@openpassport/zk-kit-lean-imt';
import { generateMerkleProof } from '@selfxyz/common/utils/trees';
import { getDg2HashCircuitPath } from './test_cases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Keep only one entry per unique (dgHashAlgo, eContentHashAlgo) pair
const testSuite = (() => {
  const seen = new Set<string>();
  return fullSigAlgs.filter(({ dgHashAlgo, eContentHashAlgo }) => {
    const key = `${dgHashAlgo}_${eContentHashAlgo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();

/**
 * Prepares all the inputs required by the DG2-hash-reveal circuit.
 *
 * Workflow:
 * 1. Locate the byte range that stores the original DG2 hash in the concatenated
 *    eContent (using `extractHashFromConcatenated`).
 * 2. Generate random photo bytes with the exact same length and compute their
 *    hash (`dg2Hash`).
 * 3. Replace the original DG2 hash inside `passportData.eContent` with the newly
 *    computed one so that the circuit has something to verify against.
 * 4. Pad the (potentially updated) eContent to the maximum length supported by
 *    the chosen signature algorithm and hash function.
 * 5. Generate a Poseidon commitment to the passport data and a corresponding
 *    LeanIMT Merkle proof so the circuit can prove membership in a tree.
 * 6. Marshal all numeric arrays to field-friendly formats expected by circom-tester.
 *
 * The helper returns both the formatted `input` object for the circuit and the
 * raw `dg2Hash` so the mocha tests can assert correctness of the circuit output.
 */
function generateCircuitInputDg2Hash(
  passportData: PassportData,
  dgHashAlgo: string,
  secret: string,
  attestation_id: string
) {
  const {
    hashBytes: _,
    hashStart,
    hashEnd,
  } = extractHashFromConcatenated(passportData.eContent, 2, 63);

  const photoBytes = Array.from(
    { length: hashEnd - hashStart },
    () => Math.floor(Math.random() * 95) + 32
  );

  const dg2Hash = hash(dgHashAlgo, photoBytes) as number[];
  //replace the content of econtent from passportData from index hashStart to hashEnd with dg2Hash
  passportData.eContent.splice(hashStart, hashEnd - hashStart, ...dg2Hash);

  const { signatureAlgorithmFullName } = getPassportSignatureInfos(passportData);
  if (passportData.eContent.length > MAX_PADDED_ECONTENT_LEN[signatureAlgorithmFullName]) {
    console.error(
      `eContent too long (${passportData.eContent.length} bytes). Max length is ${MAX_PADDED_ECONTENT_LEN[signatureAlgorithmFullName]} bytes.`
    );
    throw new Error(
      `This length of datagroups (${passportData.eContent.length} bytes) is currently unsupported. Please contact us so we add support!`
    );
  }

  const [eContentPadded, eContentLen] = pad(passportData.passportMetadata.eContentHashFunction)(
    passportData.eContent,
    MAX_PADDED_ECONTENT_LEN[passportData.passportMetadata.dg1HashFunction]
  );

  const commitment = generateCommitment(secret, attestation_id, passportData);
  const merkletree: any = new LeanIMT((a, b) => poseidon2([a, b]), []);
  merkletree.insert(BigInt(commitment));
  const index = findIndexInTree(merkletree, BigInt(commitment));

  const { siblings, path, leaf_depth } = generateMerkleProof(
    merkletree,
    index,
    COMMITMENT_TREE_DEPTH
  );
  //TODO: Does this changes if econtent of passportData is changed? and what ll other inputs are needed to be changed?
  const dsc_tree_leaf = getLeafDscTree(passportData.dsc_parsed, passportData.csca_parsed);
  const formattedMrz = formatMrz(passportData.mrz);

  const input = {
    photo: formatInput(photoBytes),
    eContent: formatInput(eContentPadded),
    eContent_padded_length: formatInput(eContentLen),
    dg2_hash_offset: formatInput(hashStart)[0],
    merkle_root: formatInput(merkletree.root),
    leaf_depth: formatInput(leaf_depth),
    path: formatInput(path),
    siblings: formatInput(siblings),
    dsc_tree_leaf: formatInput(dsc_tree_leaf),
    dg1: formatInput(formattedMrz),
    attestation_id: formatInput(attestation_id),
    secret: formatInput(secret)[0],
  };
  return { input, dg2Hash };
}

testSuite.forEach(
  ({
    dgHashAlgo,
    eContentHashAlgo,
    sigAlg,
    hashFunction,
    domainParameter,
    keyLength,
    saltLength,
  }) => {
    describe(`DG2 Hash Reveal - ${dgHashAlgo.toUpperCase()} ${eContentHashAlgo.toUpperCase()} `, function () {
      this.timeout(0);
      let circuit: any;

      const passportData = genAndInitMockPassportData(
        dgHashAlgo,
        eContentHashAlgo,
        `${sigAlg}_${hashFunction}_${domainParameter}_${keyLength}${saltLength ? `_${saltLength}` : ''}` as SignatureAlgorithm,
        'FRA',
        '000101',
        '300101'
      );


      const { input, dg2Hash } = generateCircuitInputDg2Hash(
        passportData,
        dgHashAlgo,
        '42',
        PASSPORT_ATTESTATION_ID
      );

      before(async () => {
        circuit = await wasm_tester(
          getDg2HashCircuitPath(dgHashAlgo, eContentHashAlgo, __dirname),
          {
            include: [
              '../node_modules',
              '../node_modules/@zk-kit/binary-merkle-root.circom/src',
              '../node_modules/circomlib/circuits',
            ],
          }
        );
      });

      it('should compile and load the circuit', async function () {
        expect(circuit).to.not.be.undefined;
      });
      it('should calculate the witness with correct inputs', async function () {
        const w = await circuit.calculateWitness(input);
        await circuit.checkConstraints(w);
      });

      it('should pass if dg2Hash is same', async function () {
        const expt_dg2Hash = dg2Hash.map((byte) => byte & 0xff);
        const w = await circuit.calculateWitness(input);
        await circuit.checkConstraints(w);
        const out = await circuit.getOutput(w, [`dg2ShaBytes[${expt_dg2Hash.length}]`]);
        for (let i = 0; i < expt_dg2Hash.length; i++) {
          expect(BigInt(out[`dg2ShaBytes[${i}]`])).to.equal(BigInt(expt_dg2Hash[i]));
        }
      });

      it('should fail if commitment is not calculated correctly', async function () {
        input.secret = '43';
        try {
          const w = await circuit.calculateWitness(input);
          await circuit.checkConstraints(w);
          expect.fail('Expected circuit verification to fail, but it succeeded');
        } catch (error) {
          expect(error.message).to.include('Error');
        }
      });

      it('should fail if photo is tampered', async function () {
        input.photo[4] = (Math.floor(Math.random() * 95) + 32).toString();
        try {
          const w = await circuit.calculateWitness(input);
          await circuit.checkConstraints(w);
          expect.fail('Expected circuit verification to fail due to tampered photo, but it succeeded');
        } catch (error) {
          expect(error.message).to.include('Error');
        }
      });
      it('should fail if dg2_hash_offset > eContent_padded_length', async function () {
        input.dg2_hash_offset = '1000';
        try {
          const w = await circuit.calculateWitness(input);
          await circuit.checkConstraints(w);
          expect.fail('Expected circuit verification to fail, but it succeeded');
        } catch (error) {
          expect(error.message).to.include('Error');
        }
      });
    });
  }
);

/**
 * Scans the concatenated hash list inside the passport eContent and extracts the
 * hash (and its indices) for a given data group.
 *
 * The eContent layout follows the pattern:
 *   DG1_HASH | PADDING(7 bytes) | DG2_HASH | PADDING | DG3_HASH | ...
 * hence we can iterate through padding blocks to isolate hashes.

 */
function extractHashFromConcatenated(
  concatenatedData: number[],
  dataGroupNumber: number,
  dg1HashOffset: number
): { hashBytes: number[]; hashStart: number; hashEnd: number } {
  const PADDING_LENGTH = 7;

  // Helper to check if a 7-byte zero padding starts at given position
  const isPaddingAt = (index: number): boolean => {
    if (index + PADDING_LENGTH > concatenatedData.length) return false;
    return concatenatedData.slice(index, index + PADDING_LENGTH).every((b) => b === 0);
  };

  if (dataGroupNumber < 1) {
    throw new Error(`dataGroupNumber should be >= 1, received ${dataGroupNumber}`);
  }

  let currentDataGroup = 0;
  let pos = dg1HashOffset;

  if (!isPaddingAt(pos)) {
    throw new Error('First padding not found at expected dg1HashOffset');
  }

  while (pos < concatenatedData.length) {
    pos += PADDING_LENGTH;
    currentDataGroup++;

    const hashStart = pos;
    let hashEnd = pos;

    // Scan until we hit the next padding or end of array
    while (hashEnd < concatenatedData.length && !isPaddingAt(hashEnd)) {
      hashEnd++;
    }

    if (currentDataGroup === dataGroupNumber) {
      //also return hashstart and hashend
      return {
        hashBytes: concatenatedData.slice(hashStart, hashEnd),
        hashStart,
        hashEnd,
      };
    }

    // Continue searching from the next padding (hashEnd)
    pos = hashEnd;
  }

  throw new Error(`Data group ${dataGroupNumber} not found in concatenated data`);
}
