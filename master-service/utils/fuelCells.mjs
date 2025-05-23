import axios from "axios";
import { ethers, getAddress } from "ethers";
import isEmpty from "lodash/isEmpty.js";
import {
  darkContract,
  darkPayoutCalculatorContract,
} from "./contractClients.mjs";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();
const environment = process.env.ENV || "TEST";

const getCurrentJourneyId = async () => {
  const journeyId = await darkPayoutCalculatorContract.getCurrentJourney();
  return Number(journeyId);
};

const getTotalFuelCellsInJourney = async (journeyId, redisClient) => {
  const cacheKey = `${environment}:fuel-cell-summary:journey:total-fuel-cells:${journeyId}`;
  const cachedValue = await redisClient.get(cacheKey);
  if (cachedValue) {
    return Number(cachedValue);
  }
  const totalFuelCells =
    await darkPayoutCalculatorContract.getActiveNftsInJourney(journeyId);
  await redisClient.set(cacheKey, totalFuelCells.toString(), {
    EX: 60 * 60, // 1 hour
  });
  return Number(totalFuelCells);
};

const getDarkAmountPerFuelCell = async (journeyId, redisClient) => {
  const cacheKey = `${environment}:fuel-cell-summary:journey:dark-amount:${journeyId}`;
  const cachedValue = await redisClient.get(cacheKey);
  if (cachedValue) {
    return Number(cachedValue);
  }
  const darkAmount =
    await darkPayoutCalculatorContract.getTotalDarkPayoutForJourney(journeyId);
  await redisClient.set(cacheKey, ethers.formatEther(darkAmount), {
    EX: 60 * 60, // 1 hour
  });
  return Number(ethers.formatEther(darkAmount));
};

const getJourneyTokenRange = async (journeyId) => {
  const [start, end] = await darkPayoutCalculatorContract.getJourneyTokenRange(
    journeyId
  );
  return { start: BigInt(start), end: BigInt(end) };
};

const getActiveNftsInRangeForUser = async (start, end, walletAddress) => {
  return await darkPayoutCalculatorContract.getActiveNftsInRangeForUser(
    start,
    end,
    walletAddress
  );
};

const getUserFuelCellCount = async (journeyId, walletAddress, redisClient) => {
  const cacheKey = `${environment}:fuel-cell-summary:user-fuel-cell-count:${journeyId}:${walletAddress}`;
  const cachedValue = await redisClient.get(cacheKey);
  if (cachedValue) {
    return Number(cachedValue);
  }
  const { start, end } = await getJourneyTokenRange(journeyId);
  const rangeSize = BigInt(1000);

  const rangePromises = [];
  for (let i = start; i <= end; i += rangeSize) {
    const batchEnd =
      i + rangeSize - BigInt(1) > end ? end : i + rangeSize - BigInt(1);
    rangePromises.push(getActiveNftsInRangeForUser(i, batchEnd, walletAddress));
  }

  const activeNFTs = await Promise.all(rangePromises);
  const total = activeNFTs.reduce((sum, current) => sum + current, BigInt(0));
  await redisClient.set(cacheKey, total.toString(), {
    EX: 60 * 60, // 1 hour
  });
  return Number(total);
};

