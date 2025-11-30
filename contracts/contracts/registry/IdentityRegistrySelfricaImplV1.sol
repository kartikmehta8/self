// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {InternalLeanIMT, LeanIMTData} from "@zk-kit/imt.sol/internal/InternalLeanIMT.sol";
import {IIdentityRegistrySelfricaV1} from "../interfaces/IIdentityRegistrySelfricaV1.sol";
import {AttestationId} from "../constants/AttestationId.sol";
import {ImplRoot} from "../upgradeable/ImplRoot.sol";
import {GCPJWTHelper} from "../libraries/GCPJWTHelper.sol";

import {console} from "hardhat/console.sol";
/**
 * @notice ⚠️ CRITICAL STORAGE LAYOUT WARNING ⚠️
 * =============================================
 *
 * This contract uses the UUPS upgradeable pattern which makes storage layout EXTREMELY SENSITIVE.
 *
 * 🚫 NEVER MODIFY OR REORDER existing storage variables
 * 🚫 NEVER INSERT new variables between existing ones
 * 🚫 NEVER CHANGE THE TYPE of existing variables
 *
 * ✅ New storage variables MUST be added in one of these two ways ONLY:
 *    1. At the END of the storage layout
 *    2. In a new V2 contract that inherits from this V1
 * ✅ It is safe to rename variables (e.g., changing 'variable' to 'oldVariable')
 *    as long as the type and order remain the same
 *
 * For more detailed information about forbidden changes, please refer to:
 * https://docs.openzeppelin.com/upgrades-plugins/writing-upgradeable#modifying-your-contracts
 *
 * ⚠️ VIOLATION OF THESE RULES WILL CAUSE CATASTROPHIC STORAGE COLLISIONS IN FUTURE UPGRADES ⚠️
 * =============================================
*/

/**
 * @title IdentityRegistrySelfricaStorageV1
 * @dev Abstract contract for storage layout of IdentityRegistrySelfricaImplV1.
 * Inherits from ImplRoot to provide upgradeable functionality.
 */
abstract contract IdentityRegistrySelfricaStorageV1 is ImplRoot {
    // =============================================
    // Storage Variables
    // =============================================

    /// @notice Address of the identity verification hub.
    address internal _hub;

    /// @notice Address of the PCR0Manager.
    address internal _PCR0Manager;

    /// @notice Merkle tree data structure for identity commitments.
    LeanIMTData internal _identityCommitmentIMT;

    /// @notice Mapping from public key commitment to its creation timestamp.
    mapping(uint256 => uint256) internal _rootTimestamps;

    /// @notice Mapping from nullifier to a boolean indicating registration.
    mapping(uint256 => bool) internal _nullifiers;

    /// @notice Pubkey commitments registered for Selfrica. .
    mapping(uint256 => bool) internal _isRegisteredPubkeyCommitment;

    /// @notice Current name and date of birth OFAC root.
    uint256 internal _nameAndDobOfacRoot;

    /// @notice Current name and year of birth OFAC root.
    uint256 internal _nameAndYobOfacRoot;

    /// @notice Address of the GCP JWT verifier contract.
    address internal _gcpJwtVerifier;

    /// @notice Pubkey strings registered for Selfrica (via GCP JWT proof).
    mapping(string => bool) internal _isRegisteredPubkey;
}

interface IGCPJWTVerifier {
    function verifyProof(uint256[2] calldata pA, uint256[2][2] calldata pB, uint256[2] calldata pC, uint256[7] calldata pubSignals) external view returns (bool);
}

interface IPCR0Manager {
    function isPCR0Set(bytes calldata pcr0) external view returns (bool);
}

/**
 * @title IdentityRegistrySelfricaImplV1
 * @notice Provides functions to register and manage identity commitments using a Merkle tree structure.
 * @dev Inherits from IdentityRegistrySelfricaStorageV1 and implements IIdentityRegistrySelfricaV1.
 */
