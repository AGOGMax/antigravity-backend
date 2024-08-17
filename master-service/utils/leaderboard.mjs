import { pointsModel } from "../models/models.mjs";
import { getBadge } from "../../helpers/helper.mjs";
import isEmpty from "lodash/isEmpty.js";

const fetchAllTimeLeaderboard = async (currentUserWalletAddress, limit) => {
  const users = await pointsModel.aggregate([
    {
      $group: {
        _id: "$walletAddress",
        totalPoints: { $sum: "$points" },
      },
    },
    {
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
      },
    },
  ]);

  users.sort((a, b) => {
    if (a.totalPoints === b.totalPoints) {
      return a.walletAddress.localeCompare(b.walletAddress);
    }
    return b.totalPoints - a.totalPoints;
  });

  users.forEach((user, index) => {
    user.rank = index + 1;
  });

  if (!limit) {
    return users;
  }

  const topUsers = users.slice(0, limit);

  const currentUserWithRank = users.find(
    (item) =>
      item.walletAddress.toLowerCase() ===
      currentUserWalletAddress.toLowerCase()
  );

  if (currentUserWithRank?.rank <= limit || isEmpty(currentUserWithRank)) {
    return [...topUsers];
  }

  const currentUserRank = currentUserWithRank?.rank;
  const previousUser = users?.[currentUserRank - 2];
  const nextUser = users?.[currentUserRank];

  return [
    ...topUsers.slice(0, 5),
    null,
    previousUser,
    currentUserWithRank,
    nextUser,
  ];
};

const fetchEraWiseLeaderboard = async (era, currentUserWalletAddress) => {
  const users = await pointsModel.aggregate([
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
      $project: {
        _id: 0,
        walletAddress: "$_id",
        totalPoints: 1,
      },
    },
  ]);

  users.sort((a, b) => {
    if (a.totalPoints === b.totalPoints) {
      return a.walletAddress.localeCompare(b.walletAddress);
    }
    return b.totalPoints - a.totalPoints;
  });

  users.forEach((user, index) => {
    user.rank = index + 1;
  });

  const topUsers = users.slice(0, 10);

  const currentUserWithRank = users.find(
    (item) =>
      item.walletAddress.toLowerCase() ===
      currentUserWalletAddress.toLowerCase()
  );

  if (currentUserWithRank?.rank <= 10 || isEmpty(currentUserWithRank)) {
    return [...topUsers];
  }

  const currentUserRank = currentUserWithRank?.rank;
  const previousUser = users?.[currentUserRank - 2];
  const nextUser = users?.[currentUserRank];

  return [
    ...topUsers.slice(0, 5),
    null,
    previousUser,
    currentUserWithRank,
    nextUser,
  ];
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