const fetchDarkPrice = async (redisClient) => {
  const cacheKey = `${environment}:fuel-cell-summary:dark-price`;
  const cachedValue = await redisClient.get(cacheKey);
  if (cachedValue) {
    return Number(cachedValue);
  }
  const primaryUrl = `https://api.geckoterminal.com/api/v2/networks/pulsechain/pools/${secrets?.DARK_PAIR_ADDRESS}`;
  const fallbackUrl = `https://api.dexscreener.com/latest/dex/pairs/pulsechain/${secrets?.FALLBACK_DARK_PAIR_ADDRESS}`;

  try {
    const response = await axios.get(primaryUrl);

    if (response.status === 200) {
      const priceUsd = Number(
        response.data?.data?.attributes?.base_token_price_usd
      );
      await redisClient.set(cacheKey, (priceUsd || 0).toString(), {
        EX: 60 * 60, // 1 hour
      });
      return priceUsd || 0;
    } else {
      throw new Error("Primary API returned non-200 status");
    }
  } catch (error) {
    const fallbackResponse = await axios.get(fallbackUrl);
    if (fallbackResponse.status === 200) {
      const fallbackPrice = Number(fallbackResponse.data?.pair?.priceUsd);
      await redisClient.set(cacheKey, (fallbackPrice || 0).toString(), {
        EX: 60 * 60, // 1 hour
      });
      return fallbackPrice || 0;
    }

    return 0;
  }
};

const getExcludedFuelCellsCount = async (journeyId, redisClient) => {
  const cacheKey = `${environment}:fuel-cell-summary:journey:excluded-fuel-cells:${journeyId}`;
  const cachedValue = await redisClient.get(cacheKey);
  if (cachedValue) {
    return Number(cachedValue);
  }
  const fuelCellExclusionList = JSON.parse(secrets?.FUEL_CELL_EXCLUSION_LIST); //Fetch the fuel cells owned by excluded wallets from secrets manager
  if (
    !Array.isArray(fuelCellExclusionList) ||
    fuelCellExclusionList.length === 0
  ) {
    return 0;
  }

  const exclusionPromises = fuelCellExclusionList.map(async (address) => {
    const checksummedAddress = getAddress(address);
    return await getUserFuelCellCount(journeyId, checksummedAddress);
  });

  const exclusionCounts = await Promise.all(exclusionPromises);
  const totalExcludedFuelCells = exclusionCounts.reduce((sum, count) => {
    return sum + count;
  }, 0);
  await redisClient.set(cacheKey, totalExcludedFuelCells.toString(), {
    EX: 60 * 60, // 1 hour
  });

  return totalExcludedFuelCells;
};

function getLeagueDetails(userFuelCells, totalEffectiveFuelCells) {
  //Use percentage of user fuel cells to determine league, and upcoming league and fuel cells to next league
  const percentage = (userFuelCells / totalEffectiveFuelCells) * 100;

  const leagues = [
    { name: "Pulsar Poseidon", threshold: 10 },
    { name: "Warp Speed Whale", threshold: 1 },
    { name: "Sonic Shark", threshold: 0.1 },
    { name: "Dark Dolphin", threshold: 0.01 },
    { name: "Stellar Squid", threshold: 0.001 },
    { name: "Cosmic Crab", threshold: 0.0001 },
    { name: "Shrouded Shrimp", threshold: 0.00001 },
  ];

  for (let i = 0; i < leagues.length; i++) {
    const league = leagues[i];
    if (percentage >= league.threshold) {
      const nextLeague = leagues[i - 1];
      if (nextLeague) {
        const requiredFuelCells =
          Math.ceil((nextLeague.threshold / 100) * totalEffectiveFuelCells) -
          userFuelCells;

        return {
          currentLeague: league.name,
          nextLeague: nextLeague.name,
          fuelCellsToNext: Math.max(requiredFuelCells, 0),
        };
      } else {
        return {
          currentLeague: league.name,
        };
      }
    }
  }

  const lowest = leagues[leagues.length - 1];
  const requiredFuelCells =
    Math.ceil((lowest.threshold / 100) * totalEffectiveFuelCells) -
    userFuelCells;

  return {
    currentLeague: "Shifty Shell",
    nextLeague: lowest.name,
    fuelCellsToNext: Math.max(requiredFuelCells, 0),
  };
}

