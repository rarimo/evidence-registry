// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IEvidenceDB} from "./interfaces/IEvidenceDB.sol";

import {SparseMerkleTree} from "./libraries/SparseMerkleTree.sol";
import {PoseidonUnit2L, PoseidonUnit3L} from "./libraries/Poseidon.sol";

contract EvidenceDB is IEvidenceDB, Initializable {
    using SparseMerkleTree for SparseMerkleTree.SMT;

    address private _evidenceRegistry;

    SparseMerkleTree.SMT private _tree;

    modifier onlyEvidenceRegistry() {
        _requireEvidenceRegistry();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function __EvidenceDB_init(address evidenceRegistry_, uint32 maxDepth_) external initializer {
        _evidenceRegistry = evidenceRegistry_;

        _tree.initialize(maxDepth_);

        _tree.setHashers(_hash2, _hash3);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function add(bytes32 key_, bytes32 value_) external onlyEvidenceRegistry {
        _tree.add(key_, value_);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function remove(bytes32 key_) external onlyEvidenceRegistry {
        _tree.remove(key_);
    }

    /**
     * @inheritdoc IEvidenceDB
     */
    function update(bytes32 key_, bytes32 newValue_) external onlyEvidenceRegistry {
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

    /**
     * @notice Returns the address of the Evidence Registry.
     */
    function getEvidenceRegistry() external view returns (address) {
        return _evidenceRegistry;
    }

    function _requireEvidenceRegistry() private view {
        if (_evidenceRegistry != msg.sender) {
            revert NorFromEvidenceRegistry(msg.sender);
        }
    }

    function _hash2(bytes32 element1_, bytes32 element2_) private pure returns (bytes32) {
        return PoseidonUnit2L.poseidon([element1_, element2_]);
    }

    function _hash3(
        bytes32 element1_,
        bytes32 element2_,
        bytes32 element3_
    ) private pure returns (bytes32) {
        return bytes32(PoseidonUnit3L.poseidon([element1_, element2_, element3_]));
    }
}
