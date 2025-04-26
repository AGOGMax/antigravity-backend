import AWS from "aws-sdk";
import { ethers } from "ethers";
import * as Sentry from "@sentry/node";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

Sentry.init({
  dsn: secrets?.SENTRY_DSN_URL,
  tracesSampleRate: 1.0,
});

const captureErrorWithContext = (error, contextMessage) => {
  Sentry.withScope((scope) => {
    scope.setExtra("contextMessage", contextMessage);
    Sentry.captureException(error);
  });
};

const lambda = new AWS.Lambda({ region: "us-east-1" });
const provider = new ethers.WebSocketProvider(secrets?.ERA_3_RPC_URL);
const ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "roundId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "usersLength",
        type: "uint256",
      },
    ],
    name: "Randomise",
    type: "event",
  },
];

const contract = new ethers.Contract(
  secrets?.PMW_CONTRACT_ADDRESS,
  ABI,
  provider
);

console.log("🎧 Listening for 'randomise' events...");

contract.on("Randomise", async (roundId, numEntrants) => {
  console.log(
    `📡 Event detected: roundId = ${roundId}, numEntrants = ${numEntrants}`
  );

  try {
    const result = await lambda
      .invoke({
        FunctionName: secrets?.PMW_KEEPER_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({}),
      })
      .promise();

    console.log("✅ Lambda triggered:", result.StatusCode);
  } catch (err) {
    console.error("❌ Error calling Lambda:", err);
    captureErrorWithContext(err, "PMW Listener: Lambda Invoke Error");
  }
});
