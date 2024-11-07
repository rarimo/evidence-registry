// SPDX-License-Identifier: CC0-1.0
// solhint-disable
pragma solidity ^0.8.21;

import {IEvidenceDB} from "../interfaces/IEvidenceDB.sol";

import {SparseMerkleTree} from "../libraries/SparseMerkleTree.sol";
import {PoseidonUnit2L, PoseidonUnit3L} from "../libraries/Poseidon.sol";

contract SparseMerkleTreeMock {
    using SparseMerkleTree for *;

    SparseMerkleTree.SMT internal _tree;

    function initializeTree(uint32 maxDepth_) external {
        _tree.initialize(maxDepth_);
    }

    function setMaxDepthTree(uint32 maxDepth_) external {
        _tree.setMaxDepth(maxDepth_);
    }

    function setPoseidonHasher() external {
        _tree.setHashers(_hash2, _hash3);
    }

    function add(bytes32 key_, bytes32 value_) external {
        _tree.add(key_, value_);
    }

    function remove(bytes32 key_) external {
        _tree.remove(key_);
    }

    function update(bytes32 key_, bytes32 newValue_) external {
        _tree.update(key_, newValue_);
    }

    function getProof(bytes32 key_) external view returns (IEvidenceDB.Proof memory) {
        return _tree.getProof(key_);
    }

    function getRoot() external view returns (bytes32) {
        return _tree.getRoot();
    }

    function getNode(uint256 nodeId_) external view returns (SparseMerkleTree.Node memory) {
        return _tree.getNode(nodeId_);
    }

    function getNodeByKey(bytes32 key_) external view returns (SparseMerkleTree.Node memory) {
        return _tree.getNodeByKey(key_);
    }

    function getMaxDepth() external view returns (uint256) {
        return _tree.getMaxDepth();
    }

    function getNodesCount() external view returns (uint256) {
        return _tree.getNodesCount();
    }

    function isCustomHasherSet() external view returns (bool) {
        return _tree.isCustomHasherSet();
    }

    function _hash2(bytes32 element1_, bytes32 element2_) internal pure returns (bytes32) {
        return PoseidonUnit2L.poseidon([element1_, element2_]);
    }

    function _hash3(
        bytes32 element1_,
        bytes32 element2_,
        bytes32 element3_
    ) internal pure returns (bytes32) {
        return bytes32(PoseidonUnit3L.poseidon([element1_, element2_, element3_]));
    }
}
