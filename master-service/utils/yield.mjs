import axios from "axios";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import { contributionsModel } from "../models/models.mjs";

const secrets = await fetchSecretsList();

const fetchYieldAmountPerFuelCellMapping = async () => {
  const yieldQuery = `
        query MyQuery {
            yieldPayouts {
                items {
                    journeyId
                    amountPerFuelCell
                    givenIn
                }
            }
        }
    `;

  let response = {};
  try {
    response = await axios.post(
      secrets?.ERA_3_SUBGRAPH_URL,
      {
        query: yieldQuery,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error(
      "Master Service: Error while fetching yield amount per fuel cell: ",
      e
    );
  }

  const yieldPayouts = response?.data?.data?.yieldPayouts?.items || [];
  const desiredYieldPayouts = yieldPayouts.filter(
    (yieldPayout) => yieldPayout.journeyId === yieldPayout.givenIn
  );

  const yieldPayoutMapping = desiredYieldPayouts.reduce((acc, yieldPayout) => {
    acc[parseInt(yieldPayout.journeyId, 10)] = yieldPayout.amountPerFuelCell;
    return acc;
  }, {});

  return yieldPayoutMapping;
};

const fetchTotalUserYield = async () => {
  const [yieldMapping, userContributions] = await Promise.all([
    fetchYieldAmountPerFuelCellMapping(),
    contributionsModel.find({ era: 3 }),
  ]);

  const userFuelCellsMapping = userContributions.reduce((acc, contribution) => {
    const journeyId = contribution.journeyId;
    const fuelCellsAmount = parseInt(contribution.fuelCellsAmount, 10);

    if (!acc[journeyId]) {
      acc[journeyId] = 0;
    }

    acc[journeyId] += fuelCellsAmount;
    return acc;
  }, {});

  let totalFuelCells = 0;
  let totalYield = 0;

  for (const journeyId in userFuelCellsMapping) {
    const fuelCellsAmount = userFuelCellsMapping[journeyId];
    const yieldValue = yieldMapping[journeyId] || 0;

    totalFuelCells += fuelCellsAmount;
    totalYield += fuelCellsAmount * yieldValue;
  }

  return { totalFuelCells: totalFuelCells, totalYield: totalYield };
};

export { fetchTotalUserYield };
