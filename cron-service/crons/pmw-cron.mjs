import axios from "axios";
import { createClient } from "redis";
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

export const fetchPiteasCalldata = async () => {
  let response = {};
  const redisKey = `${environment}:api:piteasquote`;
  try {
    response = await axios.get(secrets?.PITEAS_QUOTE_URL);
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