contract IdentityRegistrySelfricaImplV1 is IdentityRegistrySelfricaStorageV1, IIdentityRegistrySelfricaV1 {
    using InternalLeanIMT for LeanIMTData;

    uint256 public constant GCP_ROOT_CA_PUBKEY_HASH = 21107503781769611051785921462832133421817512022858926231578334326320168810501;

    // ====================================================
    // Events
    // ====================================================

    /// @notice Emitted when the registry is initialized.
    event RegistryInitialized(address hub, address PCR0Manager);
    /// @notice Emitted when the hub address is updated.
    event HubUpdated(address hub);
    /// @notice Emitted when the PCR0Manager address is updated.
    event PCR0ManagerUpdated(address PCR0Manager);
    /// @notice Emitted when the name and date of birth OFAC root is updated.
    event NameAndDobOfacRootUpdated(uint256 nameAndDobOfacRoot);
    /// @notice Emitted when the name and year of birth OFAC root is updated.
    event NameAndYobOfacRootUpdated(uint256 nameAndYobOfacRoot);
    /// @notice Emitted when an identity commitment is successfully registered.
    event CommitmentRegistered(
        bytes32 indexed attestationId,
        uint256 indexed nullifier,
        uint256 indexed commitment,
        uint256 timestamp,
        uint256 imtRoot,
        uint256 imtIndex
    );
    /// @notice Emitted when a public key commitment is successfully registered (owner).
    event PubkeyCommitmentRegistered(uint256 indexed commitment);
    /// @notice Emitted when a public key is successfully registered (via GCP JWT proof).
    event PubkeyRegistered(string pubkey);

    /// @notice Emitted when a identity commitment is added by dev team.
    event DevCommitmentRegistered(
        bytes32 indexed attestationId,
        uint256 indexed nullifier,
        uint256 indexed commitment,
        uint256 timestamp,
        uint256 imtRoot,
        uint256 imtIndex
    );
    /// @notice Emitted when a identity commitment is updated by dev team.
    event DevCommitmentUpdated(uint256 indexed oldLeaf, uint256 indexed newLeaf, uint256 imtRoot, uint256 timestamp);
    /// @notice Emitted when a identity commitment is removed by dev team.
    event DevCommitmentRemoved(uint256 indexed oldLeaf, uint256 imtRoot, uint256 timestamp);

    // ====================================================
    // Errors
    // ====================================================

    /// @notice Thrown when the hub is not set.
    error HUB_NOT_SET();
    /// @notice Thrown when a function is accessed by an address other than the designated hub.
    error ONLY_HUB_CAN_ACCESS();
    /// @notice Thrown when attempting to register a commitment that has already been registered.
    error REGISTERED_COMMITMENT();
    /// @notice Thrown when the hub address is set to the zero address.
    error HUB_ADDRESS_ZERO();
    error INVALID_PROOF();
    error INVALID_ROOT_CA();
    error INVALID_IMAGE();

    // ====================================================
    // Modifiers
    // ====================================================

    /**
     * @notice Modifier to restrict access to functions to only the hub.
     * @dev Reverts if the hub is not set or if the caller is not the hub.
     */
    modifier onlyHub() {
        if (address(_hub) == address(0)) revert HUB_NOT_SET();
        if (msg.sender != address(_hub)) revert ONLY_HUB_CAN_ACCESS();
        _;
    }

    // ====================================================
    // Constructor
    // ====================================================

    /**
     * @notice Constructor that disables initializers.
     * @dev Prevents direct initialization of the implementation contract.
     */
    constructor() {
        _disableInitializers();
    }

    // ====================================================
    // Initializer
    // ====================================================

    /**
     * @notice Initializes the registry implementation.
     * @dev Sets the hub address and initializes the UUPS upgradeable feature.
     * @param hubAddress The address of the identity verification hub.
     * @param pcr0ManagerAddress The address of the PCR0Manager.
     */
    function initialize(address hubAddress, address pcr0ManagerAddress) external initializer {
        __ImplRoot_init();
        _hub = hubAddress;
        _PCR0Manager = pcr0ManagerAddress;
        emit RegistryInitialized(hubAddress, pcr0ManagerAddress);
    }

    // ====================================================
    // External Functions - View & Checks
    // ====================================================

    /**
     * @notice Retrieves the hub address.
     * @return The current identity verification hub address.
     */
    function hub() external view onlyProxy returns (address) {
        return _hub;
    }

    /**
     * @notice Retrieves the PCR0Manager address.
     * @return The current PCR0Manager address.
     */
    function PCR0Manager() external view onlyProxy returns (address) {
        return _PCR0Manager;
    }

    /// @notice Checks if a specific nullifier is registered.
    /// @param nullifier The nullifier to be checked.
    /// @return True if the nullifier has been registered, false otherwise.
    function nullifiers(uint256 nullifier) external view virtual onlyProxy returns (bool) {
        return _nullifiers[nullifier];
    }

    /// @notice Retrieves the timestamp of the identity commitment Merkle tree root.
    /// @param root The Merkle tree root to check.
    /// @return The timestamp of the root.
    function rootTimestamps(uint256 root) external view virtual onlyProxy returns (uint256) {
        return _rootTimestamps[root];
    }

    /// @notice Checks if the pubkey commitment is registered (owner-registered).
    /// @param pubkeyCommitment The pubkey commitment to check.
    /// @return True if the pubkey commitment is registered, false otherwise.
    function isRegisteredPubkeyCommitment(uint256 pubkeyCommitment) external view onlyProxy returns (bool) {
        return _isRegisteredPubkeyCommitment[pubkeyCommitment];
    }

    /// @notice Checks if the pubkey string is registered (via GCP JWT proof).
    /// @param pubkey The pubkey string to check.
    /// @return True if the pubkey is registered, false otherwise.
    function isRegisteredPubkey(string calldata pubkey) external view onlyProxy returns (bool) {
        return _isRegisteredPubkey[pubkey];
    }

    /// @notice Retrieves the total number of identity commitments in the Merkle tree.
    /// @return The size (i.e., count) of the identity commitment Merkle tree.
    function getIdentityCommitmentMerkleTreeSize() external view virtual onlyProxy returns (uint256) {
        return _identityCommitmentIMT.size;
    }

    /// @notice Checks if the identity commitment Merkle tree contains the specified root.
    /// @param root The Merkle tree root to check.
    /// @return True if the root exists in the tree, false otherwise.
    function checkIdentityCommitmentRoot(uint256 root) external view virtual onlyProxy returns (bool) {
        return _rootTimestamps[root] > 0;
    }

    /// @notice Retrieves the current Merkle root of the identity commitments.
    /// @return The current identity commitment Merkle root.
    function getIdentityCommitmentMerkleRoot() external view virtual onlyProxy returns (uint256) {
        return _identityCommitmentIMT._root();
    }

    /**
     * @notice Retrieves the name and date of birth OFAC root.
     * @return The current name and date of birth OFAC root.
     */
    function getNameAndDobOfacRoot() external view onlyProxy returns (uint256) {
        return _nameAndDobOfacRoot;
    }

    /**
     * @notice Retrieves the name and year of birth OFAC root.
     * @return The current name and year of birth OFAC root.
     */
    function getNameAndYobOfacRoot() external view onlyProxy returns (uint256) {
        return _nameAndYobOfacRoot;
    }

    /**
     * @notice Retrieves the identity commitment Merkle tree.
     * @return The current identity commitment Merkle tree.
     */
    function checkOfacRoots(uint256 nameAndDobRoot, uint256 nameAndYobRoot) external view onlyProxy returns (bool) {
        return _nameAndDobOfacRoot == nameAndDobRoot && _nameAndYobOfacRoot == nameAndYobRoot;
    }

    /**
     * @notice Checks if the provided pubkey commitment is stored in the registry (owner-registered).
     * @param pubkeyCommitment The pubkey commitment to verify.
     * @return True if the pubkey commitment is stored in the registry, false otherwise.
     */
    function checkPubkeyCommitment(uint256 pubkeyCommitment) external view onlyProxy returns (bool) {
        return _isRegisteredPubkeyCommitment[pubkeyCommitment];
    }

    /**
     * @notice Checks if the provided pubkey string is stored in the registry (via GCP JWT proof).
     * @param pubkey The pubkey string to verify.
     * @return True if the pubkey is stored in the registry, false otherwise.
     */
    function checkPubkey(string calldata pubkey) external view onlyProxy returns (bool) {
        return _isRegisteredPubkey[pubkey];
    }

    // ====================================================
    // External Functions - Registration
    // ====================================================

    /// @notice Registers a new identity commitment.
    /// @dev Caller must be the hub. Reverts if the nullifier is already registered.
    /// @param nullifier The nullifier associated with the identity commitment.
    /// @param commitment The identity commitment to register.
    function registerCommitment(uint256 nullifier, uint256 commitment) external onlyProxy onlyHub {
        if (_nullifiers[nullifier]) revert REGISTERED_COMMITMENT();
        console.log("nullifier", nullifier);
        console.log("commitment", commitment);
        _nullifiers[nullifier] = true;
        uint256 index = _identityCommitmentIMT.size;
        uint256 imt_root = _identityCommitmentIMT._insert(commitment);
        _rootTimestamps[imt_root] = block.timestamp;
        emit CommitmentRegistered(AttestationId.SELFRICA_ID_CARD, nullifier, commitment, block.timestamp, imt_root, index);
    }

    // ====================================================
    // External Functions - Only Owner
    // ====================================================

    /**
     * @notice Updates the hub address.
     * @dev Callable only via a proxy and restricted to the contract owner.
     * @param newHubAddress The new address of the hub.
     */
    function updateHub(address newHubAddress) external onlyProxy onlyOwner {
        if (newHubAddress == address(0)) revert HUB_ADDRESS_ZERO();
        _hub = newHubAddress;
        emit HubUpdated(newHubAddress);
    }

    /**
     * @notice Updates the PCR0Manager address.
     * @dev Callable only via a proxy and restricted to the contract owner.
     * @param newPCR0ManagerAddress The new address of the PCR0Manager.
     */
    function updatePCR0Manager(address newPCR0ManagerAddress) external virtual onlyProxy onlyOwner {
        _PCR0Manager = newPCR0ManagerAddress;
        emit PCR0ManagerUpdated(newPCR0ManagerAddress);
    }

    /**
     * @notice Updates the name and date of birth OFAC root.
     */
    function updateNameAndDobOfacRoot(uint256 nameAndDobOfacRoot) external virtual onlyProxy onlyOwner {
        _nameAndDobOfacRoot = nameAndDobOfacRoot;
        emit NameAndDobOfacRootUpdated(nameAndDobOfacRoot);
    }

    /**
     * @notice Updates the name and year of birth OFAC root.
     */
    function updateNameAndYobOfacRoot(uint256 nameAndYobOfacRoot) external virtual onlyProxy onlyOwner {
        _nameAndYobOfacRoot = nameAndYobOfacRoot;
        emit NameAndYobOfacRootUpdated(nameAndYobOfacRoot);
    }

    /// @notice Registers a pubkey via GCP JWT proof.
    /// @dev Verifies the proof, checks root CA hash matches constant, validates image hash against PCR0Manager.
    /// @param pA Groth16 proof element A.
    /// @param pB Groth16 proof element B.
    /// @param pC Groth16 proof element C.
    /// @param pubSignals Circuit public signals: [rootCAHash, eatNonce[0-2], imageHash[0-2]].
    function registerPubkey(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[7] calldata pubSignals
    ) external onlyProxy {
        // Check if the proof is valid
        if (!IGCPJWTVerifier(_gcpJwtVerifier).verifyProof(pA, pB, pC, pubSignals)) revert INVALID_PROOF();

        // Check if the root CA pubkey hash is valid
        if (pubSignals[0] != GCP_ROOT_CA_PUBKEY_HASH) revert INVALID_ROOT_CA();

        // Check if the TEE image hash is valid
        bytes memory imageHash = GCPJWTHelper.unpackAndConvertImageHash(pubSignals[4], pubSignals[5], pubSignals[6]);
        if (!IPCR0Manager(_PCR0Manager).isPCR0Set(imageHash)) revert INVALID_IMAGE();

        // Unpack the pubkey and register it
        string memory pubkey = GCPJWTHelper.unpackPubkeyString(pubSignals[1], pubSignals[2], pubSignals[3]);
        _isRegisteredPubkey[pubkey] = true;
        emit PubkeyRegistered(pubkey);
    }

    /// @notice Updates the GCP JWT verifier contract address.
    /// @dev Callable only by the contract owner.
    /// @param verifier The new GCP JWT verifier address.
    function updateGCPJWTVerifier(address verifier) external onlyProxy onlyOwner {
        _gcpJwtVerifier = verifier;
    }

    /// @notice (DEV) Force-adds an identity commitment.
    /// @dev Callable only by the owner for testing or administration.
    /// @param nullifier The nullifier associated with the identity commitment.
    /// @param commitment The identity commitment to add.
    function devAddIdentityCommitment(
        uint256 nullifier,
        uint256 commitment
    ) external onlyProxy onlyOwner {
        _nullifiers[nullifier] = true;
        uint256 imt_root = _identityCommitmentIMT._insert(commitment);
        _rootTimestamps[imt_root] = block.timestamp;
        uint256 index = _identityCommitmentIMT._indexOf(commitment);
        emit DevCommitmentRegistered(AttestationId.SELFRICA_ID_CARD, nullifier, commitment, block.timestamp, imt_root, index);
    }

    /// @notice (DEV) Updates an existing identity commitment.
    /// @dev Caller must be the owner. Provides sibling nodes for proof of position.
    /// @param oldLeaf The current identity commitment to update.
    /// @param newLeaf The new identity commitment.
    /// @param siblingNodes An array of sibling nodes for Merkle proof generation.
    function devUpdateCommitment(
        uint256 oldLeaf,
        uint256 newLeaf,
        uint256[] calldata siblingNodes
    ) external onlyProxy onlyOwner {
        uint256 imt_root = _identityCommitmentIMT._update(oldLeaf, newLeaf, siblingNodes);
        _rootTimestamps[imt_root] = block.timestamp;
        emit DevCommitmentUpdated(oldLeaf, newLeaf, imt_root, block.timestamp);
    }

    /// @notice (DEV) Removes an existing identity commitment.
    /// @dev Caller must be the owner. Provides sibling nodes for proof of position.
    /// @param oldLeaf The identity commitment to remove.
    /// @param siblingNodes An array of sibling nodes for Merkle proof generation.
    function devRemoveCommitment(uint256 oldLeaf, uint256[] calldata siblingNodes) external onlyProxy onlyOwner {
        uint256 imt_root = _identityCommitmentIMT._remove(oldLeaf, siblingNodes);
        _rootTimestamps[imt_root] = block.timestamp;
        emit DevCommitmentRemoved(oldLeaf, imt_root, block.timestamp);
    }
}
