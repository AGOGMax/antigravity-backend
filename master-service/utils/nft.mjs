import {
  pointsModel,
  contributionsModel,
  usersModel,
} from "../models/models.mjs";

import { getBadge } from "../../helpers/helper.mjs";

export const generateNFTPayload = async (tokenId, era, blockchain) => {
  if (era === 1) {
    const user = await usersModel.findOne(
      { wishwellTokenId: tokenId },
      "walletAddress"
    );

    const userWalletAddress = user?.walletAddress;

    const contributions = await contributionsModel.aggregate([
      {
        $match: {
          walletAddress: userWalletAddress,
          era: era,
          blockchain: blockchain,
        },
      },
      {
        $group: {
          _id: "$contributionTokenSymbol",
          contributionTokenName: { $first: "$contributionTokenName" },
          contributionTokenAddress: { $first: "$contributionTokenAddress" },
          totalContributionTokenAmount: {
            $sum: "$totalContributionTokenAmount",
          },
          approxContributionValueInUSD: {
            $sum: "$approxContributionValueInUSD",
          },
        },
      },
      {
        $project: {
          _id: 0,
          contributionTokenSymbol: "$_id",
          contributionTokenName: 1,
          contributionTokenAddress: 1,
          totalContributionTokenAmount: 1,
          approxContributionValueInUSD: 1,
        },
      },
    ]);

    const totalContributionValue = contributions.reduce((sum, contribution) => {
      return sum + contribution.approxContributionValueInUSD;
    }, 0);

    const points = await pointsModel.aggregate([
      {
        $match: {
          walletAddress: userWalletAddress,
          blockchain: blockchain,
          era: era,
        },
      },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: "$points" },
        },
      },
    ]);

    return {
      transactions: contributions,
      totalAmount: totalContributionValue,
      totalPoints: points[0]?.totalPoints,
      userWalletAddress: userWalletAddress,
      era: 1,
    };
  } else if (era === 2) {
    const user = await usersModel.findOne(
      { antigravityTokenId: tokenId },
      "walletAddress"
    );

    const userWalletAddress = user?.walletAddress;

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
      rank: getBadge(totalPoints),
      wishwellPoints: wishwellPoints,
      miningPoints: miningPoints,
      totalPoints: totalPoints,
      userWalletAddress: userWalletAddress,
      era: 2,
    };
  }
  return {};
};
