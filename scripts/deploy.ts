import { ethers } from "hardhat";
import hre from "hardhat";

const { poseidonContract } = require("circomlibjs");

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const deployer = "0x4e59b44847b379578588920ca78fbf26c0b4956c";
const evidenceRegistrySalt = "0x9a533395526948e0860194b5dbd307de82d332d7fb268e02659096f3c904bf9f";
const poseidonSalt = "0x7812781278127812781278127812781278127812781278127812781278127812";

async function deploy(signer: HardhatEthersSigner, salt: string, initcode: string): Promise<string> {
  const initcodeHash = ethers.keccak256(initcode);
  const txData = {
    to: deployer,
    data: salt + initcode.replace("0x", ""),
  };

  const tx = await signer.sendTransaction(txData);
  await tx.wait();

  return ethers.getCreate2Address(deployer, salt, initcodeHash);
}

async function deployPoseidons(signer: HardhatEthersSigner): Promise<string[]> {
  const addresses = [];
  const poseidonInitcodes = [poseidonContract.createCode(2), poseidonContract.createCode(3)];

  for (let i = 0; i < poseidonInitcodes.length; i++) {
    addresses.push(await deploy(signer, poseidonSalt, poseidonInitcodes[i]));
  }

  return addresses;
}

async function deployRegistry(signer: HardhatEthersSigner, poseidons: string[]): Promise<string[]> {
  const addresses = [];
  let dbInitcode = hre.artifacts.readArtifactSync("EvidenceDB").bytecode;
  let registryInitcode = hre.artifacts.readArtifactSync("EvidenceRegistry").bytecode;

  dbInitcode = dbInitcode.replace("__$fd835ae95726e2da80b3c026db35133873$__", poseidons[0].replace("0x", ""));
  dbInitcode = dbInitcode.replace("__$e42d85122f6128c9a7dd8478ad2c48bccc$__", poseidons[1].replace("0x", ""));

  registryInitcode = registryInitcode.replace(
    "__$fd835ae95726e2da80b3c026db35133873$__",
    poseidons[0].replace("0x", ""),
  );

  addresses.push(await deploy(signer, evidenceRegistrySalt, dbInitcode));
  addresses.push(await deploy(signer, evidenceRegistrySalt, registryInitcode));

  return addresses;
}

async function init(addresses: string[]) {
  const db = await ethers.getContractAt("EvidenceDB", addresses[0]);
  const registry = await ethers.getContractAt("EvidenceRegistry", addresses[1]);

  await db.__EvidenceDB_init(await registry.getAddress(), 80);
  await registry.__EvidenceRegistry_init(await db.getAddress());

  console.log("REGISTRY", await registry.getAddress());
  console.log("DB", await db.getAddress());
}

async function main() {
  const [signer] = await ethers.getSigners();

  const poseidons = await deployPoseidons(signer);
  const addresses = await deployRegistry(signer, poseidons);

  await init(addresses);
}

main()
  .then()
  .catch((e) => console.log(e));
