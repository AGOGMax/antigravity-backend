import { pointsModel } from "../models/models.mjs";

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
  { name: "2nd Navigator", start: 3333333, end: 33333333 },
];

const fetchAllTimeLeaderboard = async (currentUserWalletAddress) => {
  const topUsers = await pointsModel.aggregate([
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
      $limit: 5,
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

  if (isCurrentUserInTopUsers) {
    return [...topUsers, null];
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
    return [...topUsers, null];
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

  return [...topUsers, null, ...neighbourUsersWithRanks];
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
      $limit: 5,
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

  if (isCurrentUserInTopUsers) {
    return [...topUsers, null];
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
    return [...topUsers, null];
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

  return [...topUsers, null, ...neighbourUsersWithRanks];
};

const getBadge = (points) => {
  for (const badge of badgeMapping) {
    if (points >= badge.start && points <= badge.end) {
      return badge.name;
    }
  }
  return "No Badge";
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

export const fetchLeaderboard = async (currentUserWalletAddress) => {
  const [allTimeLeaderboardData, era1LeaderboardData, era2LeaderboardData] =
    await Promise.all([
      fetchAllTimeLeaderboard(currentUserWalletAddress),
      fetchEraWiseLeaderboard(1, currentUserWalletAddress),
      fetchEraWiseLeaderboard(2, currentUserWalletAddress),
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

  return {
    allTimeLeaderboard: allTimeLeaderboard,
    era1Leaderboard: era1Leaderboard,
    era2Leaderboard: era2Leaderboard,
  };
};
