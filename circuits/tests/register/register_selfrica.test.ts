import { expect } from 'chai';
import { wasm as wasmTester } from 'circom_tester';
import path from 'path';
import { customHasher, packBytesAndPoseidon } from '@selfxyz/common/utils/hash';
import fs from 'fs';
import { generateSelfricaRegisterInput, OFAC_DUMMY_INPUT } from '@selfxyz/common/utils/selfrica/generateInputs.js';

describe('REGISTER SELFRICA Circuit Tests', () => {
  let circuit: any;

  before(async function () {
    this.timeout(0);
    circuit = await wasmTester(
      path.join(__dirname, '../../circuits/register/register_selfrica.circom'),
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
    const input = generateSelfricaRegisterInput(true);
    const w = await circuit.calculateWitness(input);
    await circuit.checkConstraints(w);
  });

  it('should not verify if the signature is invalid', async function () {
    this.timeout(0);
    const input = generateSelfricaRegisterInput(true);
    input.s = (BigInt(input.s) + BigInt(1)).toString();
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

  it('should generate the correct nullifier and commitment', async function () {
    this.timeout(0);
    const input = generateSelfricaRegisterInput(true);
    const nullifier = packBytesAndPoseidon(OFAC_DUMMY_INPUT.idNumber.split('').map((x) => x.charCodeAt(0)));
    const commitment = packBytesAndPoseidon(input.SmileID_data_padded.map((x) => Number(x)));
    const w = await circuit.calculateWitness(input);
    await circuit.checkConstraints(w);
    const calnullifier = (await circuit.getOutput(w, ['nullifier'])).nullifier;
    const calcommitment = (await circuit.getOutput(w, ['commitment'])).commitment;
    expect(nullifier).to.be.equal(calnullifier);
    expect(commitment).to.be.equal(calcommitment);
  });

  it('should fail if smiledata is tampered', async function () {
    this.timeout(0);
    const input = generateSelfricaRegisterInput(true);
    input.SmileID_data_padded[5] = (Number(input.SmileID_data_padded[5]) + 1).toString();
    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });


  it('should fail if smiledata is not bytes', async function () {
    this.timeout(0);
    const input = generateSelfricaRegisterInput(true);
    input.SmileID_data_padded[5] = '8000';
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
    const input = generateSelfricaRegisterInput(true);
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
    const input = generateSelfricaRegisterInput(true);
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
    const input = generateSelfricaRegisterInput(true);
    input.r_inv = ["7454187305358665460", "12339561404529962506", "3965992003123030795", "435874783350371333"];

    try {
      const w = await circuit.calculateWitness(input);
      await circuit.checkConstraints(w);
      expect.fail('Expected an error but none was thrown.');
    } catch (error) {
      expect(error.message).to.include('Assert Failed');
    }
  });

});
