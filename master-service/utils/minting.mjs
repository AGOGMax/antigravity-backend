import axios from "axios";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { pointsModel, contributionsModel } from "../models/models.mjs";
import {
  generateEra3Points,
  modifyEra3Contributions,
} from "../../helpers/helper.mjs";

const secrets = await fetchSecretsList();
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const verifyMinting = async (walletAddress) => {
  await sleep(parseInt(secrets?.SUBGRAPH_DELAY));

  const dbContributions = await contributionsModel.find({ era: 3 });
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  const contributionsQuery = `
    query MyQuery {
        mints(orderDirection: desc, orderBy: transactionHash) {
          amount
          id
          timestamp
          transactionHash
          journeyId
          user {
            address
          }
        }
      }
    `;

  const response = await axios.post(
    secrets?.ERA_3_SUBGRAPH_URL,
    {
      query: contributionsQuery,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const contributions = response?.data?.data?.mints;
  const newContributions = contributions.filter(
    (contribution) => !dbTransactionHashes.has(contribution.transactionHash)
  );

  const modifiedContributions = modifyEra3Contributions(newContributions);

  const insertedContributions = await contributionsModel.insertMany(
    modifiedContributions
  );

  const era2ContributorsQuery = await contributionsModel
    .aggregate([
      { $match: { era: 2, darkXTokenAmount: { $gt: 0 } } },
      { $group: { _id: "$walletAddress" } },
    ])
    .exec();

  const era2Contributors = era2ContributorsQuery.map(
    (contribution) => contribution._id
  );

  const pointsList = await generateEra3Points(
    insertedContributions,
    era2Contributors
  );

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }

  return { success: true };
};
