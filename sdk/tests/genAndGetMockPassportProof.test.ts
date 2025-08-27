import { expect } from 'chai';
import { describe, it } from 'mocha';

import { genAndGetMockPassportProof } from './utils/genAndGetMockPassportProof.js';
import type { PassportData } from '@selfxyz/common';

describe('genAndGetMockPassportProof', function () {
  this.timeout(0);

  it('should generate valid mock passport data', async () => {
    const passportData = await genAndGetMockPassportProof('sha1', 'rsa', '65537', 2048);

    // Check that passport data is returned
    expect(passportData).to.not.be.null;
    expect(passportData).to.not.be.undefined;

    // Check passport data structure
    expect(passportData).to.have.property('dsc');
    expect(passportData).to.have.property('mrz');
    expect(passportData).to.have.property('dg2Hash');
    expect(passportData).to.have.property('eContent');
    expect(passportData).to.have.property('signedAttr');
    expect(passportData).to.have.property('encryptedDigest');
    expect(passportData).to.have.property('documentType');
    expect(passportData).to.have.property('documentCategory');
    expect(passportData).to.have.property('mock');

    // Check that it's marked as a mock
    expect(passportData.mock).to.be.true;
    expect(passportData.documentType).to.equal('mock_passport');
    expect(passportData.documentCategory).to.equal('passport');

    // Check MRZ is properly formatted (should be 88 characters)
    expect(passportData.mrz).to.have.lengthOf(88);
    expect(passportData.mrz).to.be.a('string');

    // Check that arrays are properly formatted
    expect(passportData.dg2Hash).to.be.an('array');
    expect(passportData.eContent).to.be.an('array');
    expect(passportData.signedAttr).to.be.an('array');
    expect(passportData.encryptedDigest).to.be.an('array');

    // Check DSC is a string
    expect(passportData.dsc).to.be.a('string');
    expect(passportData.dsc).to.have.length.greaterThan(0);
    expect(passportData.mrz).to.include('FRA');

    // Note: Since we're using genMockPassportData (not genAndInitMockPassportData),
    // the passportMetadata property won't exist. Remove or comment out these checks
    // if your function doesn't call initPassportDataParsing
    // expect(passportData.passportMetadata).to.have.property('dg1HashFunction');
    // expect(passportData.passportMetadata).to.have.property('eContentHashFunction');
    // expect(passportData.passportMetadata).to.have.property('signatureAlgorithm');

    const birthDateInMrz = passportData.mrz.substring(57, 63);
    expect(birthDateInMrz).to.equal('000101'); // Matches your function's birthDate
    const expiryDateInMrz = passportData.mrz.substring(65, 71);
    expect(expiryDateInMrz).to.equal('300101'); // Matches your function's expiryDate

  });

});