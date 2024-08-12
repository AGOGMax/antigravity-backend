import { ethers } from "ethers";
import { wagmiAbi } from "./abi.mjs";
import {
  contributionsModel,
  era3TimestampsModel,
  pointsModel,
} from "../models/models.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import {
  generateEra3Points,
  modifyEra3Contributions,
} from "../../helpers/helper.mjs";
import axios from "axios";

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
        mints(orderDirection: desc, orderBy: transactionHash) {
          amount
          id
          timestamp
          transactionHash
          user {
            address
          }
        }
      }
    `;

  const response = await axios.post(
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

  const contributions = response?.data?.data?.mints;

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

  const era3Timestamps = await era3TimestampsModel.findOne({
    identifier: "era3Timestamps",
  });

  const currentJourney = era3Timestamps?.currentJourney;

  const pointsList = await generateEra3Points(
    insertedContributions,
    era2Contributors,
    currentJourney
  );
  console.log("Era 3 Points List: ", pointsList);

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }
};
