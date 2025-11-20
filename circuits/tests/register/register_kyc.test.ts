import { expect } from 'chai';
import { wasm as wasmTester } from 'circom_tester';
import path from 'path';
import { packBytesAndPoseidon } from '@selfxyz/common/utils/hash';
import { poseidon2 , poseidon1} from 'poseidon-lite';
import { generateMockKycRegisterInput } from '@selfxyz/common/utils/kyc/generateInputs.js';
import { KycRegisterInput } from '@selfxyz/common/utils/kyc/types';
import { KYC_ID_NUMBER_INDEX, KYC_ID_NUMBER_LENGTH } from '@selfxyz/common/utils/kyc/constants';

describe('REGISTER KYC Circuit Tests', () => {
  let circuit: any;
  let input: KycRegisterInput;

  before(async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(true);
    circuit = await wasmTester(
      path.join(__dirname, '../../circuits/register/register_kyc.circom'),
      {
        verbose: true,
        logOutput: true,
        include: ['node_modules'],
      }
    );
  });

  it('should compile and load the circuit', async function () {
    this.timeout(0);
    expect(circuit).to.not.be.undefined;
  });

  it('should generate the correct input', async function () {
    this.timeout(0);
    const w = await circuit.calculateWitness(input);
    await circuit.checkConstraints(w);
  });
  it('should generate the correct tee_secret_hash', async function () {
    this.timeout(0);
    const w = await circuit.calculateWitness(input);
    const tee_secret_hash = poseidon1(["1234"]);
    await circuit.checkConstraints(w);
    const caltee_secret_hash = (await circuit.getOutput(w, ['tee_secret_hash'])).tee_secret_hash;
    expect(tee_secret_hash.toString()).to.be.equal(caltee_secret_hash);
  });
  it('should generate the correct nullifier and commitment', async function () {
    this.timeout(0);

    let idnumber = input.data_padded.slice(KYC_ID_NUMBER_INDEX, KYC_ID_NUMBER_INDEX + KYC_ID_NUMBER_LENGTH);
    const nullifier = packBytesAndPoseidon(idnumber.map((x) => Number(x)));
    const commitment = poseidon2([input.user_secret, packBytesAndPoseidon(input.data_padded.map((x) => Number(x)))]);

    const w = await circuit.calculateWitness(input);
    await circuit.checkConstraints(w);
    const calnullifier = (await circuit.getOutput(w, ['nullifier'])).nullifier;
    const calcommitment = (await circuit.getOutput(w, ['commitment'])).commitment;
    expect(nullifier.toString()).to.be.equal(calnullifier);
    expect(commitment.toString()).to.be.equal(calcommitment);
  });
  it('should fail if data is not bytes', async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(true);
    input.data_padded[5] = '8000';
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });
});
