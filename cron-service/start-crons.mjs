import * as cron from "node-cron";
import mongoose from "mongoose";
import { fetchContributions as fetchEra1Contributions } from "./crons/era-1-cron.mjs";
import { fetchContributions as fetchEra2Contributions } from "./crons/era-2-cron.mjs";
import {
  fetchContributions as fetchEra3Contributions,
  updateTimestampsIfPaused,
  scheduleTimestampUpdates,
  updateTimestampsFromContract,
} from "./crons/era-3-cron.mjs";
import { invokeEra1Keeper } from "./crons/era-1-keeper.mjs";
import { invokeEra2Keeper } from "./crons/era-2-keeper.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import schedule from "node-schedule";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

Sentry.init({
  dsn: secrets?.SENTRY_DSN_URL,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

const captureErrorWithContext = (error, contextMessage) => {
  Sentry.withScope((scope) => {
    scope.setExtra("contextMessage", contextMessage);
    Sentry.captureException(error);
  });
};

cron.schedule("*/2 * * * *", () => {
  console.log("Cron Ran for Era-1");
  try {
    fetchEra1Contributions("base");
    fetchEra1Contributions("pulsechain");
  } catch (e) {
    captureErrorWithContext(e, "Error while running era 1 cron.");
  }
});

cron.schedule("*/2 * * * *", () => {
  console.log("Cron Ran for Era-2");
  try {
    fetchEra2Contributions("base");
    fetchEra2Contributions("pulsechain");
  } catch (e) {
    captureErrorWithContext(e, "Error while running era 2 cron.");
  }
});

cron.schedule("*/15 * * * *", () => {
  console.log("Cron Ran for Era 1 Keeper");
  try {
    invokeEra1Keeper();
  } catch (e) {
    captureErrorWithContext(e, "Error while running era 1 keeper.");
  }
});

cron.schedule("0 */6 * * *", () => {
  console.log("Cron Ran for Era 3 Timestamps from Contract");
  try {
    updateTimestampsFromContract();
  } catch (e) {
    captureErrorWithContext(
      e,
      "Error while running update timestamps from contract cron."
    );
  }
});

cron.schedule("*/2 * * * *", () => {
  console.log("Cron Ran for Era-3");
  try {
    fetchEra3Contributions();
  } catch (e) {
    captureErrorWithContext(e, "Error while running era 3 contributions cron.");
  }
});

cron.schedule("*/2 * * * *", () => {
  console.log("Cron Ran for Era-3: Check for Paused Journey from Subgraph");
  try {
    updateTimestampsIfPaused();
  } catch (e) {
    captureErrorWithContext(
      e,
      "Error while running timestamps from subgraph cron."
    );
  }
});

cron.schedule("0 */6 * * *", () => {
  console.log("Cron Ran for scheduling timestamp update for journeys");
  try {
    scheduleTimestampUpdates();
  } catch (e) {
    captureErrorWithContext(e, "Error while running timestamp scheduler cron.");
  }
});

const era2KeeperDate = new Date(parseInt(secrets?.ERA_2_KEEPER_TIMESTAMP));
schedule.scheduleJob(era2KeeperDate, invokeEra2Keeper);

setInterval(() => {}, 1000);

updateTimestampsFromContract();

export { captureErrorWithContext };
