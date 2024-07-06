import axios from "axios";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import { contributionsModel } from "../master-service/models/models.mjs";

const secrets = await fetchSecretsList();

const badgeMapping = [
  { name: "Informant", start: 0, end: 3332 },
  { name: "Jr. Operator", start: 3333, end: 6665 },
  { name: "Sr. Operator", start: 6666, end: 9998 },
  { name: "Lead Operator", start: 9999, end: 33332 },
  { name: "Jr. Technician", start: 33333, end: 66665 },
  { name: "Sr. Technician", start: 66666, end: 99998 },
  { name: "Lead Technician", start: 99999, end: 333332 },
  { name: "Jr. Agent", start: 333333, end: 666665 },
  { name: "Sr. Agent", start: 666666, end: 999998 },
  { name: "Special Agent", start: 999999, end: 3333332 },
  { name: "2nd Navigator", start: 3333333, end: 6666665 },
  { name: "1st Navigator", start: 6666666, end: 9999998 },
  { name: "Chief Navigator", start: 9999999, end: 33333332 },
  { name: "2nd Officer", start: 33333333, end: 66666665 },
  { name: "1st Officer", start: 66666666, end: 99999998 },
  { name: "Chief Officer", start: 99999999, end: 332210999 },
  { name: "Grand Admiral", start: 332211000, end: Infinity },
];

const getBadge = (points) => {
  for (const badge of badgeMapping) {
    if (points >= badge.start && points <= badge.end) {
      return badge.name;
    }
  }
  return "No Badge";
};

const getMultiplier = (timestamp, era, timestamps) => {
  let timestampFor33;
  let timestampFor22;

  if (era === 1) {
    timestampFor33 = Math.floor(
      new Date(timestamps.era_1_phase_1_start).getTime() / 1000
    );
    timestampFor22 = Math.floor(
      new Date(timestamps.era_1_phase_2_start).getTime() / 1000
    );
  } else if (era === 2) {
    timestampFor33 = Math.floor(
      new Date(timestamps.era_2_phase_1_start).getTime() / 1000
    );
    timestampFor22 = Math.floor(
      new Date(timestamps.era_2_phase_2_start).getTime() / 1000
    );
  }

  if (timestamp < timestampFor33) {
    return 33;
  } else if (timestamp < timestampFor22) {
    return 22;
  } else {
    return 11;
  }
};

const modifyEra2Contributions = (contributions) => {
  const modifiedContributions = contributions.map((contribution) => {
    return {
      era: 2,
      walletAddress: contribution.user?.address,
      transactionHash: contribution.transactionHash,
      timestamp: contribution.timestamp,
      contributionTokenAddress: contribution.token,
      totalContributionTokenAmount: contribution.amount,
      darkXTokenAmount: contribution.amount / Math.pow(10, 18),
    };
  });
  return modifiedContributions;
};

const predictEra2Points = async (walletAddress, amount) => {
  const era1Contributions = await contributionsModel.find({ era: 1 });
  const era1ContributionUsers = new Set(
    era1Contributions.map((contribution) => contribution.walletAddress)
  );

  const timestampResponse = await axios.get(secrets?.TIMESTAMP_API_LINK);
  const timestamps = timestampResponse.data?.result;

  let rewardMultiplier = 1;
  const multiplier = getMultiplier(
    Math.floor(Date.now() / 1000),
    2,
    timestamps
  );

  if (era1ContributionUsers.has(walletAddress)) {
    rewardMultiplier = secrets?.ERA_2_REWARD_MULTIPLIER || 2;
  }
  return amount * multiplier * rewardMultiplier;
};

const generateEra2Points = async (contributions, era1Contributions) => {
  const era1ContributionUsers = new Set(
    era1Contributions.map((contribution) => contribution.walletAddress)
  );

  let pointsList = [];

  const timestampResponse = await axios.get(secrets?.TIMESTAMP_API_LINK);
  const timestamps = timestampResponse.data?.result;

  let rewardMultiplier = 1;
  contributions.forEach((contribution) => {
    const multiplier = getMultiplier(contribution.timestamp, 2, timestamps);
    if (era1ContributionUsers.has(contribution.walletAddress)) {
      rewardMultiplier = secrets?.ERA_2_REWARD_MULTIPLIER || 2;
    }

    pointsList.push({
      era: 2,
      walletAddress: contribution.walletAddress,
      contributionId: contribution._id,
      multiplier,
      points: contribution.darkXTokenAmount * multiplier * rewardMultiplier,
      isGrantedByAdmin: false,
    });
  });
  return pointsList;
};

export {
  modifyEra2Contributions,
  generateEra2Points,
  getMultiplier,
  getBadge,
  predictEra2Points,
};
