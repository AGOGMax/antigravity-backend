import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const darkPayoutCalculatorAbi = JSON.parse(
  readFileSync(new URL("../abi/darkPayoutCalculatorAbi.json", import.meta.url))
);
const darkAbi = JSON.parse(
  readFileSync(new URL("../abi/darkAbi.json", import.meta.url))
);
const journeyPhaseManagerAbi = JSON.parse(
  readFileSync(new URL("../abi/journeyPhaseManagerAbi.json", import.meta.url))
);

const secrets = await fetchSecretsList();

const provider = new ethers.JsonRpcProvider(secrets?.ERA_3_RPC_URL);

const darkPayoutCalculatorContract = new ethers.Contract(
  secrets?.DARK_PAYOUT_CALCULATOR_CONTRACT_ADDRESS,
  darkPayoutCalculatorAbi,
  provider
);

const journeyPhaseManagerContract = new ethers.Contract(
  secrets?.ERA_3_JOURNEY_PHASE_MANAGER_CONTRACT_ADDRESS,
  journeyPhaseManagerAbi,
  provider
);

const darkContract = new ethers.Contract(
  secrets?.DARK_CONTRACT_ADDRESS,
  darkAbi,
  provider
);

export {
  darkPayoutCalculatorContract,
  journeyPhaseManagerContract,
  darkContract,
};
