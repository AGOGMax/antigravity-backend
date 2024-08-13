import { pointsModel } from "../models/models.mjs";
import { getBadge } from "../../helpers/helper.mjs";
import isEmpty from "lodash/isEmpty.js";

const fetchAllTimeLeaderboard = async (currentUserWalletAddress, limit) => {
  let pipeline = [
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $setWindowFields: {
        sortBy: { totalPoints: -1 },
        output: {
          rank: {
            $rank: {},
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
        rank: 1,
      },
    },
  ];

  if (limit) {
    pipeline.push({ $limit: limit });
  }
  const topUsers = await pointsModel.aggregate(pipeline);

  const isCurrentUserInTopUsers = topUsers.some(
    (item) =>
      item.walletAddress.toLowerCase() ===
      currentUserWalletAddress.toLowerCase()
  );

  if (isCurrentUserInTopUsers || isEmpty(currentUserWalletAddress)) {
    return [...topUsers];
  }

  const currentUserWithRank = await pointsModel.aggregate([
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $setWindowFields: {
        sortBy: { totalPoints: -1 },
        output: {
          rank: {
            $rank: {},
          },
        },
      },
    },
    {
      $match: { _id: currentUserWalletAddress },
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
        rank: 1,
      },
    },
  ]);

  const currentUserRank = currentUserWithRank[0]?.rank;

  if (!currentUserRank) {
    return [...topUsers];
  }

  const neighbourUsersWithRanks = await pointsModel.aggregate([
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $setWindowFields: {
        sortBy: { totalPoints: -1 },
        output: {
          rank: {
            $rank: {},
          },
        },
      },
    },
    {
      $match: {
        rank: {
          $in: [currentUserRank - 1, currentUserRank, currentUserRank + 1],
        },
      },
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
        rank: 1,
      },
    },
  ]);

  return [...topUsers.slice(0, 5), null, ...neighbourUsersWithRanks];
};

const fetchEraWiseLeaderboard = async (era, currentUserWalletAddress) => {
  const topUsers = await pointsModel.aggregate([
    {
      $match: { era: era },
    },
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $setWindowFields: {
        sortBy: { totalPoints: -1 },
        output: {
          rank: {
            $rank: {},
          },
        },
      },
    },
    {
      $limit: 10,
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
        rank: 1,
      },
    },
  ]);

  const isCurrentUserInTopUsers = topUsers.some(
    (item) =>
      item.walletAddress.toLowerCase() ===
      currentUserWalletAddress.toLowerCase()
  );

  if (isCurrentUserInTopUsers || isEmpty(currentUserWalletAddress)) {
    return [...topUsers];
  }

  const currentUserWithRank = await pointsModel.aggregate([
    {
      $match: { era: era },
    },
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $setWindowFields: {
        sortBy: { totalPoints: -1 },
        output: {
          rank: {
            $rank: {},
          },
        },
      },
    },
    {
      $match: { _id: currentUserWalletAddress },
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
        rank: 1,
      },
    },
  ]);

  const currentUserRank = currentUserWithRank[0]?.rank;

  if (!currentUserRank) {
    return [...topUsers];
  }

  const neighbourUsersWithRanks = await pointsModel.aggregate([
    {
      $match: { era: era },
    },
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $sort: { totalPoints: -1 },
    },
    {
      $setWindowFields: {
        sortBy: { totalPoints: -1 },
        output: {
          rank: {
            $rank: {},
          },
        },
      },
    },
    {
      $match: {
        rank: {
          $in: [currentUserRank - 1, currentUserRank, currentUserRank + 1],
        },
      },
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
        rank: 1,
      },
    },
  ]);

  return [...topUsers.slice(0, 5), null, ...neighbourUsersWithRanks];
};

const transformLeaderboard = (leaderboard, currentUserWalletAddress) => {
  return leaderboard.map((entry) =>
    entry
      ? {
          rank: entry.rank,
          points: entry.totalPoints,
          wallet: entry.walletAddress,
          badge: getBadge(entry.totalPoints),
          ...(entry.walletAddress.toLowerCase() ===
            currentUserWalletAddress.toLowerCase() && { special: true }),
        }
      : null
  );
};

const fetchLeaderboard = async (currentUserWalletAddress) => {
  const [
    allTimeLeaderboardData,
    era1LeaderboardData,
    era2LeaderboardData,
    era3LeaderboardData,
  ] = await Promise.all([
    fetchAllTimeLeaderboard(currentUserWalletAddress, 10),
    fetchEraWiseLeaderboard(1, currentUserWalletAddress),
    fetchEraWiseLeaderboard(2, currentUserWalletAddress),
    fetchEraWiseLeaderboard(3, currentUserWalletAddress),
  ]);

  const allTimeLeaderboard = transformLeaderboard(
    allTimeLeaderboardData,
    currentUserWalletAddress
  );
  const era1Leaderboard = transformLeaderboard(
    era1LeaderboardData,
    currentUserWalletAddress
  );
  const era2Leaderboard = transformLeaderboard(
    era2LeaderboardData,
    currentUserWalletAddress
  );
  const era3Leaderboard = transformLeaderboard(
    era3LeaderboardData,
    currentUserWalletAddress
  );

  return {
    allTimeLeaderboard: allTimeLeaderboard,
    era1Leaderboard: era1Leaderboard,
    era2Leaderboard: era2Leaderboard,
    era3Leaderboard: era3Leaderboard,
  };
};

export { fetchAllTimeLeaderboard, fetchLeaderboard };
