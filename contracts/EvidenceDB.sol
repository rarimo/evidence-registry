// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {IEvidenceDB} from "./interfaces/IEvidenceDB.sol";

import {SparseMerkleTree} from "./libraries/SparseMerkleTree.sol";

contract EvidenceDB is IEvidenceDB {
    using SparseMerkleTree for SparseMerkleTree.SMT;

    SparseMerkleTree.SMT private _tree;

    /**
     * @inheritdoc IEvidenceDB
     */
    function add(bytes32 key_, bytes32 value_) external {
        _tree.add(key_, value_);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function remove(bytes32 key_) external {
        _tree.remove(key_);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function update(bytes32 key_, bytes32 newValue_) external {
        _tree.update(key_, newValue_);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function getRoot() external view returns (bytes32) {
        return _tree.getRoot();
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function getSize() external view returns (uint256) {
        return _tree.getNodesCount();
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function getProof(bytes32 key_) external view returns (Proof memory) {
        return _tree.getProof(key_);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function getValue(bytes32 key_) external view returns (bytes32) {
        return _tree.getNodeByKey(key_).value;
    }
}
