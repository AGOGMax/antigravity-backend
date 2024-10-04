import axios from "axios";
import { ethers } from "ethers";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

const fetchYieldAmountPerFuelCellMapping = async () => {
  const yieldQuery = `
        query MyQuery {
            yieldPayouts(limit: 900) {
                items {
                    journeyId
                    amountPerFuelCell
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

  const yieldPayoutMapping = yieldPayouts.reduce((acc, yieldPayout) => {
    if (!acc[yieldPayout.journeyId]) {
      acc[yieldPayout.journeyId] = 0;
    }
    acc[yieldPayout.journeyId] += parseInt(yieldPayout.amountPerFuelCell, 10);
    return acc;
  }, {});

  return yieldPayoutMapping;
};

const userOwnedFuelCellsQuery = (walletAddress, afterCursor) => `query MyQuery {
    users(where: { address: "${walletAddress}" }) {
      items {
        ownedFuelCells(after: ${
          afterCursor ? `"${afterCursor}"` : null
        }, limit: 900) {
          items {
            id
            journeyId
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }`;

const fetchUserOwnedFuelCells = async (walletAddress) => {
  let userOwnedFuelCells = [];
  let hasNextPage = true;
  let endCursor = null;

  const checksumWalletAddress = ethers.getAddress(walletAddress);

  try {
    while (hasNextPage) {
      const response = await axios.post(
        secrets?.ERA_3_SUBGRAPH_URL,
        {
          query: userOwnedFuelCellsQuery(checksumWalletAddress, endCursor),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const currentFuelCells =
        response?.data?.data?.users?.items?.[0]?.ownedFuelCells?.items || [];
      const pageInfo =
        response?.data?.data?.users?.items?.[0]?.ownedFuelCells?.pageInfo || {};

      userOwnedFuelCells = userOwnedFuelCells.concat(
        currentFuelCells.map((fuelCell) => {
          return { ...fuelCell, journeyId: parseInt(fuelCell.journeyId, 10) };
        })
      );

      hasNextPage = pageInfo.hasNextPage;
      endCursor = pageInfo.endCursor;
    }
  } catch (e) {
    console.error(
      "Cron Service: Error while fetching mints from subgraph: ",
      e
    );
  }

  return userOwnedFuelCells;
};

const fetchTotalUserYield = async (walletAddress) => {
  const [yieldMapping, userOwnedFuelCells] = await Promise.all([
    fetchYieldAmountPerFuelCellMapping(),
    fetchUserOwnedFuelCells(walletAddress),
  ]);

  const userFuelCellsMapping = userOwnedFuelCells.reduce((acc, fuelCell) => {
    const journeyId = fuelCell.journeyId;

    if (!acc[journeyId]) {
      acc[journeyId] = 0;
    }

    acc[journeyId] += 1;
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

const fetchUserFuelCellsMappingWithTotalYield = async (walletAddress) => {
  const [yieldMapping, userOwnedFuelCells] = await Promise.all([
    fetchYieldAmountPerFuelCellMapping(),
    fetchUserOwnedFuelCells(walletAddress),
  ]);

  const userFuelCellsMapping = userOwnedFuelCells.reduce((acc, fuelCell) => {
    const { id, journeyId } = fuelCell;

    if (!acc[journeyId]) {
      acc[journeyId] = {
        fuelCells: [],
        totalYieldPerFuelCell: yieldMapping[journeyId] || 0,
      };
    }
    acc[journeyId].fuelCells.push(id);

    return acc;
  }, {});

  return userFuelCellsMapping;
};

export { fetchTotalUserYield, fetchUserFuelCellsMappingWithTotalYield };
