// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.21;

/**
 * @notice Common Evidence Registry interface.
 */
interface IEvidenceRegistry {
    /**
     * @notice MUST be emitted whenever the Merkle root is updated.
     */
    event RootUpdated(bytes32 indexed prev, bytes32 indexed curr);

    error NumberNotInPrimeField(bytes32 key);
    error KeyAlreadyExists(bytes32 key);
    error KeyDoesNotExist(bytes32 key);

    /**
     * @notice Adds the new statement to the DB.
     */
    function addStatement(bytes32 key, bytes32 value) external;

    /**
     * @notice Removes the statement from the DB.
     */
    function removeStatement(bytes32 key) external;

    /**
     * @notice Updates the statement in the DB.
     */
    function updateStatement(bytes32 key, bytes32 newValue) external;

    /**
     * @notice Retrieves historical DB roots creation timestamps.
     * Latest root MUST return `block.timestamp`.
     * Non-existent root MUST return `0`.
     */
    function getRootTimestamp(bytes32 root) external view returns (uint256);

    /**
     * @notice Builds and returns the isolated key for `source` and given `key`.
     */
    function getIsolatedKey(address source, bytes32 key) external view returns (bytes32);
}
