import { getBadge } from "../../helpers/helper.mjs";
import { usersModel, pointsModel } from "../models/models.mjs";

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

const checkOrCreateUser = async (walletAddress) => {
  let user = await usersModel.findOne({
    walletAddress: walletAddress?.toLowerCase(),
  });
  if (!user) {
    user = new usersModel({ walletAddress: walletAddress?.toLowerCase() });
  }

  await user.save();

  if (!user.wishwellTokenId) {
    // Fetch wishwell token Id logic needs to be added.
    user = await usersModel.findOneAndUpdate(
      { walletAddress: walletAddress?.toLowerCase() },
      { wishwellTokenId: 3 },
      { new: true }
    );
  }

  if (!user.antigravityTokenId) {
    // Fetch antigravity token Id logic needs to be added.
    user = await usersModel.findOneAndUpdate(
      { walletAddress: walletAddress?.toLowerCase() },
      { antigravityTokenId: 3 },
      { new: true }
    );
  }

  const points = await fetchEraPointsAndRankByWalletAddress(
    walletAddress?.toLowerCase()
  );
  console.log(points);
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
