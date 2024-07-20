import * as cron from "node-cron";
import mongoose from "mongoose";
import { fetchContributions as fetchEra1Contributions } from "./crons/era-1-cron.mjs";
import { fetchContributions as fetchEra2Contributions } from "./crons/era-2-cron.mjs";
import { invokeEra1Keeper } from "./crons/era-1-keeper.mjs";
import { invokeEra2Keeper } from "./crons/era-2-keeper.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import schedule from "node-schedule";

const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

cron.schedule("*/2 * * * *", () => {
  console.log("Cron Ran for Era-1");
  fetchEra1Contributions("base");
  fetchEra1Contributions("pulsechain");
});

cron.schedule("*/2 * * * *", () => {
  console.log("Cron Ran for Era-2");
  fetchEra2Contributions("base");
  fetchEra2Contributions("pulsechain");
});

cron.schedule("*/15 * * * *", () => {
  console.log("Cron Ran for Era 1 Keeper");
  invokeEra1Keeper();
});

const era2KeeperDate = new Date(parseInt(secrets?.ERA_2_KEEPER_TIMESTAMP));
schedule.scheduleJob(era2KeeperDate, invokeEra2Keeper);

setInterval(() => {}, 1000);
