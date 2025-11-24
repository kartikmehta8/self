// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { SelfVerificationRoot } from "../abstract/SelfVerificationRoot.sol";
import { ISelfVerificationRoot } from "../interfaces/ISelfVerificationRoot.sol";
import { SelfStructs } from "../libraries/SelfStructs.sol";
import { SelfUtils } from "../libraries/SelfUtils.sol";
import { IIdentityVerificationHubV2 } from "../interfaces/IIdentityVerificationHubV2.sol";
import { IMailboxV3 } from "../interfaces/hyperlane/IMailboxV3.sol";
import { TypeCasts } from "../libraries/TypeCasts.sol";

/**
 * @title SimpleProofOfHumanSender
 * @notice Minimal sender for cross-chain proof of human verification
 */
contract SimpleProofOfHumanSender is SelfVerificationRoot {
    using TypeCasts for address;

    IMailboxV3 public immutable MAILBOX;
    uint32 public immutable DESTINATION_DOMAIN;
    address public defaultRecipient;
    bytes32 public verificationConfigId;

    event VerificationSentCrossChain(bytes32 messageId, address userAddress);

    constructor(
        address hubAddress,
        string memory scopeSeed,
        SelfUtils.UnformattedVerificationConfigV2 memory config,
        address mailbox,
        uint32 destinationDomain,
        address recipient
    ) SelfVerificationRoot(hubAddress, scopeSeed) {
        MAILBOX = IMailboxV3(mailbox);
        DESTINATION_DOMAIN = destinationDomain;
        defaultRecipient = recipient;

        SelfStructs.VerificationConfigV2 memory formattedConfig = SelfUtils.formatVerificationConfigV2(config);
        verificationConfigId = IIdentityVerificationHubV2(hubAddress).setVerificationConfigV2(formattedConfig);
    }

    receive() external payable {}

    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory userData
    ) internal override {
        if (address(this).balance > 0) {
            bytes memory message = abi.encode(
                bytes32(output.userIdentifier),
                address(uint160(output.userIdentifier)),
                userData,
                block.timestamp
            );

            bytes32 recipientBytes32 = defaultRecipient.addressToBytes32();

            bytes32 messageId = MAILBOX.dispatch{value: address(this).balance}(
                DESTINATION_DOMAIN,
                recipientBytes32,
                message
            );

            emit VerificationSentCrossChain(messageId, address(uint160(output.userIdentifier)));
        }
    }

    function getConfigId(bytes32, bytes32, bytes memory) public view override returns (bytes32) {
        return verificationConfigId;
    }
}
