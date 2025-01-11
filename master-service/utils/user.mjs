import axios from "axios";
import { ethers } from "ethers";
import { getBadge } from "../../helpers/helper.mjs";
import { usersModel, pointsModel } from "../models/models.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

const fetchEraPointsAndRankByWalletAddress = async (userWalletAddress) => {
  const points = await pointsModel.aggregate([
    { $match: { walletAddress: userWalletAddress } },
    {
      $group: {
        _id: "$era",
        totalPoints: { $sum: "$points" },
        totalContributionValue: { $sum: "$approxContributionValueInUSD" },
      },
    },
  ]);

  let wishwellPoints = 0;
  let miningPoints = 0;
  let mintingPoints = 0;

  let wishwellValue = 0;
  let miningValue = 0;
  let mintingValue = 0;

  points.forEach((doc) => {
    if (doc._id === 1) {
      wishwellPoints = doc.totalPoints;
      wishwellValue = doc.totalContributionValue;
    } else if (doc._id === 2) {
      miningPoints = doc.totalPoints;
      miningValue = doc.totalContributionValue;
    } else if (doc._id === 3) {
      mintingPoints = doc.totalPoints;
      mintingValue = 0;
    }
  });

  const totalPoints = wishwellPoints + miningPoints + mintingPoints;

  const totalValue = wishwellValue + miningValue + mintingValue;
  let pointsAverage = 0;
  if (totalValue !== 0) {
    pointsAverage = totalPoints / totalValue;
  }
  return {
    wishwellPoints: wishwellPoints,
    miningPoints: miningPoints,
    mintingPoints: mintingPoints,
    totalPoints: totalPoints,
    pointsAverage: pointsAverage,
    rank: getBadge(totalPoints),
  };
};

const fetchUserFromSubgraph = async (walletAddress, blockchain, era) => {
  const checksumWalletAddress = ethers.getAddress(walletAddress);
  const userQuery = `
  query MyQuery {
    users(where: {address: "${checksumWalletAddress}"}) {
      items{
        wishwell {
          tokenId
        }
        antigravity {
          tokenId
        }
      }
    }
  }`;

  const url =
    blockchain === "base"
      ? secrets?.ERA_2_BASE_SUBGRAPH_URL
      : secrets?.ERA_2_PULSECHAIN_SUBGRAPH_URL;

  let response = {};
  try {
    response = await axios.post(
      url,
      {
        query: userQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("Error while fetching user from subgraph: ", e);
  }

  const userData = response?.data?.data?.users?.items?.[0];
  return era === 1
    ? userData?.wishwell?.tokenId
    : userData?.antigravity?.tokenId;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const checkOrCreateUser = async (walletAddress) => {
  let user = await usersModel.findOne({
    walletAddress: walletAddress?.toLowerCase(),
  });
  if (!user) {
    user = new usersModel({ walletAddress: walletAddress?.toLowerCase() });
  }

  await user.save();

  await sleep(parseInt(secrets?.SUBGRAPH_DELAY));
  const tokenIdPromises = [];
  if (!user.wishwellBaseTokenId) {
    tokenIdPromises.push(
      fetchUserFromSubgraph(walletAddress, "base", 1).then(
        (wishwellBaseTokenId) => ({
          field: "wishwellBaseTokenId",
          value: wishwellBaseTokenId,
        })
      )
    );
  }

  if (!user.antigravityBaseTokenId) {
    tokenIdPromises.push(
      fetchUserFromSubgraph(walletAddress, "base", 2).then(
        (antigravityBaseTokenId) => ({
          field: "antigravityBaseTokenId",
          value: antigravityBaseTokenId,
        })
      )
    );
  }

  if (!user.antigravityPulsechainTokenId) {
    tokenIdPromises.push(
      fetchUserFromSubgraph(walletAddress, "pulsechain", 2).then(
        (antigravityPulsechainTokenId) => ({
          field: "antigravityPulsechainTokenId",
          value: antigravityPulsechainTokenId,
        })
      )
    );
  }

  if (!user.wishwellPulsechainTokenId) {
    tokenIdPromises.push(
      fetchUserFromSubgraph(walletAddress, "pulsechain", 1).then(
        (wishwellPulsechainTokenId) => ({
          field: "wishwellPulsechainTokenId",
          value: wishwellPulsechainTokenId,
        })
      )
    );
  }
  const tokenIdResults = await Promise.all(tokenIdPromises);
  const tokenIdMapping = tokenIdResults.reduce((acc, result) => {
    acc[result.field] = result.value;
    return acc;
  }, {});

  if (Object.keys(tokenIdMapping).length > 0) {
    user = await usersModel.findOneAndUpdate(
      { walletAddress: walletAddress?.toLowerCase() },
      tokenIdMapping,
      { new: true }
    );
  }

  const points = await fetchEraPointsAndRankByWalletAddress(
    walletAddress?.toLowerCase()
  );

  return { ...user?._doc, ...points };
};

const fetchTotalPoints = async (walletAddress) => {
  const result = await pointsModel.aggregate([
    { $match: { walletAddress: walletAddress?.toLowerCase() } },
    {
      $group: {
        _id: null,
        totalPoints: { $sum: "$points" },
      },
    },
  ]);

  if (result.length > 0) {
    return result[0].totalPoints;
  } else {
    return 0;
  }
};

const assignPointsByAdmin = async (walletAddress, points) => {
  const pointsObject = {
    walletAddress: walletAddress?.trim()?.toLowerCase(),
    points: points,
    isGrantedByAdmin: true,
    era: 3,
  };
  await pointsModel.create(pointsObject);
};

export {
  checkOrCreateUser,
  fetchEraPointsAndRankByWalletAddress,
  fetchTotalPoints,
  assignPointsByAdmin,
};
