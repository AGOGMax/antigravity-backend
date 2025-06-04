import { getEra3Multiplier } from "../../helpers/helper.mjs";
import { contributionsModel } from "../models/models.mjs";
import { fetchEra1ContributorsFromS3 } from "../../helpers/helper.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import axios from "axios";

const secrets = await fetchSecretsList();

const getRewardMultiplier = async (walletAddress, currentJourneyId) => {
  let rewardMultiplier = 1;
  if (currentJourneyId >= 5) {
    return rewardMultiplier; // No reward multiplier for journeys 5 and above
  }
  const era1Contributors = await fetchEra1ContributorsFromS3();
  const era2ContributorsQuery = await contributionsModel
    .aggregate([
      { $match: { era: 2, darkXTokenAmount: { $gt: 0 } } },
      { $group: { _id: "$walletAddress" } },
    ])
    .exec();

  const era2Contributors = era2ContributorsQuery.map(
    (contribution) => contribution._id
  );

  if (
    era1Contributors.includes(walletAddress?.toLowerCase()) &&
    era2Contributors.includes(walletAddress?.toLowerCase())
  ) {
    rewardMultiplier = secrets?.ERA_3_REWARD_MULTIPLIER_PREVIOUS_BOTH || 4;
  } else if (
    era1Contributors.includes(walletAddress?.toLowerCase()) ||
    era2Contributors.includes(walletAddress?.toLowerCase())
  ) {
    rewardMultiplier = secrets?.ERA_3_REWARD_MULTIPLIER_PREVIOUS_ONE || 2;
  }

  return rewardMultiplier;
};

export const fetchEra3TimestampsAndMultipliers = async (walletAddress) => {
  const timestampsQuery = `
      query MyQuery {
        journeyPhaseManagers {
          items {
            currentJourneyId
            currentPhaseId
            nextJourneyStartTime
            nextPhaseStartTime
            isPaused
          }
        }
      }
    `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: timestampsQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("Error while fetching timestamp from JPM: ", e);
  }

  const timestamps = response?.data?.data?.journeyPhaseManagers?.items?.[0];

  const currentJourneyId = parseInt(timestamps?.currentJourneyId, 10);

  const multiplier = getEra3Multiplier(currentJourneyId);
  const rewardMultiplier = await getRewardMultiplier(
    walletAddress,
    currentJourneyId
  );

  return {
    currentJourney: timestamps?.currentJourneyId,
    currentPhase: timestamps?.currentPhaseId,
    isJourneyPaused: timestamps?.isPaused,
    nextJourneyTimestamp: timestamps?.nextJourneyStartTime,
    mintEndTimestamp:
      timestamps?.currentPhaseId === "1" ? timestamps?.nextPhaseStartTime : "",
    nextPhaseStartTimestamp: timestamps?.nextPhaseStartTime,
    multiplier,
    rewardMultiplier,
  };
};
