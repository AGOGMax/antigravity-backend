import { era3TimestampsModel } from "../models/models.mjs";
import { getEra3Multiplier } from "../../helpers/helper.mjs";
import { contributionsModel } from "../models/models.mjs";
import { fetchEra1ContributorsFromS3 } from "../../helpers/helper.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

const getRewardMultiplier = async (walletAddress) => {
  let rewardMultiplier = 1;
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
  const timestamps = await era3TimestampsModel.findOne({
    identifier: "era3Timestamps",
  });

  const multiplier = getEra3Multiplier(timestamps?.currentJourney);
  const rewardMultiplier = await getRewardMultiplier(walletAddress);

  return {
    currentJourney: timestamps?.currentJourney,
    currentPhase: timestamps?.currentPhase,
    isJourneyPaused: timestamps?.isJourneyPaused,
    nextJourneyTimestamp: timestamps?.nextJourneyTimestamp,
    mintEndTimestamp:
      timestamps?.currentPhase === 1 ? timestamps?.nextPhaseTimestamp : "",
    multiplier,
    rewardMultiplier,
  };
};
