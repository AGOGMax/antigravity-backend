import express from "express";
import mongoose from "mongoose";
import { createClient } from "redis";
import {
  fetchLeaderboard,
  fetchAllTimeLeaderboard,
} from "./utils/leaderboard.mjs";
import { fetchTokenPrice } from "./utils/price.mjs";
import {
  enrollUserToNewsletter,
  fetchNewsletterEnrollments,
} from "./utils/newsletter.mjs";
import {
  assignPointsByAdmin,
  checkOrCreateUser,
  fetchTotalPoints,
} from "./utils/user.mjs";
import { verifyMining } from "./utils/mining.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import { generateNFTPayload } from "./utils/nft.mjs";
import {
  fetchJourneyIdForFuelCell,
  predictEra2Points,
  predictMultiplier,
} from "../helpers/helper.mjs";
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
  fetchEvilBonusForJourney,
  fetchLotteryResult,
  fetchLotteryResults,
  fetchTokensUsingUniqueCombinations,
  pruneTokens,
  saveLotteryResult,
} from "./utils/lottery.mjs";
import {
  fetchTotalUserYield,
  fetchUserFuelCellsMappingWithTotalYield,
} from "./utils/yield.mjs";
import { fuelCellMetadataModel } from "./models/models.mjs";

const secrets = await fetchSecretsList();

const corsOptions = {
  credentials: true,
  origin: "*",
};

const app = express();

const environment = process.env.ENV || "TEST";

const redisClient = createClient({
  username: "default",
  password: secrets?.REDIS_PASSWORD,
  socket: {
    host: secrets?.REDIS_HOST,
    port: 19946,
  },
});

redisClient.on("error", (err) => console.log("Redis Client Error ❌", err));
await redisClient.connect();

Sentry.init({
  dsn: secrets?.SENTRY_DSN_URL,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.3,
  profilesSampleRate: 0.3,
  enabled: environment === "PRODUCTION",
  environment: environment,
});

const captureErrorWithContext = (error, contextMessage) => {
  Sentry.withScope((scope) => {
    scope.setExtra("contextMessage", contextMessage);
    Sentry.captureException(error);
  });
};

app.use(express.json({ limit: "500mb" }));
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
    res.json({ success: true });

    const intervalId = setInterval(() => {
      console.info(`Master Service: Interval started for ${uri}.`);
      saveLotteryResult(uri, lotteryEntries, intervalId);
    }, parseInt(secrets?.LOTTERY_RESULT_RETRY_INTERVAL));

    setTimeout(() => {
      clearInterval(intervalId);
      console.info(
        `Master Service: Interval cleared by timeout after ${secrets?.LOTTERY_RESULT_TIMEOUT_VALUE} seconds.`
      );
    }, parseInt(secrets?.LOTTERY_RESULT_TIMEOUT_VALUE));
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
    const lowerCaseWalletAddress = walletAddress?.toLowerCase();

    const [tokenResults, lotteryResults] = await Promise.all([
      fetchTokensUsingUniqueCombinations(lowerCaseWalletAddress),
      fetchLotteryResult(
        lowerCaseWalletAddress,
        parseInt(lotteryId),
        parseInt(journeyId),
        isPrunedBool
      ),
    ]);

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

