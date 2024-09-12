import express from "express";
import mongoose from "mongoose";
import {
  fetchLeaderboard,
  fetchAllTimeLeaderboard,
} from "./utils/leaderboard.mjs";
import { fetchTokenPrice } from "./utils/price.mjs";
import {
  enrollUserToNewsletter,
  fetchNewsletterEnrollments,
} from "./utils/newsletter.mjs";
import { checkOrCreateUser, fetchTotalPoints } from "./utils/user.mjs";
import { verifyMining } from "./utils/mining.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import { generateNFTPayload } from "./utils/nft.mjs";
import { predictEra2Points, predictMultiplier } from "../helpers/helper.mjs";
import axios from "axios";
import cors from "cors";
import {
  fetchEra1Contributors,
  fetchEra2Points,
} from "./utils/contributions.mjs";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { fetchEra3TimestampsAndMultipliers } from "./utils/timestamps.mjs";
import { verifyMinting } from "./utils/minting.mjs";
import {
  fetchLotteryResult,
  fetchLotteryResults,
  fetchTokensUsingUniqueCombinations,
  pruneTokens,
  saveLotteryResult,
} from "./utils/lottery.mjs";

const secrets = await fetchSecretsList();

const corsOptions = {
  credentials: true,
  origin: "*",
};

const app = express();

