import { genAndInitMockPassportData, generateCircuitInputsRegister, getCircuitNameFromPassportData, PassportData } from "@selfxyz/common";
import { getProofGeneratedUpdate, handshakeAndGetUuid, runGenerateVcAndDiscloseRawProof } from "./ts-api/utils/helper.ts";
import { REGISTER_URL } from "./ts-api/utils/constant.ts";
import axios from "axios";

async function registerMockPassport(secret: string): Promise<PassportData> {

  const passportData = genAndInitMockPassportData(
    "sha1",
    "sha1",
    "rsa_sha1_65537_4096",
    "FRA",
    "000101",
    "300101",
  );

  const dscTree = await axios.get("http://tree.staging.self.xyz/dsc");
  const serialized_dsc_tree = dscTree.data;

  //Register proof generation
  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data
  );

  const registerCircuitName = getCircuitNameFromPassportData(
    passportData,
    "register"
  );

  //keyLength === 384 ? REGISTER_MEDIUM_URL : REGISTER_URL,
  const registerUuid = await handshakeAndGetUuid(
    REGISTER_URL,
    registerInputs,
    "register",
    registerCircuitName
  );

  const registerData = await getProofGeneratedUpdate(registerUuid);
  console.log(" Got register proof generated update:", registerData ? "SUCCESS" : "FAILED");
  console.log("\x1b[34m%s\x1b[0m", "register uuid:", registerUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", registerCircuitName);
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    (new Date(registerData.witness_generated_at).getTime() -
      new Date(registerData.created_at).getTime()) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    (new Date(registerData.proof_generated_at).getTime() -
      new Date(registerData.witness_generated_at).getTime()) /
      1000,
    " seconds"
  );
  return passportData;
}


async function discloseProof(secret: string, attestationId: string, passportData: PassportData, scope: string) {

 return await runGenerateVcAndDiscloseRawProof(
    secret,
    attestationId,
    passportData,
    scope,
    "",
    );

}

export { registerMockPassport, discloseProof };
