import AWS from "aws-sdk";
import { ethers } from "ethers";
import * as Sentry from "@sentry/node";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();
const EXPECTED_PONG_BACK = 15000;
const KEEP_ALIVE_CHECK_INTERVAL = 7500;

const environment = process.env.ENV || "TEST";

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

Sentry.init({
  dsn: secrets?.SENTRY_DSN_URL,
  tracesSampleRate: 0.3,
  enabled: environment === "PRODUCTION",
  environment: environment,
});

const captureErrorWithContext = (error, contextMessage) => {
  Sentry.withScope((scope) => {
    scope.setExtra("contextMessage", contextMessage);
    Sentry.captureException(error);
  });
};

const startConnection = () => {
  const provider = new ethers.providers.WebSocketProvider(
    secrets?.ERA_3_RPC_URL
  );

  const contract = new ethers.Contract(
    secrets?.PMW_CONTRACT_ADDRESS,
    ABI,
    provider
  );

  const lambda = new AWS.Lambda({ region: "us-east-1" });

  console.log("🎧 Listening for 'randomise' events...");

  let pingTimeout = null;
  let keepAliveInterval = null;

  provider._websocket.on("open", () => {
    console.log("🔗 WebSocket connection established");
    keepAliveInterval = setInterval(() => {
      console.log("📡 Sent ping to keep WebSocket alive");

      provider._websocket.ping();

      pingTimeout = setTimeout(() => {
        provider._websocket.terminate();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);

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
  });

  provider._websocket.on("close", (code, reason) => {
    console.error(
      `❌ WebSocket closed (code: ${code}, reason: ${reason}). Exiting...`
    );
    captureErrorWithContext(
      new Error(`WebSocket closed: ${code} ${reason}`),
      "WebSocket Close"
    );
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startConnection();
  });

  provider._websocket.on("pong", () => {
    console.log("📶 Received pong");
    clearInterval(pingTimeout);
  });
};

startConnection();
