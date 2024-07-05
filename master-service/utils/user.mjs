import { usersModel } from "../models/models.mjs";

export const checkOrCreateUser = async (walletAddress) => {
  let user = await usersModel.findOne({ walletAddress: walletAddress });
  if (!user) {
    user = new usersModel({ walletAddress: walletAddress });
  }

  await user.save();

  if (!user.wishwellTokenId) {
    // Fetch wishwell token Id logic needs to be added.
    user = await usersModel.findOneAndUpdate(
      { walletAddress: walletAddress },
      { wishwellTokenId: 3 },
      { new: true }
    );
  }

  if (!user.antigravityTokenId) {
    // Fetch antigravity token Id logic needs to be added.
    user = await usersModel.findOneAndUpdate(
      { walletAddress: walletAddress },
      { antigravityTokenId: 3 },
      { new: true }
    );
  }
  return user;
};
