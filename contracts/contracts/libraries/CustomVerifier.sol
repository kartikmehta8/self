// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {CircuitAttributeHandlerV2} from "./CircuitAttributeHandlerV2.sol";
import {AttestationId} from "../constants/AttestationId.sol";

struct PassportOutput {
  uint256[3] revealedDataPacked;
  uint256[4] forbiddenCountriesListPacked;
  uint256 nullifier;
}

struct IdCardOutput {
  uint256[4] revealedDataPacked;
  uint256[4] forbiddenCountriesListPacked;
  uint256 nullifier;
}

library CustomVerifier {
  /**
   * @dev Unpacks the configuration of the custom verifier.
   * @param config The configuration of the custom verifier.
   * @return contractVersion The contract version.
   * @return attestationId The attestation id.
   * @return verificationConfig The verification configuration.
   */
  function unpackConfig(bytes calldata config) internal pure returns (uint8 contractVersion, uint8 attestationId, bytes memory verificationConfig) {
    assembly {
      let scratch := mload(0x40)

      calldatacopy(scratch, config.offset, 32)
      contractVersion := byte(0, mload(scratch))
      attestationId := byte(1, mload(scratch))
    }

    for (uint i = 0; i < config.length; i++) {
      verificationConfig = bytes.concat(verificationConfig, config[i]);
    }
  }

  /**
   * @dev Verifies the configuration of the custom verifier.
   * @param config The configuration of the custom verifier.
   * @param currentContractVersion The current contract version.
   * @return True if the configuration is valid, false otherwise.
   */
  function customVerify(bytes calldata config, uint8 currentContractVersion, bytes calldata proofOutput) external pure returns (bool) {
    (uint8 contractVersion, uint8 attestationId, bytes memory verificationConfigPrevious) = unpackConfig(config);

    if (contractVersion > currentContractVersion) {
      return false;
    }

    VerificationConfig.GenericVerficationConfigV2 memory verificationConfig;

    // you have to reformat the config to the current contract config
    if (contractVersion < currentContractVersion) {
      if (contractVersion == 1) {
        verificationConfig = VerificationConfig.fromV1Config(verificationConfigPrevious);
      }
    } else {
      verificationConfig = VerificationConfig.fromV2Config(verificationConfigPrevious);
    }

    if (attestationId == 0) {
      return false;
    }

    if (attestationId == 1) {
      PassportOutput memory passportOutput = abi.decode(proofOutput, (PassportOutput));
      return CustomVerifier.verifyPassport(verificationConfig, passportOutput);
    }

    if (attestationId == 2) {
      IdCardOutput memory idCardOutput = abi.decode(proofOutput, (IdCardOutput));
      return CustomVerifier.verifyIdCard(verificationConfig, idCardOutput);
    }

    return true;
  }

  function verifyPassport(VerificationConfig.GenericVerficationConfigV2 memory verificationConfig, PassportOutput memory passportOutput) internal pure returns (bool) {
    if (
      verificationConfig.ofacEnabled[0] ||
      verificationConfig.ofacEnabled[1] ||
      verificationConfig.ofacEnabled[2]
    ) {
      CircuitAttributeHandlerV2.compareOfac(
        AttestationId.E_PASSPORT,
        passportOutput.revealedDataPacked,
        verificationConfig.ofacEnabled[0],
        verificationConfig.ofacEnabled[1],
        verificationConfig.ofacEnabled[2]
      );
    }
    if (verificationConfig.forbiddenCountriesEnabled) {
      for (uint256 i = 0; i < 4; i++) {
        if (passportOutput.forbiddenCountriesListPacked[i] != verificationConfig.forbiddenCountriesListPacked[i]) {
          return false;
        }
      }
    }

    if (verificationConfig.olderThanEnabled) {
      if (!CircuitAttributeHandlerV2.compareOlderThan(
        AttestationId.E_PASSPORT,
        passportOutput.revealedDataPacked,
        verificationConfig.olderThan
      )) {
        return false;
      }
    }
    return true;
  }

  function verifyIdCard(VerificationConfig.GenericVerficationConfigV2 memory verificationConfig, IdCardOutput memory idCardOutput) internal pure returns (bool) {
    if (verificationConfig.ofacEnabled[0] || verificationConfig.ofacEnabled[1] || verificationConfig.ofacEnabled[2]) {
      CircuitAttributeHandlerV2.compareOfac(
        AttestationId.EU_ID_CARD,
        idCardOutput.revealedDataPacked,
        verificationConfig.ofacEnabled[0],
        verificationConfig.ofacEnabled[1],
        false
      );
    }

    if (verificationConfig.forbiddenCountriesEnabled) {
      for (uint256 i = 0; i < 4; i++) {
        if (idCardOutput.forbiddenCountriesListPacked[i] != verificationConfig.forbiddenCountriesListPacked[i]) {
          return false;
        }
      }
    }

    if (verificationConfig.olderThanEnabled) {
      if (!CircuitAttributeHandlerV2.compareOlderThan(
        AttestationId.EU_ID_CARD,
        idCardOutput.revealedDataPacked,
        verificationConfig.olderThan
      )) {
        return false;
      }
    }
    return true;
  }
}

library VerificationConfig {
  struct GenericVerficationConfigV1 {
    bool olderThanEnabled;
    uint256 olderThan;
    bool forbiddenCountriesEnabled;
    uint256[4] forbiddenCountriesListPacked;
    bool[3] ofacEnabled;
  }

  struct GenericVerficationConfigV2 {
    bool olderThanEnabled;
    uint256 olderThan;
    bool forbiddenCountriesEnabled;
    uint256[4] forbiddenCountriesListPacked;
    bool[3] ofacEnabled;
  }

  function fromV1Config(bytes memory verificationConfigV1) internal pure returns (GenericVerficationConfigV2 memory verificationConfig) {
    GenericVerficationConfigV1 memory config = abi.decode(verificationConfigV1, (GenericVerficationConfigV1));

    verificationConfig = GenericVerficationConfigV2({
      olderThanEnabled: config.olderThanEnabled,
      olderThan: config.olderThan,
      forbiddenCountriesEnabled: config.forbiddenCountriesEnabled,
      forbiddenCountriesListPacked: config.forbiddenCountriesListPacked,
      ofacEnabled: config.ofacEnabled
    });
  }

  function fromV2Config(bytes memory verificationConfig) internal pure returns (GenericVerficationConfigV2 memory verificationConfig) {
    return abi.decode(verificationConfig, (GenericVerficationConfigV2));
  }
}
