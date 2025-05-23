import { ethers } from "ethers";
import darkPayoutCalculatorAbi from "../abi/darkPayoutCalculatorAbi.json" assert { type: "json" };
import darkAbi from "../abi/darkAbi.json" assert { type: "json" };
import journeyPhaseManagerAbi from "../abi/journeyPhaseManagerAbi.json" assert { type: "json" };
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

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
