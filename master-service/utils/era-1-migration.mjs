import mongoose from "mongoose";
import { contributionsModel, usersModel } from "../models/models.mjs";
import axios from "axios";

const fetchAndSaveUser = async (
  uniqueWalletAddresses,
  subgraphUrl,
  tokenIdKey
) => {
  const userQuery = `
    query MyQuery {
      users (first: 200) {
        address
        wishwellId{
          tokenId
        }
      }
    }`;

  const response = await axios.post(
    subgraphUrl,
    {
      query: userQuery,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const usersData = response?.data?.data?.users;
  console.log("Subgraph Data", subgraphUrl, usersData.length, usersData);

  for (const user of usersData) {
    if (uniqueWalletAddresses.includes(user.address?.toLowerCase())) {
      const userData = {
        walletAddress: user.address?.toLowerCase(),
        [tokenIdKey]: user.wishwellId ? user.wishwellId.tokenId : null,
      };

      await usersModel.findOneAndUpdate(
        { walletAddress: user.address?.toLowerCase() },
        userData,
        {
          upsert: true,
          new: true,
        }
      );
    }
  }
};

await mongoose.connect("");

const uniqueWalletAddresses = (
  await contributionsModel.distinct("walletAddress", {
    era: 1,
  })
)?.map((address) => address.toLowerCase());

console.log(uniqueWalletAddresses);

const baseSubgraphUrl = "";
const pulsechainSubgraphUrl = "";

await fetchAndSaveUser(
  uniqueWalletAddresses,
  baseSubgraphUrl,
  "wishwellBaseTokenId"
);
await fetchAndSaveUser(
  uniqueWalletAddresses,
  pulsechainSubgraphUrl,
  "wishwellPulsechainTokenId"
);

const baseUsers = await usersModel.find({ wishwellBaseTokenId: { $ne: null } });
const pulsechainUsers = await usersModel.find({
  wishwellPulsechainTokenId: { $ne: null },
});

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

for (const user of baseUsers) {
  const response = await axios.post("http://localhost:3000/api/generate-nft", {
    tokenId: user.wishwellBaseTokenId,
    era: 1,
    blockchain: "base",
  });
  await sleep(400);
  console.log("base", user.walletAddress, response);
}

for (const user of pulsechainUsers) {
  const response = await axios.post("http://localhost:3000/api/generate-nft", {
    tokenId: user.wishwellPulsechainTokenId,
    era: 1,
    blockchain: "pulsechain",
  });
  await sleep(400);
  console.log("pulsechain", user.walletAddress, response);
}
