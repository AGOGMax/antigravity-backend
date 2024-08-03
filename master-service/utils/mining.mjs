import axios from "axios";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { pointsModel, contributionsModel } from "../models/models.mjs";
import {
  generateEra2Points,
  modifyEra2Contributions,
} from "../../helpers/helper.mjs";

const secrets = await fetchSecretsList();
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const verifyMining = async (walletAddress, blockchain) => {
  await sleep(parseInt(secrets?.SUBGRAPH_DELAY));

  const dbContributions = await contributionsModel.find({ era: 2 });
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  const contributionsQuery = `
  query MyQuery {
    mines(orderBy: timestamp, orderDirection: desc, where: {user_: {address: "${walletAddress}"}}) {
      amount
      token
      tokenInvested
      timestamp
      transactionHash
      user {
        address
      }
    }
  }
`;

  const url =
    blockchain === "base"
      ? secrets?.ERA_2_BASE_SUBGRAPH_URL
      : secrets?.ERA_2_PULSECHAIN_SUBGRAPH_URL;

  const response = await axios.post(
    url,
    {
      query: contributionsQuery,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const contributions = response?.data?.data?.mines;
  const newContributions = contributions.filter(
    (contribution) => !dbTransactionHashes.has(contribution.transactionHash)
  );

  const modifiedContributions = modifyEra2Contributions(
    newContributions,
    blockchain
  );
  const insertedContributions = await contributionsModel.insertMany(
    modifiedContributions
  );

  const pointsList = await generateEra2Points(
    insertedContributions,
    blockchain
  );

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }

  return { success: true };
};
