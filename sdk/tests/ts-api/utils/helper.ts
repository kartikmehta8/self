import { v4 } from "uuid";
// @ts-ignore
import WebSocket from "ws";
import elliptic from "elliptic";
import crypto from "crypto";
import cbor from "cbor";
import { aws_root_cert_pem } from "./assests/aws_root_pem.js";
import { Certificate } from "@fidm/x509";
import cose from "cose-js";
// @ts-ignore
import asn1 from "asn1.js";
import { io } from "socket.io-client";
import { WSS_URL } from "./constant.js";
import { PassportData } from "@selfxyz/common/types/passport";
import { LeanIMT } from "@openpassport/zk-kit-lean-imt";
import { SMT } from "@openpassport/zk-kit-smt";
import { CircuitSignals, groth16, Groth16Proof, PublicSignals } from "snarkjs";
import { generateCircuitInputsVCandDisclose } from "@selfxyz/common/utils/circuits/generateInputs";

const { ec: EC } = elliptic;
const ec = new EC("p256");

const key1 = ec.genKeyPair();


export async function generateVcAndDiscloseRawProof(
  secret: string,
  attestationId: string,
  passportData: PassportData,
  scope: string,
  selectorDg1: string[] = new Array(93).fill("1"),
  selectorOlderThan: string | number = "1",
  merkletree: LeanIMT<bigint>,
  majority: string = "20",
  passportNo_smt: SMT,
  nameAndDob_smt: SMT,
  nameAndYob_smt: SMT,
  selectorOfac: string | number = "1",
  forbiddenCountriesList: string[] = ["AAA"],
  userIdentifier: string = "0000000000000000000000000000000000000000",
): Promise<{
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}> {

  const vcAndDiscloseCircuitInputs: CircuitSignals = generateCircuitInputsVCandDisclose(
    secret,
    attestationId,
    passportData,
    scope,
    selectorDg1,
    selectorOlderThan,
    merkletree,
    majority,
    passportNo_smt,
    nameAndDob_smt,
    nameAndYob_smt,
    selectorOfac,
    forbiddenCountriesList,
    userIdentifier,
  );

  const vcAndDiscloseProof = await groth16.fullProve(
    vcAndDiscloseCircuitInputs,
    "./assests/vc_and_disclose.wasm",
    "./assests/vc_and_disclose.zkey",
  );

  // Verify the proof
  // const vKey = JSON.parse(fs.readFileSync(vcAndDiscloseCircuits["vc_and_disclose"].vkey, "utf8"));
  // const isValid = await groth16.verify(vKey, vcAndDiscloseProof.publicSignals, vcAndDiscloseProof.proof);
  // if (!isValid) {
  //   throw new Error("Generated VC and Disclose proof verification failed");
  // }

  return vcAndDiscloseProof;
}


function encryptAES256GCM(plaintext: string, key: Buffer<ArrayBuffer>) {
  const iv = crypto.randomBytes(12); // GCM standard uses a 12-byte IV

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    nonce: Array.from(Buffer.from(iv.toString("hex"), "hex")),
    cipher_text: Array.from(Buffer.from(encrypted, "hex")),
    auth_tag: Array.from(Buffer.from(authTag.toString("hex"), "hex")),
  };
}

export const handshakeAndGetUuid = async (
  wsUrl: string,
  inputs: any,
  proofType: "register" | "dsc" | "disclose",
  circuitName: string
): Promise<string> => {
  const pubkey =
    key1.getPublic().getX().toString("hex").padStart(64, "0") +
    key1.getPublic().getY().toString("hex").padStart(64, "0");

  const helloBody = {
    jsonrpc: "2.0",
    method: "openpassport_hello",
    id: 1,
    params: {
      user_pubkey: [4, ...Array.from(Buffer.from(pubkey, "hex"))],
      uuid: v4(),
    },
  };

  const ws = new WebSocket(wsUrl);

  ws.on("open", async () => {
    ws.send(JSON.stringify(helloBody));
  });

  return new Promise((resolve, reject) => {
    ws.on("message", async (data: any) => {
      let textDecoder = new TextDecoder();
      //@ts-ignore
      let result = JSON.parse(textDecoder.decode(Buffer.from(data)));
      if (result.result.attestation !== undefined) {
        const { userData, pubkey } = await verifyAttestation(
          result.result.attestation
        );
        //check if key1 is the same as userData
        const serverPubkey = pubkey!;
        const key2 = ec.keyFromPublic(serverPubkey, "hex");
        const sharedKey = key1.derive(key2.getPublic());

        const endpoint = {
          endpointType: "staging_celo",
          endpoint: "0x3Dd6fc52d2bA4221E02ae3A0707377B56FEA845a",
        };
        const encryptionData = encryptAES256GCM(
          JSON.stringify({
            type: proofType,
            onchain: true,
            ...endpoint,
            circuit: {
              name: circuitName,
              inputs: JSON.stringify(inputs),
            },
          }),
          Buffer.from(sharedKey.toString("hex").padStart(64, "0"), "hex")
        );
        const submitBody = {
          jsonrpc: "2.0",
          method: "openpassport_submit_request",
          id: 1,
          params: {
            uuid: result.result.uuid,
            ...encryptionData,
          },
        };
        ws.send(JSON.stringify(submitBody));
      } else {
        ws.close();

        resolve(result.result);
      }
    });
  });
};

const requiredFields = [
  "module_id",
  "digest",
  "timestamp",
  "pcrs",
  "certificate",
  "cabundle",
];

