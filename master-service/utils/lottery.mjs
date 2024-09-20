import axios from "axios";
import { lotteryEntriesModel, lotteryResultsModel } from "../models/models.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { chunkArray } from "../../helpers/helper.mjs";
import { fetchPrunedTokenIds } from "../../helpers/helper.mjs";

const secrets = await fetchSecretsList();

const fetchAndAttachAddresses = async (lotteryBatch) => {
  const tokenIds = lotteryBatch.map((item) => item.tokenId);

  const usersQuery = `
        query MyQuery {
            fuelCells(where: {tokenId_in: [${tokenIds.join(",")}]}) {
            tokenId
            owner {
                address
            }
            }
        }
    `;

  const response = await axios.post(
    secrets?.ERA_3_SUBGRAPH_URL,
    {
      query: usersQuery,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const fuelCells = response.data.data.fuelCells;
  const tokenIdToAddressMap = fuelCells.reduce((acc, fuelCell) => {
    acc[fuelCell.tokenId] = fuelCell.owner.address;
    return acc;
  }, {});

  const updatedLotteryBatch = lotteryBatch.map((item) => ({
    ...item,
    walletAddress: tokenIdToAddressMap[item.tokenId]?.toLowerCase() || null,
    isPruned: false,
  }));

  return updatedLotteryBatch;
};

const saveLotteryResult = async (uri, lotteryEntries) => {
  const { journeyId, lotteryId } = lotteryEntries[0];

  const lotteryBatches = chunkArray(lotteryEntries, 1000);

  let lotteryBatchesWithAddress = [];
  for (const batch of lotteryBatches) {
    const updatedBatch = await fetchAndAttachAddresses(batch);
    lotteryBatchesWithAddress = [...lotteryBatchesWithAddress, ...updatedBatch];
  }

  try {
    await lotteryResultsModel.insertMany([{ uri, journeyId, lotteryId }]);
  } catch (error) {
    if (error.code === 11000) {
      console.log("Duplicate entry found for lottery result, skipping it.");
    }
  }

  try {
    await lotteryEntriesModel.insertMany(lotteryBatchesWithAddress);
  } catch (error) {
    if (error.code === 11000) {
      console.log("Duplicate entry found for lottery entry, skipping it.");
    }
  }
};

const fetchLotteryResult = async (
  walletAddress,
  lotteryId,
  journeyId,
  isPruned
) => {
  const desiredFields = ["tokenId", "journeyId", "lotteryId", "-_id"];
  if (walletAddress) {
    if (lotteryId && journeyId) {
      return lotteryEntriesModel
        .find({
          walletAddress: walletAddress,
          lotteryId: lotteryId,
          journeyId: journeyId,
          isPruned: isPruned,
        })
        .select(desiredFields);
    } else if (lotteryId) {
      return lotteryEntriesModel
        .find({
          walletAddress: walletAddress,
          lotteryId: lotteryId,
          isPruned: isPruned,
        })
        .select(desiredFields);
    } else if (journeyId) {
      return lotteryEntriesModel
        .find({
          walletAddress: walletAddress,
          journeyId: journeyId,
          isPruned: isPruned,
        })
        .select(desiredFields);
    } else {
      return lotteryEntriesModel
        .find({
          walletAddress: walletAddress,
          isPruned: isPruned,
        })
        .select(desiredFields);
    }
  }
  return [];
};

const fetchLotteryResults = async (lotteryId, journeyId) => {
  const desiredFields = ["tokenId", "journeyId", "lotteryId", "-_id"];
  if (lotteryId && journeyId) {
    return lotteryEntriesModel
      .find({
        lotteryId: lotteryId,
        journeyId: journeyId,
        isPruned: false,
      })
      .select(desiredFields);
  } else if (lotteryId) {
    return lotteryEntriesModel
      .find({
        lotteryId: lotteryId,
        isPruned: false,
      })
      .select(desiredFields);
  } else if (journeyId) {
    return lotteryEntriesModel
      .find({
        journeyId: journeyId,
        isPruned: false,
      })
      .select(desiredFields);
  }
  return lotteryEntriesModel.find({ isPruned: false }).select(desiredFields);
};

const pruneTokens = async (walletAddress) => {
  const tokens = await lotteryEntriesModel.find({
    walletAddress: walletAddress,
    isPruned: false,
  });

  const tokenIds = tokens.map((token) => token.tokenId);
  const tokenIdsBatches = chunkArray(tokenIds, 1000);

  let prunedTokenIds = [];
  for (const batch of tokenIdsBatches) {
    const updatedBatch = await fetchPrunedTokenIds(batch);
    prunedTokenIds = [...prunedTokenIds, ...updatedBatch];
  }

  await lotteryEntriesModel.updateMany(
    { tokenId: { $in: prunedTokenIds } },
    { $set: { isPruned: true } }
  );
  return { success: true };
};

const fetchTokensUsingUniqueCombinations = async (walletAddress) => {
  const desiredFields = ["tokenId", "journeyId", "lotteryId", "-_id"];
  if (walletAddress) {
    const tokens = await lotteryEntriesModel.find({
      walletAddress: walletAddress,
      isPruned: false,
    });

    const uniqueCombinations = [
      ...new Set(
        tokens.map((token) => `${token.journeyId}-${token.lotteryId}`)
      ),
    ].map((combination) => {
      const [journeyId, lotteryId] = combination.split("-").map(Number);
      return { journeyId, lotteryId };
    });

    const queryArray = uniqueCombinations.map((combination) => ({
      journeyId: combination.journeyId,
      lotteryId: combination.lotteryId,
    }));

    let results = [];
    try {
      results = await lotteryEntriesModel
        .find({ $or: queryArray })
        .select(desiredFields);
    } catch (error) {
      console.error(
        `Master Service: Error while fetching entries from unique combinations: ${error}`
      );
    }

    const resultsMapping = results.reduce(
      (mapping, { tokenId, journeyId, lotteryId }) => {
        const key = `${journeyId}_${lotteryId}`;
        (mapping[key] = mapping[key] || []).push({
          tokenId,
          journeyId,
          lotteryId,
        });
        return mapping;
      },
      {}
    );
    return resultsMapping;
  }
  return {};
};

export {
  saveLotteryResult,
  fetchLotteryResult,
  fetchLotteryResults,
  pruneTokens,
  fetchTokensUsingUniqueCombinations,
};
