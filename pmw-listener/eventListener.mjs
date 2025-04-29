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

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  captureErrorWithContext(reason, "Unhandled Rejection");
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  captureErrorWithContext(err, "Uncaught Exception");
});

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

const ws = provider._websocket;

ws.on("open", () => {
  console.log("🔗 WebSocket connection established");

  setInterval(() => {
    if (ws.readyState === 1) {
      try {
        ws.ping?.();
        console.log("📡 Sent ping to keep WebSocket alive");
      } catch (err) {
        console.error("Ping error:", err);
        captureErrorWithContext(err, "WebSocket Ping Error");
      }
    }
  }, 5 * 60 * 1000);
});

ws.on("close", (code, reason) => {
  console.error(
    `❌ WebSocket closed (code: ${code}, reason: ${reason}). Exiting...`
  );
  captureErrorWithContext(
    new Error(`WebSocket closed: ${code} ${reason}`),
    "WebSocket Close"
  );
  process.exit(1);
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err);
  captureErrorWithContext(err, "WebSocket Error");
  process.exit(1);
});
