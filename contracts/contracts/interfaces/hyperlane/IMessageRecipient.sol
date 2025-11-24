// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title IMessageRecipient
 * @notice Interface for contracts that can receive Hyperlane messages
 */
interface IMessageRecipient {
    /**
     * @notice Handle an incoming message from Hyperlane
     * @param _origin The origin domain (chain) ID
     * @param _sender The sender address on the origin chain (as bytes32)
     * @param _message The message body
     */
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _message
    ) external;
}
