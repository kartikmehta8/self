
import forge from "node-forge";

// Generate a new RSA key pair (rsa_sha256_65537_2048)
function generateRSAKeyPair() {
  const keypair = forge.pki.rsa.generateKeyPair(2048, 65537);

  return {
    publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
    privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
  };
}

function signRSA(message: Buffer, privateKey: string) {
  // Convert PEM private key to forge private key
  const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);

  // Create MD5 hash of the message (RSA-SHA256 equivalent)
  const md = forge.md.sha256.create();
  md.update(message.toString('binary'));

  // Sign with PKCS#1 v1.5 padding
  const signature = privateKeyObj.sign(md);

  return Buffer.from(signature, 'binary');
}

function verifyRSA(message: Buffer, signatureBuffer: Buffer, publicKey: string) {
  try {
    // Convert PEM public key to forge public key
    const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);

    // Create MD5 hash of the message
    const md = forge.md.sha256.create();
    md.update(message.toString('binary'));

    // Verify the signature
    const verified = publicKeyObj.verify(md.digest().bytes(), signatureBuffer.toString('binary'));
    return verified;
  } catch (error) {
    return false;
  }
}

export { generateRSAKeyPair, signRSA, verifyRSA};
