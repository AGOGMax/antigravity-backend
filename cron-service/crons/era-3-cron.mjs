import { ethers } from "ethers";
import { wagmiAbi } from "./abi.mjs";
import {
  contributionsModel,
  era3TimestampsModel,
  pointsModel,
  lotteryEntriesModel,
  transfersCronTimestampModel,
  lotteryResultsModel,
} from "../models/models.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import {
  fetchPrunedTokenIds,
  generateEra3Points,
  modifyEra3Contributions,
} from "../../helpers/helper.mjs";
import axios from "axios";
import schedule from "node-schedule";
import { chunkArray } from "../../helpers/helper.mjs";
import { captureErrorWithContext } from "../start-crons.mjs";

const secrets = await fetchSecretsList();

export const updateTimestampsFromContract = async () => {
  const chain1Provider = new ethers.JsonRpcProvider(secrets?.ERA_3_RPC_URL);
  const chain1Contract = new ethers.Contract(
    secrets?.ERA_3_JOURNEY_PHASE_MANAGER_CONTRACT_ADDRESS,
    wagmiAbi,
    chain1Provider
  );

  const currentJourney = Number(await chain1Contract.currentJourney());
  const currentPhase = Number(await chain1Contract.currentPhase());
  const nextJourneyTimestamp = Number(
    await chain1Contract.getNextJourneyTimestamp()
  );
  const nextPhaseTimestamp = Number(
    await chain1Contract.getNextPhaseTimestamp()
  );
  const isJourneyPaused = await chain1Contract.paused();

  await era3TimestampsModel.findOneAndUpdate(
    { identifier: "era3Timestamps" },
    {
      currentJourney: currentJourney,
      currentPhase: currentPhase,
      nextJourneyTimestamp: nextJourneyTimestamp,
      nextPhaseTimestamp: nextPhaseTimestamp,
      isJourneyPaused: isJourneyPaused,
    },
    {
      upsert: true,
      new: true,
    }
  );
};

export const fetchContributions = async () => {
  const dbContributions = await contributionsModel.find({ era: 3 });
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  const contributionsQuery = `
    query MyQuery {
        mints(orderDirection: "desc", orderBy: "transactionHash") {
          items{
            amount
            id
            timestamp
            transactionHash
            journeyId
            user {
              address
            }
          }
        }
      }
    `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: contributionsQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error(
      "Cron Service: Error while fetching mints from subgraph: ",
      e
    );
    captureErrorWithContext(
      e,
      "Cron Service: Error while fetching mints from subgraph."
    );
  }

  const contributions = response?.data?.data?.mints?.items;

  const newContributions = contributions.filter(
    (contribution) => !dbTransactionHashes.has(contribution.transactionHash)
  );

  const modifiedContributions = modifyEra3Contributions(newContributions);

  const insertedContributions = await contributionsModel.insertMany(
    modifiedContributions
  );

  console.log("Era 3 Inserted Contributions: ", insertedContributions);

  const era2ContributorsQuery = await contributionsModel
    .aggregate([
      { $match: { era: 2, darkXTokenAmount: { $gt: 0 } } },
      { $group: { _id: "$walletAddress" } },
    ])
    .exec();

  const era2Contributors = era2ContributorsQuery.map(
    (contribution) => contribution._id
  );

  const pointsList = await generateEra3Points(
    insertedContributions,
    era2Contributors
  );
  console.log("Era 3 Points List: ", pointsList);

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }
};

export const updateTimestampsIfPaused = async () => {
  const subgraphQuery = `
  query MyQuery {
    journeyPhaseManagers {
      items {
        isPaused
        id
        recentPauseStartTime
      }
    }
  }
    `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: subgraphQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("Cron Service: Error while fetching JPM from subgraph: ", e);
    captureErrorWithContext(
      e,
      "Cron Service: Error while fetching JPM from subgraph."
    );
  }

  const journeyPhaseManager =
    response?.data?.data?.journeyPhaseManagers?.items?.[0];

  const isJourneyPaused = journeyPhaseManager?.isPaused;
  const recentPauseStartTime = journeyPhaseManager?.recentPauseStartTime;
  if (isJourneyPaused) {
    const epochRecentPauseStartTime = parseInt(recentPauseStartTime, 10) * 1000;
    const currentTime = Date.now();
    const timeDifference =
      (currentTime - epochRecentPauseStartTime) / (1000 * 60);
    if (timeDifference < 3) {
      updateTimestampsFromContract();
    }
  }
};

