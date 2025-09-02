
import { hashEndpointWithScope } from "@selfxyz/common/utils/scope";
import { genAndInitMockPassportData } from "@selfxyz/common/utils/passports/genMockPassportData";
import { getProofGeneratedUpdate, handshakeAndGetUuid, runGenerateVcAndDiscloseRawProof } from "./utils/helper.js";
import { generateCircuitInputsDSC, generateCircuitInputsRegister, getCircuitNameFromPassportData } from "@selfxyz/common";
import { REGISTER_URL ,DSC_URL} from "./utils/constant.js";
import axios from "axios";



async function main() {
  const secret = "1234";
  const attestationId = "1";
  const scope = hashEndpointWithScope("http://localhost:3000", "self-playground");

  const passportData = genAndInitMockPassportData(
    "sha256",
    "sha256",
    "rsa_sha256_65537_4096" as any,
    "FRA",
    "000101",
    "300101",
  );

  const dscTree = await axios.get("http://tree.staging.self.xyz/dsc");
  const serialized_dsc_tree: any = dscTree.data;

  const response = await axios.get("http://tree.staging.self.xyz/csca");
  const data : any = response.data;


  //DSC proof generation
  const cscaTree = JSON.parse(data.data);
  const dscInputs = generateCircuitInputsDSC(passportData, cscaTree);
  const dscCircuitName = getCircuitNameFromPassportData(passportData, "dsc");
  const dscUuid = await handshakeAndGetUuid(
    DSC_URL,
    dscInputs,
    "dsc",
    dscCircuitName
  );
  const dscData = await getProofGeneratedUpdate(dscUuid);
  //pretty print the circuit name
  console.log("\x1b[34m%s\x1b[0m", "dsc uuid:", dscUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", dscCircuitName);
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    //@ts-ignore
    (new Date(dscData.witness_generated_at) - new Date(dscData.created_at)) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    //@ts-ignore
    (new Date(dscData.proof_generated_at) -
      //@ts-ignore
      new Date(dscData.witness_generated_at)) /
      1000,
    " seconds"
  );

  //Register proof generation
  const registerInputs = generateCircuitInputsRegister(
    secret,
    passportData,
    serialized_dsc_tree.data as string
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
  console.log("\x1b[34m%s\x1b[0m", "register uuid:", registerUuid);
  console.log("\x1b[34m%s\x1b[0m", "circuit:", registerCircuitName);
  console.log(
    "\x1b[34m%s\x1b[0m",
    "witness generation duration:",
    //@ts-ignore
    (new Date(registerData.witness_generated_at) -
      //@ts-ignore
      new Date(registerData.created_at)) /
      1000,
    " seconds"
  );
  console.log(
    "\x1b[34m%s\x1b[0m",
    "proof   generation duration:",
    //@ts-ignore
    (new Date(registerData.proof_generated_at) -
      //@ts-ignore
      new Date(registerData.witness_generated_at)) /
      1000,
    " seconds"
  );

  await runGenerateVcAndDiscloseRawProof(
    secret,
    attestationId,
    passportData,
    scope,
    "",
  );

  console.log("Saved proof JSON to vc_and_disclose_proof.json");
}

main().catch((err) => {
  console.error("Failed to generate VC+Disclose proof:", err?.message ?? err);
  process.exit(1);
});
