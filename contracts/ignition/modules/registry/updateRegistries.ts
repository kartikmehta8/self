import { buildModule, IgnitionModuleBuilder } from "@nomicfoundation/ignition-core";
import hre from "hardhat";
import { readFileSync } from "fs";
import path from "path";

const registries = {
  "IdentityRegistryImplV1": {
    shouldChange: true,
    passportNoOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    nameAndDobOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    nameAndYobOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    hub: "0x0000000000000000000000000000000000000000",
    cscaRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  "IdentityRegistryIdCardImplV1": {
    shouldChange: true,
    nameAndDobOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    nameAndYobOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    hub: "0x0000000000000000000000000000000000000000",
    cscaRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  "IdentityRegistryAadhaarImplV1": {
    shouldChange: true,
    nameAndDobOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    nameAndYobOfac: "0x0000000000000000000000000000000000000000000000000000000000000000",
    hub: "0x0000000000000000000000000000000000000000",
    pubkeyCommitments: [] as string[],
  },
}

export function handleRegistryDeployment(m: IgnitionModuleBuilder, registry: string, registryData: any, deployedAddresses: any) {
  const registryAddress = deployedAddresses["DeployRegistryModule#" + registry];
  const registryContract = m.contractAt(registry, registryAddress);

  if (registryData.shouldChange) {
    // Update hub for all registries
    m.call(registryContract, "updateHub", [registryData.hub]);

    if (registryData.cscaRoot) {
      m.call(registryContract, "updateCscaRoot", [registryData.cscaRoot]);
    }

    if (registryData.passportNoOfac) {
      m.call(registryContract, "updatePassportNoOfacRoot", [registryData.passportNoOfac]);
    }
    m.call(registryContract, "updateNameAndDobOfacRoot", [registryData.nameAndDobOfac]);
    m.call(registryContract, "updateNameAndYobOfacRoot", [registryData.nameAndYobOfac]);

    if (registryData.pubkeyCommitments && registryData.pubkeyCommitments.length > 0) {
      for (const pubkeyCommitment of registryData.pubkeyCommitments) {
        m.call(registryContract, "registerUidaiPubkeyCommitment", [
          pubkeyCommitment,
        ]);
      }
    }
  }

  return registryContract;
}

export default buildModule("UpdateRegistries", (m) => {
  const deployments: Record<string, any> = {};

  const chainId = hre.network.config.chainId;
  const deployedAddressesPath = path.join(__dirname, `../../deployments/chain-${chainId}/deployed_addresses.json`);
  const deployedAddresses = JSON.parse(readFileSync(deployedAddressesPath, "utf8"));

  for (const registry of Object.keys(registries)) {
    const registryData = registries[registry as keyof typeof registries];
    const registryContract = handleRegistryDeployment(m, registry, registryData, deployedAddresses);
    deployments[registry] = registryContract;
  }

  return deployments;
});
