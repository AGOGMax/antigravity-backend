import {
  pointsModel,
  contributionsModel,
  usersModel,
} from "../models/models.mjs";
import isEmpty from "lodash/isEmpty.js";

import { fetchEraPointsAndRankByWalletAddress } from "./user.mjs";

export const generateNFTPayload = async (
  tokenId,
  era,
  blockchain,
  walletAddress
) => {
  if (era === 1) {
    let userWalletAddress = walletAddress?.toLowerCase();
    if (isEmpty(walletAddress)) {
      const user = await usersModel.findOne(
        {
          [blockchain === "base"
            ? "wishwellBaseTokenId"
            : "wishwellPulsechainTokenId"]: tokenId.toString(),
        },
        "walletAddress"
      );

      userWalletAddress = user?.walletAddress?.toLowerCase();
    }

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
    let userWalletAddress = walletAddress?.toLowerCase();
    if (isEmpty(walletAddress)) {
      const user = await usersModel.findOne(
        {
          [blockchain === "base"
            ? "antigravityBaseTokenId"
            : "antigravityPulsechainTokenId"]: tokenId.toString(),
        },
        "walletAddress"
      );

      userWalletAddress = user?.walletAddress?.toLowerCase();
    }

    const points = await fetchEraPointsAndRankByWalletAddress(
      userWalletAddress
    );

    return {
      ...points,
      userWalletAddress: userWalletAddress,
      era: 2,
    };
  }
  return {};
};
