import axios from "axios";
import { createClient } from "redis";
import { ethers } from "ethers";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { captureErrorWithContext } from "../start-crons.mjs";

const secrets = await fetchSecretsList();
const environment = process.env.ENV || "TEST";

const redisClient = createClient({
  username: "default",
  password: secrets?.REDIS_PASSWORD,
  socket: {
    host: secrets?.REDIS_HOST,
    port: 19946,
  },
});

redisClient.on("error", (err) => console.log("Redis Client Error ❌", err));
await redisClient.connect();

const provider = new ethers.JsonRpcProvider(secrets?.ERA_3_RPC_URL);
const CONTRACT_ABI = [
  {
    inputs: [],
    name: "TICKET_PRICE",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_ENTRIES",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const readContract = async () => {
  const contract = new ethers.Contract(
    secrets?.PMW_CONTRACT_ADDRESS,
    CONTRACT_ABI,
    provider
  );

  const maxEntries = await contract.MAX_ENTRIES();
  const ticketPrice = await contract.TICKET_PRICE();

  return { maxEntries, ticketPrice };
};

export const fetchPiteasCalldata = async () => {
  let response = {};
  const redisKey = `${environment}:api:piteasquote`;

  const contractAddress = secrets?.PMW_CONTRACT_ADDRESS;
  const { maxEntries, ticketPrice } = await readContract();
  const swapAmount = (maxEntries * ticketPrice * 80n) / 100n;
  const piteasURL = `https://sdk.piteas.io/quote?tokenInAddress=0xefD766cCb38EaF1dfd701853BFCe31359239F305&tokenOutAddress=0x1578F4De7fCb3Ac9e8925ac690228EDcA3BBc7c5&amount=${swapAmount}&allowedSlippage=1.50&account=${contractAddress}`;
  try {
    response = await axios.get(piteasURL);
    if (response.status === 200) {
      const callData = response.data?.methodParameters?.calldata || "0x";
      await redisClient.set(redisKey, callData);
    } else {
      const error = new Error(`Unexpected response status: ${response.status}`);
      console.error("Cron Service: Non-200 status code: ", response.status);
      captureErrorWithContext(
        error,
        "Cron Service: Non-200 status code received."
      );
    }
  } catch (e) {
    console.error("Cron Service: Error while fetching piteas call data: ", e);
    captureErrorWithContext(
      e,
      "Cron Service: Error while fetching piteas call data."
    );
  }
};
