// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title TypeCasts
 * @notice Library for converting between address and bytes32 types
 * @dev Used for Hyperlane's universal address format
 */
library TypeCasts {
    /**
     * @notice Convert an address to bytes32
     * @param _addr The address to convert
     * @return The address as bytes32
     */
    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @notice Convert bytes32 to an address
     * @param _bytes The bytes32 to convert
     * @return The address
     */
    function bytes32ToAddress(bytes32 _bytes) internal pure returns (address) {
        return address(uint160(uint256(_bytes)));
    }
}
