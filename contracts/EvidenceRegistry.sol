// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.21;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {IEvidenceDB} from "./interfaces/IEvidenceDB.sol";
import {IEvidenceRegistry} from "./interfaces/IEvidenceRegistry.sol";

import {PoseidonUnit2L} from "./libraries/Poseidon.sol";

contract EvidenceRegistry is IEvidenceRegistry, Initializable {
    uint256 public constant BABY_JUB_JUB_PRIME_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IEvidenceDB private _evidenceDB;

    mapping(bytes32 => uint256) private _rootTimestamps;

    modifier onlyInPrimeField(bytes32 key) {
        _requireInPrimeField(key);
        _;
    }

    modifier onRootUpdate() {
        bytes32 prevRoot_ = _evidenceDB.getRoot();
        _rootTimestamps[prevRoot_] = block.timestamp;
        _;
        emit RootUpdated(prevRoot_, _evidenceDB.getRoot());
    }

    function __EvidenceRegistry_init(address evidenceDB_) external initializer {
        _evidenceDB = IEvidenceDB(evidenceDB_);
    }

    /**
     * @inheritdoc IEvidenceRegistry
     */
    function addStatement(
        bytes32 key_,
        bytes32 value_
    ) external onlyInPrimeField(key_) onlyInPrimeField(value_) onRootUpdate {
        bytes32 isolatedKey_ = getIsolatedKey(msg.sender, key_);

        if (_evidenceDB.getValue(isolatedKey_) != bytes32(0)) {
            revert KeyAlreadyExists(key_);
        }

        _evidenceDB.add(isolatedKey_, value_);
    }

    /**
     * @inheritdoc IEvidenceRegistry
     */
    function removeStatement(bytes32 key_) external onlyInPrimeField(key_) onRootUpdate {
        bytes32 isolatedKey_ = getIsolatedKey(msg.sender, key_);

        if (_evidenceDB.getValue(isolatedKey_) == bytes32(0)) {
            revert KeyDoesNotExist(key_);
        }

        _evidenceDB.remove(isolatedKey_);
    }

    /**
     * @inheritdoc IEvidenceRegistry
     */
    function updateStatement(
        bytes32 key_,
        bytes32 newValue_
    ) external onlyInPrimeField(key_) onlyInPrimeField(newValue_) onRootUpdate {
        bytes32 isolatedKey_ = getIsolatedKey(msg.sender, key_);

        if (_evidenceDB.getValue(isolatedKey_) == bytes32(0)) {
            revert KeyDoesNotExist(key_);
        }

        _evidenceDB.update(isolatedKey_, newValue_);
    }

    /**
     * @inheritdoc IEvidenceRegistry
     */
    function getRootTimestamp(bytes32 root_) external view returns (uint256) {
        if (root_ == bytes32(0)) {
            return 0;
        }

        if (root_ == _evidenceDB.getRoot()) {
            return block.timestamp;
        }

        return _rootTimestamps[root_];
    }

    /**
     * @inheritdoc IEvidenceRegistry
     */
    function getIsolatedKey(address source_, bytes32 key_) public pure returns (bytes32) {
        return PoseidonUnit2L.poseidon([bytes32(uint256(uint160(source_))), key_]);
    }

    function getEvidenceDB() external view returns (address) {
        return address(_evidenceDB);
    }

    function _requireInPrimeField(bytes32 key_) private pure {
        if (uint256(key_) >= BABY_JUB_JUB_PRIME_FIELD) {
            revert NumberNotInPrimeField(key_);
        }
    }
}