app.post("/api/user-yield", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const response = await fetchTotalUserYield(walletAddress);
    res.json(response);
  } catch (error) {
    console.error(`Master Service: Total User Yield API Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Total User Yield API Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/user-fuel-cells-mapping", async (req, res) => {
  try {
    const { walletAddress, cursor, batchSize } = req.body;
    const response = await fetchUserFuelCellsMappingWithTotalYield(
      walletAddress,
      cursor,
      batchSize || 500
    );
    res.json(response);
  } catch (error) {
    console.error(`Master Service: Total User Yield API Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Total User Yield API Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/fuel-cell-metadata/:fuelCellId", async (req, res) => {
  try {
    const { fuelCellId } = req.params;
    const journeyId = await fetchJourneyIdForFuelCell(parseInt(fuelCellId, 10));
    let metadataDocument = await fuelCellMetadataModel.findOne({
      journeyId: journeyId,
    });
    if (!metadataDocument) {
      metadataDocument = await fuelCellMetadataModel.findOne({
        journeyId: "default",
      });
    }
    return res.json(metadataDocument?.metadata || {});
  } catch (error) {
    console.error(`Master Service: Fuel Cell Metadata API Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Fuel Cell Metadata API Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/assign-points", async (req, res) => {
  try {
    const { walletAddress, points, secret } = req.body;
    const adminSecret = secrets?.POINTS_ADMIN_SECRET;

    if (adminSecret !== secret) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: Invalid Admin Secret.",
      });
    }

    if (!walletAddress || points == null) {
      return res.status(400).json({
        success: false,
        error: "Wallet Address and Points are required.",
      });
    }

    if (typeof points !== "number" || Number.isNaN(points)) {
      return res.status(400).json({
        success: false,
        error: "Points must be a valid number.",
      });
    }

    await assignPointsByAdmin(walletAddress, points);
    res.json({ success: true });
  } catch (error) {
    console.error(`Master Service: Assign Points API Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Assign Points API Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/save-fuel-cell-metadata", async (req, res) => {
  try {
    const { journeyId, metadata } = req.body;

    if (!journeyId || typeof journeyId !== "number") {
      return res.status(400).json({
        success: false,
        error: "journeyId is required and must be an integer.",
      });
    }

    if (!metadata || typeof metadata !== "object") {
      return res.status(400).json({
        success: false,
        error: "metadata is required and must be an object.",
      });
    }

    const updatedDocument = await fuelCellMetadataModel.findOneAndUpdate(
      { journeyId },
      { journeyId, metadata },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: "Metadata saved successfully.",
      metadata: updatedDocument.metadata,
    });
  } catch (error) {
    console.error(`Master Service: Save Metadata API Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Save Metadata API Error");
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/save-default-fuel-cell-metadata", async (req, res) => {
  try {
    const { metadata } = req.body;

    if (!metadata || typeof metadata !== "object") {
      return res.status(400).json({
        success: false,
        error: "metadata is required and must be an object.",
      });
    }

    const updatedDocument = await fuelCellMetadataModel.findOneAndUpdate(
      { journeyId: "default" },
      { journeyId: "default", metadata },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: "Metadata saved successfully.",
      metadata: updatedDocument.metadata,
    });
  } catch (error) {
    console.error(`Master Service: Save Default Metadata API Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Save Default Metadata API Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/evil-bonus/:journeyId", async (req, res) => {
  try {
    const { journeyId } = req.params;

    const redisKey = `${environment}:api:evilbonus:${journeyId}`;
    const cachedEvilBonusMapping = await redisClient.get(redisKey);
    if (cachedEvilBonusMapping) {
      return res.json(JSON.parse(cachedEvilBonusMapping));
    }

    const evilBonusMapping = await fetchEvilBonusForJourney(
      parseInt(journeyId || 0)
    );
    await redisClient.set(
      redisKey,
      JSON.stringify(evilBonusMapping),
      { EX: 6 * 60 * 60 } // 6 hours expiration time
    );

    res.json(evilBonusMapping);
  } catch (error) {
    console.error(`Master Service: Evil Bonus Fetch Error: ${error}`);
    captureErrorWithContext(error, "Master Service: Evil Bonus Fetch Error");
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/calldata", async (req, res) => {
  try {
    const redisKey = `${environment}:api:piteasquote`;
    const calldata = await redisClient.get(redisKey);
    res.json({ calldata });
  } catch (error) {
    console.error(`Master Service: Piteas Calldata Fetch Error: ${error}`);
    captureErrorWithContext(
      error,
      "Master Service: Piteas Calldata Fetch Error"
    );
    res.status(500).send("Internal Server Error");
  }
});

Sentry.setupExpressErrorHandler(app);

await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
