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
  return totalPoints;
};

export { fetchEra1Contributors, fetchEra2Points };
