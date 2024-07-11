import axios from "axios";
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
      },
    },
  ]);

  let wishwellPoints = 0;
  let miningPoints = 0;

  points.forEach((doc) => {
    if (doc._id === 1) {
      wishwellPoints = doc.totalPoints;
    } else if (doc._id === 2) {
      miningPoints = doc.totalPoints;
    }
  });

  const totalPoints = wishwellPoints + miningPoints;
  return {
    wishwellPoints: wishwellPoints,
    miningPoints: miningPoints,
    totalPoints: totalPoints,
    rank: getBadge(totalPoints),
  };
};

const fetchUserFromSubgraph = async (walletAddress, blockchain, era) => {
  const userQuery = `
  query MyQuery {
    users(where: {address: "${walletAddress}"}) {
      wishwellId {
        tokenId
      }
      antigravity {
        tokenId
      }
    }
  }`;

  const url =
    blockchain === "base"
      ? secrets?.ERA_2_BASE_SUBGRAPH_URL
      : secrets?.ERA_2_PULSECHAIN_SUBGRAPH_URL;

  const response = await axios.post(
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

  const userData = response?.data?.data?.users?.[0];
  return era === 1
    ? userData?.wishwellId?.tokenId
    : userData?.antigravity?.tokenId;
};

const checkOrCreateUser = async (walletAddress) => {
  let user = await usersModel.findOne({
    walletAddress: walletAddress?.toLowerCase(),
  });
  if (!user) {
    user = new usersModel({ walletAddress: walletAddress?.toLowerCase() });
  }

  await user.save();

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

export {
  checkOrCreateUser,
  fetchEraPointsAndRankByWalletAddress,
  fetchTotalPoints,
};