Sentry.init({
  dsn: secrets?.SENTRY_DSN_URL,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

const captureErrorWithContext = (error, contextMessage) => {
  Sentry.withScope((scope) => {
    scope.setExtra("contextMessage", contextMessage);
    Sentry.captureException(error);
  });
};

app.use(express.json());
app.use(cors(corsOptions));

app.post("/api/leaderboard", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const leaderboard = await fetchLeaderboard(walletAddress?.toLowerCase());
    res.json(leaderboard);
  } catch (error) {
    console.error(`Master Service: Leaderboard Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Leaderboard Error");
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
    console.error(`Master Service: Token Price Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Token Price Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/newsletter", async (req, res) => {
  try {
    const { name, email } = req.body;
    const newsletter = await enrollUserToNewsletter(name, email);
    res.json(newsletter);
  } catch (error) {
    console.error(`Master Service: Newsletter Enroll Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Newsletter Enroll Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/newsletter", async (req, res) => {
  try {
    const enrollments = await fetchNewsletterEnrollments();
    res.json(enrollments);
  } catch (error) {
    console.error(`Master Service: Newsletter Fetch Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Newsletter Fetch Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/user", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const user = await checkOrCreateUser(walletAddress);
    res.json(user);
  } catch (error) {
    console.error(`Master Service: User API Error: ${error}`);
    captureErrorWithContext(error, "Master Service: User API Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/verify-mining", async (req, res) => {
  try {
    const { walletAddress, blockchain } = req.body;
    const miningStatus = await verifyMining(walletAddress, blockchain);
    res.json(miningStatus);
  } catch (error) {
    console.error(`Master Service: Verify Mining Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Verify Mining Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/verify-minting", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const mintingStatus = await verifyMinting(walletAddress);
    res.json(mintingStatus);
  } catch (error) {
    console.error(`Master Service: Verify Minting Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Verify Minting Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/generate-nft", async (req, res) => {
  try {
    const { tokenId, era, blockchain, walletAddress } = req.body;
    const nftPayload = await generateNFTPayload(
      tokenId,
      era,
      blockchain,
      walletAddress
    );
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
    console.error(`Master Service: Generate NFT Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Generate NFT Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/metadata/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { blockchain } = req.query;

    const nftPayload = await generateNFTPayload(tokenId, 1, blockchain);

    const generateNftResponse = await axios.post(
      "http://localhost:3000/api/generate-nft",
      {
        tokenId,
        era: 1,
        blockchain,
      }
    );
    const nftUrl = generateNftResponse?.data?.url;

    const metadata = {
      description: secrets?.ERA_1_METADATA_DESCRIPTION,
      external_url: secrets?.ERA_1_METADATA_EXTERNAL_URL,
      image: nftUrl,
      name: secrets?.ERA_1_METADATA_NAME,
      attributes: [
        nftPayload?.transactions?.map((transaction) => {
          return {
            trait_type: transaction?.contributionTokenSymbol,
            value: transaction?.totalContributionTokenAmount,
          };
        }),
        {
          trait_type: "Points",
          value: nftPayload.totalPoints,
        },
      ],
    };

    res.json(metadata);
  } catch (error) {
    console.error(`Master Service: Era 1 NFT Metadata Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Era 1 NFT Metadata Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/ag-metadata/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { blockchain } = req.query;

    const nftPayload = await generateNFTPayload(tokenId, 2, blockchain);

    const generateNftResponse = await axios.post(
      "http://localhost:3000/api/generate-nft",
      {
        tokenId,
        era: 2,
        blockchain,
      }
    );
    const nftUrl = generateNftResponse?.data?.url;

    const metadata = {
      description: secrets?.ERA_2_METADATA_DESCRIPTION,
      external_url: secrets?.ERA_2_METADATA_EXTERNAL_URL,
      image: `${nftUrl}`,
      name: secrets?.ERA_2_METADATA_NAME,
      attributes: [
        {
          trait_type: "Rank",
          value: nftPayload.rank,
        },
        {
          trait_type: "Total Points",
          value: nftPayload.totalPoints,
        },
      ],
    };

    res.json(metadata);
  } catch (error) {
    console.error(`Master Service: Era 2 NFT Metadata Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Era 2 NFT Metadata Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/predict-points", async (req, res) => {
  try {
    const { walletAddress, amount } = req.body;
    const points = await predictEra2Points(walletAddress, amount);
    res.json({ points: points });
  } catch (error) {
    console.error(`Master Service: Predict Points Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Predict Points Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/predict-multiplier", async (req, res) => {
  try {
    const { walletAddress, era } = req.body;
    const multiplier = await predictMultiplier(walletAddress, era);
    res.json({ multiplier: multiplier });
  } catch (error) {
    console.error(`Master Service: Predict Multiplier Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Predict Multiplier Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/total-points", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const points = await fetchTotalPoints(walletAddress);
    res.json({ points: points });
  } catch (error) {
    console.error(`Master Service: Total Points Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Total Points Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/era-1-contributors", async (req, res) => {
  try {
    const contributors = await fetchEra1Contributors();
    res.json({ contributors: contributors });
  } catch (error) {
    console.error(`Master Service: Era 1 Contributors Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Era 1 Contributors Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/era-2-points", async (req, res) => {
  try {
    const points = await fetchEra2Points();
    res.json({ points: points });
  } catch (error) {
    console.error(`Master Service: Era 2 Points Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Era 2 Points Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/all-time-leaderboard", async (req, res) => {
  try {
    const leaderboard = await fetchAllTimeLeaderboard("");
    res.json(leaderboard);
  } catch (error) {
    console.error(`Master Service: All Time Leaderboard Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: All Time Leaderboard Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/era-3-timestamps-multipliers", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const response = await fetchEra3TimestampsAndMultipliers(walletAddress);
    res.json(response);
  } catch (error) {
    console.error(`Master Service: Era 3 Timestamps and Multipliers: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Era 3 Timestamps and Multipliers"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/lottery-result", async (req, res) => {
  try {
    const { uri, lotteryEntries } = req.body;
    await saveLotteryResult(uri, lotteryEntries);
    res.json({ success: true });
  } catch (error) {
    console.error(`Master Service: Lottery Result Save Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Lottery Result Save Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/lottery-result", async (req, res) => {
  try {
    const { walletAddress, lotteryId, journeyId, isPruned } = req.query;
    const isPrunedBool = isPruned === "true";

    const tokenResults = await fetchTokensUsingUniqueCombinations(
      walletAddress?.toLowerCase()
    );

    const lotteryResults = await fetchLotteryResult(
      walletAddress?.toLowerCase(),
      parseInt(lotteryId),
      parseInt(journeyId),
      isPrunedBool
    );
    res.json({
      lotteryResult: lotteryResults,
      uniqueCombinationTokens: tokenResults,
    });
  } catch (error) {
    console.error(`Master Service: Lottery Result Fetch Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Lottery Result Fetch Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/all-lottery-results", async (req, res) => {
  try {
    const { lotteryId, journeyId } = req.query;
    const lotteryResults = await fetchLotteryResults(
      parseInt(lotteryId),
      parseInt(journeyId)
    );
    res.json(lotteryResults);
  } catch (error) {
    console.error(`Master Service: Lottery Results Fetch Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Lottery Results Fetch Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/prune", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const response = await pruneTokens(walletAddress?.toLowerCase());
    res.json(response);
  } catch (error) {
    console.error(`Master Service: Prune API Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Prune API Error");
    res.status(500).send("Internal Server Error");
  }
});

Sentry.setupExpressErrorHandler(app);

await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
