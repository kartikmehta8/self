import { expect } from 'chai';
import { wasm as wasmTester } from 'circom_tester';
import path from 'path';
import { customHasher } from '@selfxyz/common/utils/hash';
import fs from 'fs';
import { generateSelfricaRegisterInput } from '@selfxyz/common/utils/selfrica/generateInputs.js';

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
});
