import { Deployer, Reporter } from "@solarity/hardhat-migrate";

import { deployPoseidons } from "@/deploy/helpers/helper";

import { EvidenceDB__factory, EvidenceRegistry__factory } from "@ethers-v6";

export = async (deployer: Deployer) => {
  await deployPoseidons(deployer, [2, 3]);

  const evidenceDB = await deployer.deploy(EvidenceDB__factory);
  const evidenceRegistry = await deployer.deploy(EvidenceRegistry__factory);

  await evidenceDB.__EvidenceDB_init(await evidenceRegistry.getAddress(), 80);
  await evidenceRegistry.__EvidenceRegistry_init(await evidenceDB.getAddress());

  Reporter.reportContracts(
    ["EvidenceDB", await evidenceDB.getAddress()],
    ["EvidenceRegistry", await evidenceRegistry.getAddress()],
  );
};