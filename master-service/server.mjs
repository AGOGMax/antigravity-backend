import express from "express";
import mongoose from "mongoose";
import { fetchLeaderboard } from "./utils/leaderboard.mjs";
import { fetchTokenPrice } from "./utils/price.mjs";
import { enrollUserToNewsletter } from "./utils/newsletter.mjs";
import { checkOrCreateUser, fetchTotalPoints } from "./utils/user.mjs";
import { verifyMining } from "./utils/mining.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import { generateNFTPayload } from "./utils/nft.mjs";
import { predictEra2Points } from "../helpers/helper.mjs";
import axios from "axios";
import cors from "cors";

const secrets = await fetchSecretsList();

const corsOptions = {
  credentials: true,
  origin: [
    "http://localhost:3000",
    "https://antigravity-wishing-well-git-development-chainlabs.vercel.app",
  ],
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions));

app.post("/api/leaderboard", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const leaderboard = await fetchLeaderboard(walletAddress);
    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/token-price", async (req, res) => {
  try {
    const { tokenAddress, poolAddress, network, isNativeToken } = req.body;
    const price = await fetchTokenPrice(
      tokenAddress,
      poolAddress,
      network,
      isNativeToken
    );
    res.json(price);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/newsletter", async (req, res) => {
  try {
    const { name, email } = req.body;
    const newsletter = await enrollUserToNewsletter(name, email);
    res.json(newsletter);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/user", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const user = await checkOrCreateUser(walletAddress);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/verify-mining", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const miningStatus = await verifyMining(walletAddress);
    res.json(miningStatus);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/generate-nft", async (req, res) => {
  try {
    const { tokenId, era, blockchain } = req.body;
    const nftPayload = await generateNFTPayload(tokenId, era, blockchain);
    const nftFileName =
      era === 1
        ? `${nftPayload?.userWalletAddress}_${era}_${nftPayload?.totalPoints
            ?.toString()
            ?.replace(".", "_")}_${blockchain}`
        : `${nftPayload?.userWalletAddress}_${era}_${nftPayload?.totalPoints
            ?.toString()
            ?.replace(".", "_")}`;

    const response = await axios.post(secrets?.NFT_SERVICE_URL, {
      nftPayload,
      filename: nftFileName,
    });

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/predict-points", async (req, res) => {
  try {
    const { walletAddress, amount } = req.body;
    const points = await predictEra2Points(walletAddress, amount);
    res.json({ points: points });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/total-points", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const points = await fetchTotalPoints(walletAddress);
    res.json({ points: points });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
