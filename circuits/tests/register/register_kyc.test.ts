import { expect } from 'chai';
import { wasm as wasmTester } from 'circom_tester';
import path from 'path';
import { packBytesAndPoseidon } from '@selfxyz/common/utils/hash';
import { poseidon2 } from 'poseidon-lite';
import { generateMockKycRegisterInput } from '@selfxyz/common/utils/kyc/generateInputs.js';
import { KycRegisterInput } from '@selfxyz/common/utils/kyc/types';
import { KYC_ID_NUMBER_INDEX, KYC_ID_NUMBER_LENGTH } from '@selfxyz/common/utils/kyc/constants';

describe('REGISTER KYC Circuit Tests', () => {
  let circuit: any;
  let input: KycRegisterInput;

  before(async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(null, true, undefined);
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

  it('should generate the correct nullifier and commitment', async function () {
    this.timeout(0);

    let idnumber = input.data_padded.slice(KYC_ID_NUMBER_INDEX, KYC_ID_NUMBER_INDEX + KYC_ID_NUMBER_LENGTH);
    const nullifier = packBytesAndPoseidon(idnumber.map((x) => Number(x)));
    const commitment = poseidon2([input.secret, packBytesAndPoseidon(input.data_padded.map((x) => Number(x)))]);

    const w = await circuit.calculateWitness(input);
    await circuit.checkConstraints(w);
    const calnullifier = (await circuit.getOutput(w, ['nullifier'])).nullifier;
    const calcommitment = (await circuit.getOutput(w, ['commitment'])).commitment;
    expect(nullifier.toString()).to.be.equal(calnullifier);
    expect(commitment.toString()).to.be.equal(calcommitment);
  });

  it('should not verify if the signature is invalid', async function () {
    this.timeout(0);
    input.s = (BigInt(input.s) + BigInt(1)).toString();
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

  it('should fail if data is tampered', async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(null, true, undefined);
    input.data_padded[5] = (Number(input.data_padded[5]) + 1).toString();
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

  it('should fail if data is not bytes', async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(null, true, undefined);
    input.data_padded[5] = '8000';
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

  it('should fail if s is greater than subgroup order', async function () {
    this.timeout(0);
    input.s = "2736030358979909402780800718157159386076813972158567259200215660948447373041";
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

  it('should fail if s is 0', async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(null, true, undefined);
    input.s = '0';
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

  it('should fail if r_inv is greater than scalar field', async function () {
    this.timeout(0);
    input = generateMockKycRegisterInput(null, true, undefined);
    input.neg_r_inv = ["7454187305358665460", "12339561404529962506", "3965992003123030795", "435874783350371333"];

    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });
});
