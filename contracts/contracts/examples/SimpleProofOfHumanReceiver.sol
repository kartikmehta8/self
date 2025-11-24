// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IMessageRecipient } from "../interfaces/hyperlane/IMessageRecipient.sol";
import { IMailboxV3 } from "../interfaces/hyperlane/IMailboxV3.sol";

/**
 * @title SimpleProofOfHumanReceiver
 * @notice Minimal receiver for cross-chain proof of human verification
 */
contract SimpleProofOfHumanReceiver is IMessageRecipient {
    // Immutable
    uint32 public immutable SOURCE_DOMAIN;
    address public immutable MAILBOX;

    // State
    address public owner;
    mapping(address => bool) public isVerified;
    mapping(bytes32 => address) public userIdentifierToAddress;
    uint256 public verificationCount;

    // Events
    event VerificationReceived(address indexed userAddress, bytes32 indexed userIdentifier, uint256 timestamp);

    // Errors
    error NotMailbox();
    error InvalidOrigin();
    error OnlyOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _mailbox, uint32 _sourceDomain) {
        MAILBOX = _mailbox;
        SOURCE_DOMAIN = _sourceDomain;
        owner = msg.sender;
    }

    function handle(
        uint32 _origin,
        bytes32,
        bytes calldata _message
    ) external override {
        if (msg.sender != MAILBOX) revert NotMailbox();
        if (_origin != SOURCE_DOMAIN) revert InvalidOrigin();

        (bytes32 userIdentifier, address userAddress,,) = abi.decode(_message, (bytes32, address, bytes, uint256));

        isVerified[userAddress] = true;
        userIdentifierToAddress[userIdentifier] = userAddress;
        verificationCount++;

        emit VerificationReceived(userAddress, userIdentifier, block.timestamp);
    }

    function localDomain() external view returns (uint32) {
        return IMailboxV3(MAILBOX).localDomain();
    }
}
