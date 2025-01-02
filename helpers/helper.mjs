import axios from "axios";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";

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
      new Date(timestamps.era_1_phase_1_end).getTime() / 1000
    );
    timestampFor22 = Math.floor(
      new Date(timestamps.era_1_phase_2_end).getTime() / 1000
    );
  } else if (era === 2) {
    timestampFor33 = Math.floor(
      new Date(timestamps.era_2_phase_1_end).getTime() / 1000
    );
    timestampFor22 = Math.floor(
      new Date(timestamps.era_2_phase_2_end).getTime() / 1000
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

const modifyEra2Contributions = (contributions, blockchain) => {
  const modifiedContributions = contributions.map((contribution) => {
    return {
      era: 2,
      walletAddress: contribution.user?.address?.toLowerCase(),
      transactionHash: contribution.transactionHash,
      timestamp: contribution.timestamp,
      contributionTokenAddress: contribution.token,
      totalContributionTokenAmount: contribution.tokenInvested,
      darkXTokenAmount: parseInt(contribution.amount) / Math.pow(10, 18),
      blockchain,
    };
  });
  return modifiedContributions;
};

const modifyEra3Contributions = (contributions) => {
  const modifiedContributions = contributions.map((contribution) => {
    return {
      era: 3,
      walletAddress: contribution.user?.address?.toLowerCase(),
      transactionHash: contribution.transactionHash,
      timestamp: contribution.timestamp,
      fuelCellsAmount: contribution.amount,
      journeyId: parseInt(contribution.journeyId),
    };
  });
  return modifiedContributions;
};

const predictMultiplier = async (walletAddress, era) => {
  const era1ContributionUsers = await fetchEra1ContributorsFromS3();

  let timestampResponse = {};
  try {
    timestampResponse = await axios.get(secrets?.TIMESTAMP_API_LINK);
  } catch (e) {
    console.error("Error while fetching timestamp from sanity: ", e);
  }
  const timestamps = timestampResponse.data?.result;

  let rewardMultiplier = 1;
  const multiplier = getMultiplier(
    Math.floor(Date.now() / 1000),
    parseInt(era),
    timestamps
  );

  if (
    era1ContributionUsers.includes(walletAddress?.toLowerCase()) &&
    era === 2
  ) {
    rewardMultiplier = secrets?.ERA_2_REWARD_MULTIPLIER || 2;
  }
  return multiplier * rewardMultiplier;
};

const predictEra2Points = async (walletAddress, amount) => {
  const era1ContributionUsers = await fetchEra1ContributorsFromS3();

  let timestampResponse = {};
  try {
    timestampResponse = await axios.get(secrets?.TIMESTAMP_API_LINK);
  } catch (e) {
    console.error("Error while fetching timestamp from sanity: ", e);
  }
  const timestamps = timestampResponse.data?.result;

  let rewardMultiplier = 1;
  const multiplier = getMultiplier(
    Math.floor(Date.now() / 1000),
    2,
    timestamps
  );

  if (era1ContributionUsers.includes(walletAddress?.toLowerCase())) {
    rewardMultiplier = secrets?.ERA_2_REWARD_MULTIPLIER || 2;
  }
  return amount * multiplier * rewardMultiplier;
};

const fetchEra1ContributorsFromS3 = async () => {
  let response = {};
  try {
    response = await axios.get(secrets?.ERA_1_CONTRIBUTORS_S3_URL);
  } catch (e) {
    console.error("Error while fetching era 1 contributors from s3: ", e);
  }

  return response?.data?.accounts?.map((address) => address.toLowerCase());
};

const generateEra2Points = async (contributions, blockchain) => {
  const era1ContributionUsers = await fetchEra1ContributorsFromS3();
  let pointsList = [];

  let timestampResponse = {};
  try {
    timestampResponse = await axios.get(secrets?.TIMESTAMP_API_LINK);
  } catch (e) {
    console.error("Error while fetching timestamp from sanity: ", e);
  }
  const timestamps = timestampResponse.data?.result;

  let rewardMultiplier = 1;
  contributions.forEach((contribution) => {
    const multiplier = getMultiplier(contribution.timestamp, 2, timestamps);
    if (
      era1ContributionUsers.includes(contribution.walletAddress?.toLowerCase())
    ) {
      rewardMultiplier = secrets?.ERA_2_REWARD_MULTIPLIER || 2;
    }
    pointsList.push({
      era: 2,
      walletAddress: contribution.walletAddress?.toLowerCase(),
      contributionId: contribution._id,
      approxContributionValueInUSD:
        contribution.darkXTokenAmount / (multiplier * rewardMultiplier),
      points: contribution.darkXTokenAmount,
      isGrantedByAdmin: false,
      blockchain,
    });
  });
  return pointsList;
};

const getEra3Multiplier = (currentJourney) => {
  if (currentJourney === 1) return 33;
  else if (currentJourney === 2) return 22;
  else if (currentJourney === 3) return 11;
  else return 1;
};

const generateEra3Points = async (contributions, era2Contributors) => {
  const era1ContributionUsers = await fetchEra1ContributorsFromS3();
  let pointsList = [];

  let rewardMultiplier = 1;
  contributions.forEach((contribution) => {
    const multiplier = getEra3Multiplier(contribution?.journeyId);
    if (
      era1ContributionUsers.includes(
        contribution.walletAddress?.toLowerCase()
      ) &&
      era2Contributors.includes(contribution.walletAddress?.toLowerCase())
    ) {
      rewardMultiplier = secrets?.ERA_3_REWARD_MULTIPLIER_PREVIOUS_BOTH || 4;
    } else if (
      era1ContributionUsers.includes(
        contribution.walletAddress?.toLowerCase()
      ) ||
      era2Contributors.includes(contribution.walletAddress?.toLowerCase())
    ) {
      rewardMultiplier = secrets?.ERA_3_REWARD_MULTIPLIER_PREVIOUS_ONE || 2;
    }
    pointsList.push({
      era: 3,
      walletAddress: contribution.walletAddress?.toLowerCase(),
      contributionId: contribution._id,
      points: contribution.fuelCellsAmount * multiplier * rewardMultiplier,
      isGrantedByAdmin: false,
    });
  });
  return pointsList;
};

const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const fetchJourneyIdForFuelCell = async (tokenId) => {
  const fuelCellQuery = `
    query MyQuery {
      fuelCells(where: { tokenId: "${tokenId}" }) {
        items {
          tokenId
          journeyId
        }
      }
    }
  `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: fuelCellQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error(
      "Error while fetching journey id for fuel cell from subgraph: ",
      e
    );
  }

  const fuelCell = response.data?.data?.fuelCells?.items?.[0] || [];

  if (fuelCell?.journeyId) {
    return parseInt(fuelCell.journeyId);
  }
  return "default";
};

const fetchPrunedTokenIds = async (tokenIds) => {
  const fuelCellContractAddress = secrets?.FUEL_CELL_CONTRACT_ADDRESS;
  const fuelCellIds = tokenIds.map(
    (tokenId) => `"${fuelCellContractAddress.concat(tokenId.toString())}"`
  );

  const prunedWinningsQuery = `
      query MyQuery {
        winningPruneds(where: { fuelCellId_in: [${fuelCellIds.join(
          ","
        )}] }, limit: 900) {
          items {
            fuelCell {
              tokenId
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
        query: prunedWinningsQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("Error while fetching pruned winnings from subgraph: ", e);
  }

  const winningsPruned = response.data?.data?.winningPruneds?.items || [];
  const prunedTokenIds = winningsPruned?.map((winning) =>
    parseInt(winning.fuelCell.tokenId)
  );

  return prunedTokenIds;
};

export {
  modifyEra2Contributions,
  modifyEra3Contributions,
  generateEra2Points,
  generateEra3Points,
  getMultiplier,
  getEra3Multiplier,
  getBadge,
  predictEra2Points,
  predictMultiplier,
  fetchEra1ContributorsFromS3,
  chunkArray,
  fetchPrunedTokenIds,
  fetchJourneyIdForFuelCell,
};
