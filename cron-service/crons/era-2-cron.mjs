import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import mongoose from "mongoose";
import axios from "axios";
import {
  modifyEra2Contributions,
  generateEra2Points,
} from "../../helpers/helper.mjs";

const { Schema, model } = mongoose;

const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const fetchContributions = async () => {
  const contributionsSchema = new Schema({}, { strict: false });
  const contributionsModel = model("contributions", contributionsSchema);

  const pointsSchema = new Schema({}, { strict: false });
  const pointsModel = model("points", pointsSchema);

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
  mongoose.connection.close();
};

fetchContributions();
