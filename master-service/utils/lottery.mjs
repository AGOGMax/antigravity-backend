import axios from "axios";
import { lotteryEntriesModel, lotteryResultsModel } from "../models/models.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

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
    "https://api.studio.thegraph.com/query/64293/ag-base-sepolia/version/latest" ||
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

  lotteryResultsModel.insertMany([{ uri, journeyId, lotteryId }]);
  lotteryEntriesModel.insertMany(lotteryBatchesWithAddress);
};

const fetchLotteryResult = async (
  walletAddress,
  lotteryId,
  journeyId,
  isPruned
) => {
  if (walletAddress) {
    if (lotteryId && journeyId) {
      return lotteryEntriesModel.find({
        walletAddress: walletAddress,
        lotteryId: lotteryId,
        journeyId: journeyId,
        isPruned: isPruned,
      });
    } else if (lotteryId) {
      return lotteryEntriesModel.find({
        walletAddress: walletAddress,
        lotteryId: lotteryId,
        isPruned: isPruned,
      });
    } else if (journeyId) {
      return lotteryEntriesModel.find({
        walletAddress: walletAddress,
        journeyId: journeyId,
        isPruned: isPruned,
      });
    } else {
      return lotteryEntriesModel.find({
        walletAddress: walletAddress,
        isPruned: isPruned,
      });
    }
  }
  return [];
};

const fetchLotteryResults = async (lotteryId, journeyId) => {
  if (lotteryId && journeyId) {
    return lotteryEntriesModel.find({
      lotteryId: lotteryId,
      journeyId: journeyId,
      isPruned: false,
    });
  } else if (lotteryId) {
    return lotteryEntriesModel.find({
      lotteryId: lotteryId,
      isPruned: false,
    });
  } else if (journeyId) {
    return lotteryEntriesModel.find({
      journeyId: journeyId,
      isPruned: false,
    });
  }
  return lotteryEntriesModel.find({ isPruned: false });
};

export { saveLotteryResult, fetchLotteryResult, fetchLotteryResults };
