import { expect } from "chai";
import { ethers, zkit } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { getIsolatedKey, getPoseidon, poseidonHash, Reverter } from "@test-helpers";

import { EvidenceDB, EvidenceRegistry } from "@ethers-v6";

import { EvidenceRegistrySMT } from "@/generated-types/zkit";

describe("EvidenceRegistrySMT", () => {
  const reverter = new Reverter();

  const MERKLE_TREE_DEPTH = 80;

  let evidenceRegistrySMTCircuit: EvidenceRegistrySMT;

  let USER: SignerWithAddress;

  let evidenceDB: EvidenceDB;
  let evidenceRegistry: EvidenceRegistry;

  before(async () => {
    [USER] = await ethers.getSigners();

    evidenceRegistrySMTCircuit = await zkit.getCircuit("EvidenceRegistrySMT");

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

  afterEach(reverter.revert);

  it("should verify the proof", async () => {
    const key = ethers.toBeHex(ethers.hexlify(ethers.randomBytes(28)), 32);
    const value = poseidonHash(key);

    await evidenceRegistry.addStatement(key, value);

    const smtProof = await evidenceDB.getProof(getIsolatedKey(USER.address, key));

    expect(smtProof.existence).to.be.true;
    expect(smtProof.auxExistence).to.be.false;

    const zkpProof = await evidenceRegistrySMTCircuit.generateProof({
      root: BigInt(smtProof.root),
      address: BigInt(USER.address),
      key: BigInt(key),
      value: BigInt(value),
      siblings: smtProof.siblings.map((sibling) => BigInt(sibling)),
      auxKey: BigInt(smtProof.auxKey),
      auxValue: BigInt(smtProof.auxValue),
      auxIsEmpty: BigInt(smtProof.auxExistence),
      isExclusion: BigInt(0),
    });

    expect(await evidenceRegistrySMTCircuit.verifyProof(zkpProof)).to.be.true;

    const solidityVerifier = await ethers.deployContract("EvidenceRegistrySMTVerifier");

    await expect(evidenceRegistrySMTCircuit).to.useSolidityVerifier(solidityVerifier).to.verifyProof(zkpProof);
  });
});
