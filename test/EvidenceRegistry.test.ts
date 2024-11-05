import { expect } from "chai";
import { ethers } from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { getPoseidon, poseidonHash, Reverter, getIsolatedKey } from "@test-helpers";

import { EvidenceDB, EvidenceRegistry } from "@ethers-v6";

describe("EvidenceRegistry", () => {
  const reverter = new Reverter();

  const BABY_JUB_JUB_PRIME_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

  const MERKLE_TREE_DEPTH = 20;

  let USER: SignerWithAddress;

  let evidenceDB: EvidenceDB;
  let evidenceRegistry: EvidenceRegistry;

  before("setup", async () => {
    [USER] = await ethers.getSigners();

    const EvidenceDB = await ethers.getContractFactory("EvidenceDB", {
      libraries: {
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
        PoseidonUnit3L: await (await getPoseidon(3)).getAddress(),
      },
    });
    evidenceDB = await EvidenceDB.deploy();
    const EvidenceRegistry = await ethers.getContractFactory("EvidenceRegistry", {
      libraries: {
        PoseidonUnit2L: await (await getPoseidon(2)).getAddress(),
      },
    });
    evidenceRegistry = await EvidenceRegistry.deploy();

    await evidenceDB.__EvidenceDB_init(await evidenceRegistry.getAddress(), MERKLE_TREE_DEPTH);
    await evidenceRegistry.__EvidenceRegistry_init(await evidenceDB.getAddress());

    await reverter.snapshot();
  });

  afterEach("cleanup", async () => {
    await reverter.revert();
  });

  describe("#Initialization", () => {
    it("should revert if trying to initialize twice", async () => {
      await expect(evidenceRegistry.__EvidenceRegistry_init(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(evidenceRegistry, "InvalidInitialization")
        .withArgs();
    });

    it("should correctly initialize the tree", async () => {
      expect(await evidenceRegistry.getEvidenceDB()).to.equal(await evidenceDB.getAddress());
    });
  });

  describe("#Basic functionality", () => {
    it("should revert if trying to add/remove/update key (value) that is not in the Prime Field", async () => {
      await expect(evidenceRegistry.addStatement(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n), ethers.ZeroHash))
        .to.be.revertedWithCustomError(evidenceRegistry, "NumberNotInPrimeField")
        .withArgs(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n));
      await expect(evidenceRegistry.addStatement(ethers.ZeroHash, ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n)))
        .to.be.revertedWithCustomError(evidenceRegistry, "NumberNotInPrimeField")
        .withArgs(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n));

      await expect(evidenceRegistry.removeStatement(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n)))
        .to.be.revertedWithCustomError(evidenceRegistry, "NumberNotInPrimeField")
        .withArgs(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n));

      await expect(evidenceRegistry.updateStatement(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n), ethers.ZeroHash))
        .to.be.revertedWithCustomError(evidenceRegistry, "NumberNotInPrimeField")
        .withArgs(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n));
      await expect(evidenceRegistry.updateStatement(ethers.ZeroHash, ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n)))
        .to.be.revertedWithCustomError(evidenceRegistry, "NumberNotInPrimeField")
        .withArgs(ethers.toBeHex(BABY_JUB_JUB_PRIME_FIELD + 1n));
    });

    it("should add statement and store root's renewal timestamp", async () => {
      const key = ethers.ZeroHash;
      const value = poseidonHash(key);

      await evidenceRegistry.addStatement(key, value);

      expect(await evidenceDB.getValue(getIsolatedKey(USER.address, key))).to.be.equal(value);
      expect(await evidenceRegistry.getRootTimestamp(await evidenceDB.getRoot())).to.be.equal(await time.latest());
    });

    it("should revert if trying to add statement that already exists", async () => {
      const key = ethers.ZeroHash;
      const value = poseidonHash(key);

      await evidenceRegistry.addStatement(key, value);

      await expect(evidenceRegistry.addStatement(key, value))
        .to.be.revertedWithCustomError(evidenceRegistry, "KeyAlreadyExists")
        .withArgs(key);
    });

    it("should remove statement and store root's renewal timestamp", async () => {
      const key = ethers.ZeroHash;
      const value = poseidonHash(key);

      await evidenceRegistry.addStatement(key, value);
      await evidenceRegistry.removeStatement(key);

      expect(await evidenceDB.getValue(getIsolatedKey(USER.address, key))).to.be.equal(ethers.ZeroHash);
      expect(await evidenceRegistry.getRootTimestamp(await evidenceDB.getRoot())).to.be.equal(0);
    });

    it("should revert if trying to remove statement that does not exist", async () => {
      const key = ethers.ZeroHash;

      await expect(evidenceRegistry.removeStatement(key))
        .to.be.revertedWithCustomError(evidenceRegistry, "KeyDoesNotExist")
        .withArgs(key);
    });

    it("should update statement and store root's renewal timestamp", async () => {
      const key = ethers.ZeroHash;
      const value = poseidonHash(key);

      await evidenceRegistry.addStatement(key, value);

      expect(await evidenceDB.getValue(getIsolatedKey(USER.address, key))).to.be.equal(value);

      const newValue = poseidonHash(value);
      await evidenceRegistry.updateStatement(key, newValue);

      expect(await evidenceDB.getValue(getIsolatedKey(USER.address, key))).to.be.equal(newValue);
      expect(await evidenceRegistry.getRootTimestamp(await evidenceDB.getRoot())).to.be.equal(await time.latest());
    });

    it("should get correct root timestamp", async () => {
      expect(await evidenceRegistry.getRootTimestamp(ethers.ZeroHash)).to.be.equal(0);

      const key = ethers.ZeroHash;
      const value = poseidonHash(key);

      await evidenceRegistry.addStatement(key, value);

      const rootWhenKeyAdded = await evidenceDB.getRoot();

      await evidenceRegistry.addStatement(value, value);

      const keyAddTimestamp = await time.latest();

      expect(await evidenceRegistry.getRootTimestamp(await evidenceDB.getRoot())).to.be.equal(await time.latest());

      await time.increase(1000);

      expect(await evidenceRegistry.getRootTimestamp(rootWhenKeyAdded)).to.be.equal(keyAddTimestamp);
      expect(await evidenceRegistry.getRootTimestamp(await evidenceDB.getRoot())).to.be.equal(await time.latest());
    });

    it("should revert if trying to update statement that does not exist", async () => {
      const key = ethers.ZeroHash;
      const value = poseidonHash(key);

      await expect(evidenceRegistry.updateStatement(key, value))
        .to.be.revertedWithCustomError(evidenceRegistry, "KeyDoesNotExist")
        .withArgs(key);
    });
  });
});
