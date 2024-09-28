import axios from "axios";
import {
  evilTokensBlockModel,
  lotteryEntriesModel,
  lotteryResultsModel,
} from "../models/models.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { chunkArray } from "../../helpers/helper.mjs";
import { fetchPrunedTokenIds } from "../../helpers/helper.mjs";

const secrets = await fetchSecretsList();

const fetchAndAttachAddresses = async (lotteryBatch) => {
  const tokenIds = lotteryBatch.map((item) => item.tokenId);
  const tokenIdsString = tokenIds.map((id) => `"${id}"`).join(",");

  const usersQuery = `
      query MyQuery {
        fuelCells(where: {tokenId_in: [${tokenIdsString}]}, limit: 900) {
          items{
            tokenId
            owner {
                address
            }
          }
        }
      }
    `;

  let response = {};
  try {
    response = await axios.post(
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
  } catch (e) {
    console.error(
      "Master Service: Error while fetching address for lottery entries: ",
      e
    );
  }

  const fuelCells = response.data?.data?.fuelCells?.items || [];
  const tokenIdToAddressMap = fuelCells?.reduce((acc, fuelCell) => {
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

const isLotteryResultIndexedOnSubgraph = async (journeyId, lotteryId) => {
  const lotteryResultQuery = `
  query MyQuery {
    lotteryResults(where: { lotteryId: "${lotteryId}", journeyId: "${journeyId}" }) {
      items {
        uri
      }
    }
  }
    `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: lotteryResultQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error(
      "Master Service: Error while fetching lotter result from subgraph: ",
      e
    );
  }

  const lotteryResults = response?.data?.data?.lotteryResults?.items || [];
  return (lotteryResults?.length || 0) > 0;
};

const saveLotteryResult = async (uri, lotteryEntries, intervalId) => {
  const { journeyId, lotteryId } = lotteryEntries[0];
  const isLotteryResultPresentOnSubgraph =
    await isLotteryResultIndexedOnSubgraph(journeyId, lotteryId);

  if (!isLotteryResultPresentOnSubgraph) {
    console.log(
      `Master Service: J-${journeyId} L-${lotteryId} result not found on subgraph.`
    );
    return;
  }

  clearInterval(intervalId);

  const lotteryBatches = chunkArray(lotteryEntries, 900);

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

const fetchEvilFunctionalityTokens = async (walletAddress, isPruned) => {
  const desiredFields = {
    tokenId: 1,
    journeyId: 1,
    lotteryId: 1,
    _id: 0,
  };

  const blockedTokens = (await evilTokensBlockModel.find()).map(
    (blockedToken) => blockedToken.tokenId
  );

  const evilTokens = await lotteryEntriesModel.aggregate([
    {
      $match: {
        tokenId: { $nin: blockedTokens },
        walletAddress: walletAddress,
        isPruned: isPruned,
      },
    },
    {
      $sort: { tokenId: 1 },
    },
    {
      $limit: parseInt(secrets?.EVIL_FUNCTIONALITY_RESULT_LENGTH) || 10,
    },
    {
      $project: desiredFields,
    },
  ]);

  const tokensToBlock = evilTokens.map((token) => {
    return { tokenId: token.tokenId };
  });
  await evilTokensBlockModel.insertMany(tokensToBlock);

  return evilTokens;
};

const fetchLotteryResult = async (
  walletAddress,
  lotteryId,
  journeyId,
  isPruned
) => {
  const isEvilAddress =
    walletAddress === secrets?.EVIL_CONTRACT_ADDRESS?.toLowerCase();
  const desiredFields = ["tokenId", "journeyId", "lotteryId", "-_id"];
  if (isEvilAddress) {
    const evilTokens = await fetchEvilFunctionalityTokens(
      walletAddress,
      isPruned
    );
    return evilTokens;
  }
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
  const tokenIdsBatches = chunkArray(tokenIds, 900);

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
