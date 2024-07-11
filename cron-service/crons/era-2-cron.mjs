import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import mongoose from "mongoose";
import axios from "axios";
import {
  modifyEra2Contributions,
  generateEra2Points,
} from "../../helpers/helper.mjs";
import { pointsModel, contributionsModel } from "../models/models.mjs";

const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

export const fetchContributions = async (blockchain) => {
  const dbContributions = await contributionsModel.find({ era: 2 });
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  const contributionsQuery = `
    query MyQuery {
      mines {
        amount
        token
        tokenInvested
        user {
          address
        }
        timestamp
        transactionHash
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

  const pointsList = generateEra2Points(insertedContributions, blockchain);

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }
  mongoose.connection.close();
};