const ECPublicKeyASN = asn1.define("ECPublicKey", function () {
  // @ts-ignore
  this.seq().obj(
    // @ts-ignore
    this.key("algo")
      .seq()
      // @ts-ignore
      .obj(this.key("id").objid(), this.key("curve").objid()),
    // @ts-ignore
    this.key("pubKey").bitstr()
  );
});

const numberInRange = (start: number, end: number, value: number) => {
  return value > start && value <= end;
};

function derToPem(der: Buffer): string {
  const base64 =
    der
      .toString("base64")
      .match(/.{1,64}/g)
      ?.join("\n") ?? "";
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
}

const verifyCertChain = (rootPem: string, certChainStr: string[]): boolean => {
  const rootCert = Certificate.fromPEM(Buffer.from(rootPem));
  const certChainPartial = certChainStr.map((c) =>
    Certificate.fromPEM(Buffer.from(c))
  );
  const certChain = [rootCert, ...certChainPartial];

  for (let i = 1; i < certChain.length - 1; i++) {
    const isValid = certChain[i - 1].publicKey.verify(
      certChain[i].tbsCertificate.toDER(),
      certChain[i].signature,
      "sha384"
    );
    if (!isValid) {
      console.error(
        `Certificate at index ${i} is not properly signed by the next certificate.`
      );
      return false;
    }
  }
  return true;
};

export const verifyAttestation = async (attestation: Array<number>) => {
  const coseSign1 = await cbor.decodeFirst(Buffer.from(attestation));

  if (!Array.isArray(coseSign1) || coseSign1.length !== 4) {
    throw new Error("Invalid COSE_Sign1 format");
  }

  const [protectedHeader, unprotectedHeader, payload, signature] = coseSign1;

  const attestationDoc = (await cbor.decodeFirst(payload)) as AttestationDoc;

  for (const field of requiredFields) {
    //@ts-ignore
    if (!attestationDoc[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!(attestationDoc.module_id.length > 0)) {
    throw new Error("Invalid module_id");
  }
  if (!(attestationDoc.digest === "SHA384")) {
    throw new Error("Invalid digest");
  }

  if (!(attestationDoc.timestamp > 0)) {
    throw new Error("Invalid timestamp");
  }

  //for each key, value in pcts
  for (const [key, value] of attestationDoc.pcrs) {
    if (key < 0 || key >= 32) {
      throw new Error("Invalid pcr index");
    }

    if (![32, 48, 64].includes(value.length)) {
      throw new Error("Invalid pcr value length at: " + key);
    }
  }

  if (!(attestationDoc.cabundle.length > 0)) {
    throw new Error("Invalid cabundle");
  }

  for (let i = 0; i < attestationDoc.cabundle.length; i++) {
    if (!numberInRange(0, 1024, attestationDoc.cabundle[i].length)) {
      throw new Error("Invalid cabundle");
    }
  }

  if (attestationDoc.public_key) {
    if (!numberInRange(0, 1024, attestationDoc.public_key.length)) {
      throw new Error("Invalid public_key");
    }
  }

  if (attestationDoc.user_data) {
    if (!numberInRange(-1, 512, attestationDoc.user_data.length)) {
      throw new Error("Invalid user_data");
    }
  }

  if (attestationDoc.nonce) {
    if (!numberInRange(-1, 512, attestationDoc.nonce.length)) {
      throw new Error("Invalid nonce");
    }
  }

  const certChain = attestationDoc.cabundle.map((cert: Buffer) =>
    derToPem(cert)
  );

  const cert = derToPem(attestationDoc.certificate);

  if (!verifyCertChain(aws_root_cert_pem, [...certChain, cert])) {
    throw new Error("Invalid certificate chain");
  }

  const finalCert = Certificate.fromPEM(Buffer.from(cert));
  const publicKeyDer = finalCert.publicKeyRaw;
  const decoded = ECPublicKeyASN.decode(publicKeyDer, "der");
  const pubKeyBuffer = Buffer.from(decoded.pubKey.data);

  const x = pubKeyBuffer.subarray(1, 49).toString("hex");
  const y = pubKeyBuffer.subarray(49).toString("hex");

  const verifier = {
    key: {
      x,
      y,
    },
  };

  await cose.sign.verify(Buffer.from(attestation), verifier, {
    defaultType: 18,
  });

  return {
    userData: attestationDoc.user_data,
    pubkey: attestationDoc.public_key,
  };
};

type AttestationDoc = {
  module_id: string;
  digest: string;
  timestamp: number;
  pcrs: Map<number, Buffer>;
  certificate: Buffer;
  cabundle: Array<Buffer>;
  public_key: string | null;
  user_data: string | null;
  nonce: string | null;
};

export const getProofGeneratedUpdate = async (
  uuid: string
): Promise<{
  created_at: string;
  witness_generated_at: string;
  proof_generated_at: string;
}> => {
  const socket2 = io(WSS_URL, { transports: ["websocket"] });
  socket2.on("connect", () => {
    socket2.emit("subscribe", uuid);
  });
  socket2.on("error", (err) => {
    console.error("Socket.IO error:", err);
  });

  return new Promise((resolve, reject) => {
    socket2.on("status", (data) => {
      try {
        if (data.status === 3 || data.status === 5) {
          socket2.close();
          reject(`Proof generation failed:  ${data.request_id}`);
        } else if (data.status === 4) {
          socket2.close();
          resolve(data);
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });
  });
};

export const createRandomString = (length: number) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
