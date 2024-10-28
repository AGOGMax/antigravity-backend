import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import axios from "axios";
import {
  modifyEra2Contributions,
  generateEra2Points,
} from "../../helpers/helper.mjs";
import { pointsModel, contributionsModel } from "../models/models.mjs";
import { captureErrorWithContext } from "../start-crons.mjs";

const secrets = await fetchSecretsList();

export const fetchContributions = async (blockchain) => {
  const dbContributions = await contributionsModel.find({ era: 2 });
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  const contributionsQuery = `
    query MyQuery {
      mines(orderBy: "timestamp", orderDirection: "desc") {
        items {
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
    }
  `;

  const url =
    blockchain === "base"
      ? secrets?.ERA_2_BASE_SUBGRAPH_URL
      : secrets?.ERA_2_PULSECHAIN_SUBGRAPH_URL;

  let response = {};
  try {
    response = await axios.post(
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
  } catch (e) {
    console.error("Error while fetching era-2 contributions: ", e);
    captureErrorWithContext(e, "Error while fetching era-e contributions.");
  }

  const contributions = response?.data?.data?.mines?.items;

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

  console.log("Era 2 Inserted Contributions: ", insertedContributions);

  const pointsList = await generateEra2Points(
    insertedContributions,
    blockchain
  );
  console.log("Era 2 Points List: ", pointsList);

  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }
};
