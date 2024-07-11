import * as cron from "node-cron";
import mongoose from "mongoose";
import { fetchContributions as fetchEra1Contributions } from "./crons/era-1-cron.mjs";
import { fetchContributions as fetchEra2Contributions } from "./crons/era-2-cron.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

cron.schedule("*/5 * * * *", () => {
  console.log("Cron Ran for Era-1");
  fetchEra1Contributions("base");
  fetchEra1Contributions("pulsechain");
});

cron.schedule("*/5 * * * *", () => {
  console.log("Cron Ran for Era-2");
  fetchEra2Contributions("base");
  fetchEra2Contributions("pulsechain");
});

setInterval(() => {}, 1000);
