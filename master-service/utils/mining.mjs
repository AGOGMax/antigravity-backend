import axios from "axios";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { pointsModel, contributionsModel } from "../models/models.mjs";
import {
  generateEra2Points,
  modifyEra2Contributions,
} from "../../helpers/helper.mjs";

const secrets = await fetchSecretsList();

export const verifyMining = async (walletAddress) => {
  const dbContributions = await contributionsModel.find({ era: 2 });
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  const contributionsQuery = `
  query MyQuery {
    mines(where: {user_: {address: "${walletAddress}"}}) {
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

  const url = secrets?.ERA_2_SUBGRAPH_URL;

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

  const modifiedContributions = modifyEra2Contributions(newContributions);
  const insertedContributions = await contributionsModel.insertMany(
    modifiedContributions
  );

  const era1Contributions = await contributionsModel.find({ era: 1 });
  const pointsList = generateEra2Points(
    insertedContributions,
    era1Contributions
  );

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }

  return { success: true };
};
