import { pointsModel } from "../models/models.mjs";
import { getBadge } from "../../helpers/helper.mjs";
import isEmpty from "lodash/isEmpty.js";

const fetchAllTimeLeaderboard = async (
  currentUserWalletAddress,
  limit,
  exclusionList = []
) => {
  const users = await pointsModel.aggregate([
    {
      $match: {
        walletAddress: { $nin: exclusionList },
      },
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

  if (!limit) {
    return users;
  }

  const topUsers = users.slice(0, limit);

  const currentUserWithRank = users.find(
    (item) =>
      item.walletAddress?.toLowerCase() ===
      currentUserWalletAddress?.toLowerCase()
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
      item.walletAddress?.toLowerCase() ===
      currentUserWalletAddress?.toLowerCase()
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
          ...(entry.walletAddress?.toLowerCase() ===
            currentUserWalletAddress?.toLowerCase() && { special: true }),
        }
      : null
  );
};

const fetchLeaderboard = async (currentUserWalletAddress, exclusionList) => {
  const [allTimeLeaderboardData, fullTimeLeaderboardData] = await Promise.all([
    fetchAllTimeLeaderboard(currentUserWalletAddress, 10, exclusionList),
    fetchAllTimeLeaderboard(currentUserWalletAddress, "", exclusionList),
  ]);

  const [allTimeLeaderboard, fullTimeLeaderboard] = await Promise.all([
    transformLeaderboard(allTimeLeaderboardData, currentUserWalletAddress),
    transformLeaderboard(fullTimeLeaderboardData, currentUserWalletAddress),
  ]);

  return {
    allTimeLeaderboard,
    fullTimeLeaderboard,
  };
};

export { fetchAllTimeLeaderboard, fetchLeaderboard };