const fetchTreasuryBalance = async (redisClient) => {
  const cacheKey = `${environment}:fuel-cell-summary:treasury-balance`;
  const cachedValue = await redisClient.get(cacheKey);
  if (cachedValue) {
    return Number(cachedValue);
  }
  const treasuryAddress = secrets?.TREASURY_ADDRESS;
  const treasuryBalance = await darkContract.balanceOf(treasuryAddress);
  const treasuryBalanceInEth = ethers.formatEther(treasuryBalance);
  await redisClient.set(cacheKey, treasuryBalanceInEth.toString(), {
    EX: 60 * 60, // 1 hour
  });
  return Number(treasuryBalanceInEth);
};

const getPayoutPercentage = (journeyId) => {
  //Payout percentage is 3% for the first journey and decreases by 10% for each subsequent journey
  let payout = 3;
  for (let i = 2; i <= journeyId; i++) {
    payout -= payout * 0.1;
  }
  return payout;
};

const fetchFuelCellsSummary = async (walletAddress, redisClient) => {
  const journeyId = await getCurrentJourneyId(); //Fetch the current journey ID from dark payout calculator

  const journeyPromises = [];
  for (let i = 1; i <= journeyId; i++) {
    const promises = [
      //For every journey, fetch total fuel cells, excluded fuel cells, dark amount per fuel cell
      getTotalFuelCellsInJourney(i, redisClient),
      getExcludedFuelCellsCount(i, redisClient),
      getDarkAmountPerFuelCell(i, redisClient),
    ];

    if (!isEmpty(walletAddress)) {
      //If wallet address is provided, fetch user fuel cell count
      const checksummedAddress = getAddress(walletAddress);
      promises.push(getUserFuelCellCount(i, checksummedAddress, redisClient));
    }

    journeyPromises.push(Promise.all(promises));
  }

  const priceAndBalancePromise = [
    fetchDarkPrice(redisClient),
    fetchTreasuryBalance(redisClient),
  ]; //Fetch DARK price from geckoterminal and treasury balance from dark contract using balanceOf
  const [darkPrice, treasuryBalance, ...journeyData] = await Promise.all([
    ...priceAndBalancePromise,
    ...journeyPromises,
  ]);

  let totalUserFuelCells = 0; //Initialise total user fuel cells and total effective fuel cells (total fuel cells - excluded fuel cells)
  let totalEffectiveFuelCells = 0;
  const journeySummary = journeyData.map((data, index) => {
    const [totalFuelCells, excludedFuelCellCount, darkAmount, userFuelCells] =
      data;

    const payoutPercentage = getPayoutPercentage(index + 1); //Calculate payout percentage based on journey ID
    const journeyPayoutByTreasuryBalance =
      (treasuryBalance * payoutPercentage * 0.01) / totalFuelCells; //Calculate payout by treasury balance
    const projectedDark = darkAmount + journeyPayoutByTreasuryBalance; //Calculate projected dark amount by adding dark amount and treasury balance payout

    if (userFuelCells !== undefined) {
      totalUserFuelCells += userFuelCells;
    }
    totalEffectiveFuelCells += totalFuelCells - excludedFuelCellCount;

    return {
      journeyId: index + 1,
      totalFuelCells,
      darkAmount: darkAmount.toFixed(3),
      darkPrice: darkPrice.toFixed(3),
      excludedFuelCellCount,
      projectedDark: projectedDark.toFixed(3),
      ...(userFuelCells !== undefined && { userFuelCells }),
    };
  });

  if (!isEmpty(walletAddress)) {
    const league = getLeagueDetails(
      //Get league details based on user fuel cells and total effective fuel cells
      totalUserFuelCells,
      totalEffectiveFuelCells
    );
    return {
      league: league,
      journeySummary,
    };
  }

  return { journeySummary };
};

export { fetchFuelCellsSummary };

// 1. Journey ID
// 2. Total Fuel Cells in Journey
// 3. Total Cash Value
// 4. Amount of Dark (This should be per fuel cell, or the total amount of dark)
// 5. Fuel Cell of the User in that Journey
// 6. League (Should this be decided based on number of Fuel cells?)