export const scheduleTimestampUpdates = async () => {
  const nextJourneyTimestamp = (
    await era3TimestampsModel.findOne({
      identifier: "era3Timestamps",
    })
  )?.nextJourneyTimestamp;

  const nextJourneyTimestampInMilliseconds = nextJourneyTimestamp * 1000;

  const existingJobs = schedule.scheduledJobs;
  const existingJobsTimestamps = [];
  for (const jobName in existingJobs) {
    const job = existingJobs[jobName];
    const nextInvocation = job.nextInvocation();

    if (nextInvocation) {
      const nextInvocationTimestamp = nextInvocation.getTime();
      existingJobsTimestamps.push(nextInvocationTimestamp);
    }
  }

  if (!existingJobsTimestamps.includes(nextJourneyTimestampInMilliseconds)) {
    const scheduleDate = new Date(nextJourneyTimestampInMilliseconds);
    schedule.scheduleJob(scheduleDate, updateTimestampsFromContract);
  }
};

export const pruneTokenIds = async () => {
  const unprunedTokens = await lotteryEntriesModel.find({ isPruned: false });
  const tokenIds = unprunedTokens.map((token) => token.tokenId);

  const tokenIdsBatches = chunkArray(tokenIds, 900);

  let prunedTokenIds = [];
  for (const batch of tokenIdsBatches) {
    const updatedBatch = await fetchPrunedTokenIds(batch);
    prunedTokenIds = [...prunedTokenIds, ...updatedBatch];
  }

  await lotteryEntriesModel.updateMany(
    { tokenId: { $in: prunedTokenIds } },
    { $set: { isPruned: true } }
  );
};

export const updateRecentTransfersAddress = async () => {
  const lastTimestamp = (
    await transfersCronTimestampModel.find({
      identification: "recentTransferTimestamp",
    })
  )?.[0]?.timestamp;

  const transfersQuery = lastTimestamp
    ? `
    query MyQuery {
      transfers(where: {timestamp_gte: "${lastTimestamp}"}) {
        items{
          from {
            address
          }
          token {
            tokenId
          }
          to {
            address
          }
        }
      }
    }
  `
    : `
    query MyQuery {
      transfers {
        items {
          from {
            address
          }
          token {
            tokenId
          }
          to {
            address
          }
        }
      }
    }
  `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: transfersQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.log(
      "Cron Service: Error while fetching recent transfers from subgraph: ",
      e
    );
    captureErrorWithContext(
      e,
      "Cron Service: Error while fetching recent transfers from subgraph."
    );
  }

  const transfers = response.data?.data?.transfers?.items;
  const bulkOperations = transfers?.map((transfer) => {
    const { tokenId } = transfer.token;
    const newWalletAddress = transfer.to.address;

    return {
      updateMany: {
        filter: { tokenId: parseInt(tokenId) },
        update: { $set: { walletAddress: newWalletAddress } },
      },
    };
  });

  await lotteryEntriesModel.bulkWrite(bulkOperations);

  await transfersCronTimestampModel.findOneAndUpdate(
    { identification: "recentTransferTimestamp" },
    { timestamp: parseInt(Date.now() / 1000) - 180 }, //Subtract 3 minutes as a buffer for cron run time.
    {
      upsert: true,
      new: true,
    }
  );
};

export const saveMissedLotteryResults = async () => {
  const existingResults = await lotteryResultsModel.find({});
  const existingResultsUri = existingResults.map((result) => result.uri);

  const missedLotteryResultsQuery = `
    query MyQuery {
      lotteryResults(where: {uri_not_in: [${existingResultsUri
        .map((uri) => `"${uri}"`)
        .join(", ")}]}) {
          items{
            uri
          }
      }
    }
  `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: missedLotteryResultsQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.log(
      "Error while fetching missed lottery results from subgraph: ",
      e
    );
    captureErrorWithContext(
      e,
      "Error while fetching missed lottery results from subgraph."
    );
  }

  const missedLotteryResults = response.data?.data?.lotteryResults?.items?.map(
    (lotteryResult) => lotteryResult.uri
  );

  for (const url of missedLotteryResults) {
    let lotteryData = {};
    try {
      lotteryData = (await axios.get(url))?.data;
    } catch (e) {
      console.error(
        `Cron Service: Error while fetching lottery data from URI: ${url}: ${e}`
      );
      captureErrorWithContext(
        e,
        `Cron Service: Error while fetching lottery data from URI: ${url}`
      );
    }

    try {
      await axios.post(
        `${secrets?.MASTER_SERVICE_URL}/api/lottery-result`,
        lotteryData
      );
    } catch (e) {
      console.error(`Cron Service: Error while posting lottery data: ${e}`);
      captureErrorWithContext(
        e,
        `Cron Service: Error while posting lottery data: ${url}`
      );
    }
  }
};
