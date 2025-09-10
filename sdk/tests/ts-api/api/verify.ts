import { Request, Response } from "express";
import { SelfAppDisclosureConfig } from "@selfxyz/common";
import {
  IConfigStorage,
  VerificationConfig,
  countryCodes,
  SelfBackendVerifier,
  AllIds,
} from "@selfxyz/core";


// In-memory storage for testing purposes (replaces Redis/Upstash)
const configStore = new Map<string, string>();


export class KVConfigStore implements IConfigStorage {
  async getActionId(userIdentifier: string, data: string): Promise<string> {
    if(data === "68656c6c6f2066726f6d2074686520706c617967726f756e64") {
      return "1";
    }
    else if(data === "68656c6c6f2066726f6d2074686520706c617967726f756e65") {
      return "2";
    }
      return "";
  }

  async setConfig(id: string, config: VerificationConfig): Promise<boolean> {
    configStore.set(id, JSON.stringify(config));
    return true;
  }

  async getConfig(id: string): Promise<VerificationConfig> {
    const configStr = configStore.get(id);
    if (!configStr) {
      throw new Error(`Config not found for id: ${id}`);
    }
    return JSON.parse(configStr) as VerificationConfig;
  }
}

const configStoreInstance = new KVConfigStore();
configStoreInstance.setConfig("1", {
  minimumAge: 18,
  excludedCountries: ["PAK", "IRN"],
  ofac: false,
});



export const verifyHandler = async (
  req: Request,
  res: Response
) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { attestationId, proof, publicSignals, userContextData } = req.body;

    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return res.status(400).json({
        message:
          "Proof, publicSignals, attestationId and userContextData are required",
      });
    }

    const selfBackendVerifier = new SelfBackendVerifier(
      "self-playground",
      "http://localhost:3000",
      true,
      AllIds,
      configStoreInstance,
      "uuid"
    );

    const result = await selfBackendVerifier.verify(
      attestationId,
      proof,
      publicSignals,
      userContextData
    );

    if (!result.isValidDetails.isValid) {
      return res.status(500).json({
        status: "error",
        result: false,
        message: "Verification failed",
        details: result.isValidDetails,
      });
    }

    // Default disclosure configuration (show all fields)
    const saveOptions: SelfAppDisclosureConfig = {
      issuing_state: true,
      name: true,
      nationality: true,
      date_of_birth: true,
      passport_number: true,
      gender: true,
      expiry_date: true,
      minimumAge: 18,
      ofac: false,
      excludedCountries: ["PAK", "IRN"]
    };

    if (result.isValidDetails.isValid) {
      const filteredSubject = { ...result.discloseOutput };

      if (!saveOptions?.issuing_state && filteredSubject) {
        filteredSubject.issuingState = "Not disclosed";
      }
      if (!saveOptions?.name && filteredSubject) {
        filteredSubject.name = "Not disclosed";
      }
      if (!saveOptions?.nationality && filteredSubject) {
        filteredSubject.nationality = "Not disclosed";
      }
      if (!saveOptions?.date_of_birth && filteredSubject) {
        filteredSubject.dateOfBirth = "Not disclosed";
      }
      if (!saveOptions?.passport_number && filteredSubject) {
        filteredSubject.idNumber = "Not disclosed";
      }
      if (!saveOptions?.gender && filteredSubject) {
        filteredSubject.gender = "Not disclosed";
      }
      if (!saveOptions?.expiry_date && filteredSubject) {
        filteredSubject.expiryDate = "Not disclosed";
      }

      res.status(200).json({
        status: "success",
        result: result.isValidDetails.isValid,
        credentialSubject: filteredSubject,
        verificationOptions: {
          minimumAge: saveOptions?.minimumAge,
          ofac: saveOptions?.ofac,
          excludedCountries: saveOptions?.excludedCountries?.map(
            (countryName) => {
              const entry = Object.entries(countryCodes).find(
                ([_, name]) => name === countryName
              );
              return entry ? entry[0] : countryName;
            }
          ),
        },
      });
    } else {
      res.status(400).json({
        status: "error",
        result: result.isValidDetails.isValid,
        message: "Verification failed",
        details: result,
      });
    }
  } catch (error) {
    console.error("Error verifying proof:", error);
    return res.status(500).json({
      status: "error",
      result: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
