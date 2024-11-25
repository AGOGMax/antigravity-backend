import { contributionsModel, pointsModel } from "../models/models.mjs";

const fetchEra1Contributors = async () => {
  const era1Contributors = await contributionsModel
    .aggregate([
      { $match: { era: 1, approxContributionValueInUSD: { $gt: 0 } } },
      { $group: { _id: "$walletAddress" } },
    ])
    .exec();

  return era1Contributors.map((contribution) => contribution._id);
};

const fetchEra2Points = async () => {
  const totalPoints = await pointsModel
    .aggregate([
      { $match: { era: 2 } },
      {
        $group: {
          _id: "$walletAddress",
          totalPoints: { $sum: "$points" },
        },
      },
      {
        $project: {
          _id: 0,
          address: "$_id",
          totalPoints: 1,
        },
      },
    ])
    .exec();

  const result = await pointsModel
    .aggregate([
      {
        $match: {
          era: { $in: [1, 2] },
        },
      },
      {
        $group: {
          _id: { walletAddress: "$walletAddress", era: "$era" },
          points: { $sum: "$points" },
        },
      },
      {
        $group: {
          _id: "$_id.walletAddress",
          totalPoints: { $sum: "$points" },
          era2Points: {
            $sum: {
              $cond: [{ $eq: ["$_id.era", 2] }, "$points", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          address: "$_id",
          totalPoints: 1,
          era2Points: 1,
          difference: { $subtract: ["$totalPoints", "$era2Points"] },
        },
      },
    ])
    .exec();

  return result;
};

export { fetchEra1Contributors, fetchEra2Points };
