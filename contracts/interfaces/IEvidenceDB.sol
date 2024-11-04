// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @notice Evidence DB interface for Sparse Merkle Tree based statements database.
 */
interface IEvidenceDB {
    /**
     * @notice Represents the proof of a node's inclusion/exclusion in the tree.
     * @param root The root hash of the Merkle tree.
     * @param siblings An array of sibling hashes can be used to get the Merkle Root.
     * @param existence Indicates the presence (true) or absence (false) of the node.
     * @param key The key associated with the node.
     * @param value The value associated with the node.
     * @param auxExistence Indicates the presence (true) or absence (false) of an auxiliary node.
     * @param auxKey The key of the auxiliary node.
     * @param auxValue The value of the auxiliary node.
     */
    struct Proof {
        bytes32 root;
        bytes32[] siblings;
        bool existence;
        bytes32 key;
        bytes32 value;
        bool auxExistence;
        bytes32 auxKey;
        bytes32 auxValue;
    }

    /**
     * @notice Adds the new element to the tree.
     */
    function add(bytes32 key, bytes32 value) external;

    /**
     * @notice Removes the element from the tree.
     */
    function remove(bytes32 key) external;

    /**
     * @notice Updates the element in the tree.
     */
    function update(bytes32 key, bytes32 newValue) external;

    /**
     * @notice Gets the SMT root.
     * SHOULD NOT be used on-chain due to roots frontrunning.
     */
    function getRoot() external view returns (bytes32);

    /**
     * @notice Gets the number of nodes in the tree.
     */
    function getSize() external view returns (uint256);

    /**
     * @notice Gets Merkle inclusion/exclusion proof of the element.
     */
    function getProof(bytes32 key) external view returns (Proof memory);

    /**
     * @notice Gets the element value by its key.
     */
    function getValue(bytes32 key) external view returns (bytes32);
}
