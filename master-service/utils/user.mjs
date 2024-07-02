import mongoose from "mongoose";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const { Schema, model } = mongoose;
const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const usersSchema = new Schema({}, { strict: false });
const usersModel = model("users", usersSchema);

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
