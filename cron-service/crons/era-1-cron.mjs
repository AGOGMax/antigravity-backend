import axios from "axios";
import { google } from "googleapis";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import isEmpty from "lodash/isEmpty.js";
import mongoose from "mongoose";
import { getMultiplier } from "../../helpers/helper.mjs";

const { Schema, model } = mongoose;

const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const urlKeyMapping = {
  ethereum: "ETHEREUM_INDEXER_URL_ERA_1",
  pulsechain: "PULSECHAIN_INDEXER_URL_ERA_1",
};

const tokenContractAddressMapping = {
  ethereum: "ETHEREUM_TOKEN_CONTRACT_ADDRESS_ERA_1",
  pulsechain: "PULSECHAIN_TOKEN_CONTRACT_ADDRESS_ERA_1",
};

const fetchPulsechainTokenTransfers = async () => {
  const response = await axios.get(
    `${secrets[urlKeyMapping?.pulsechain]}/api/v2/addresses/${
      secrets[tokenContractAddressMapping?.pulsechain]
    }/token-transfers?filter=to`
  );

  const modifiedResponse = response?.data?.items?.map((transfer) => {
    return {
      walletAddress: transfer?.from?.hash,
      transactionHash: transfer?.tx_hash,
      timestamp: new Date(transfer?.timestamp).getTime() / 1000,
      contributionTokenName: transfer?.token?.name,
      contributionTokenSymbol: transfer?.token?.symbol,
      contributionTokenAddress: transfer?.token?.address?.toLowerCase(),
      totalContributionTokenAmount:
        parseFloat(transfer?.total?.value) /
        Math.pow(10, parseFloat(transfer?.total?.decimals)),
    };
  });

  return modifiedResponse;
};

const fetchPulsechainTransactions = async () => {
  const response = await axios.get(
    `${
      secrets[urlKeyMapping?.pulsechain]
    }/api?module=account&action=txlist&address=${
      secrets[tokenContractAddressMapping?.pulsechain]
    }`
  );

  const modifiedResponse = response?.data?.result?.map((transfer) => {
    return {
      walletAddress: transfer?.from,
      transactionHash: transfer?.hash,
      timestamp: parseInt(transfer?.timeStamp),
      contributionTokenName: "Pulsechain",
      contributionTokenSymbol: "PLS",
      contributionTokenAddress: secrets?.WPLS_PULSECHAIN_ADDRESS?.toLowerCase(),
      totalContributionTokenAmount:
        parseFloat(transfer?.value) / Math.pow(10, 18),
    };
  });

  return modifiedResponse;
};

const fetchGoogleSheetPoolMappings = async (blockchain) => {
  const sheets = google.sheets({
    version: "v4",
    auth: secrets?.GOOGLE_SHEETS_API_KEY,
  });

  const sheetsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: secrets?.POOL_GOOGLE_SHEET_SPREADSHEET_ID,
    range: secrets?.POOL_GOOGLE_SHEET_SPREADSHEET_RANGE,
  });

  let poolMapping = {};

  sheetsResponse?.data?.values?.forEach((value) => {
    if (value[2].toLowerCase() === blockchain) {
      poolMapping[value[0].toLowerCase()] = value[1];
    }
  });
  return poolMapping;
};

const fetchPoolAddressForToken = async (tokenAddress, network) => {
  const url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/search/pools?query=${tokenAddress}&network=${network}`;

  const response = await axios.get(url, {
    headers: {
      [secrets?.COINGECKO_API_KEY_HEADER]: secrets?.COINGECKO_API_KEY,
    },
  });

  const initialPool = response?.data?.data?.[0];
  const desiredPool = response?.data?.data?.reduce(
    (maxFdvPool, currentPool) => {
      if (currentPool?.attributes?.name?.split("/")?.length > 2) {
        return maxFdvPool;
      }

      return parseFloat(currentPool?.attributes?.fdv_usd) >
        parseFloat(maxFdvPool?.attributes?.fdv_usd)
        ? currentPool
        : maxFdvPool;
    },
    initialPool
  );

  if (
    desiredPool === initialPool &&
    initialPool?.attributes?.name?.split("/")?.length > 2
  ) {
    return "";
  }
  return desiredPool?.attributes?.address;
};

const fetchTokenPrice = async (
  tokenAddress,
  poolMapping,
  network,
  timestamp
) => {
  let poolAddress;
  if (poolMapping.hasOwnProperty(tokenAddress)) {
    poolAddress = poolMapping?.[tokenAddress];
  } else {
    poolAddress = await fetchPoolAddressForToken(tokenAddress, network);
  }

  if (isEmpty(poolAddress)) {
    return { price: secrets?.DEFAULT_TOKEN_PRICE_ERA_1, poolAddress };
  }

  let url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/networks/${network}/pools/${poolAddress}/ohlcv/minute?before_timestamp=${timestamp}&token=${tokenAddress}`;
  if (
    (tokenAddress === secrets?.WETH_BASE_ADDRESS?.toLowerCase() &&
      network.toLowerCase() === "ethereum") ||
    (tokenAddress === secrets?.WPLS_PULSECHAIN_ADDRESS?.toLowerCase() &&
      network.toLowerCase() === "pulsechain")
  ) {
    url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/networks/${network}/pools/${poolAddress}/ohlcv/minute?before_timestamp=${timestamp}&token=quote`;
  }

  const response = await axios.get(url, {
    headers: {
      [secrets?.COINGECKO_API_KEY_HEADER]: secrets?.COINGECKO_API_KEY,
    },
  });

  return {
    price: response?.data?.data?.attributes?.ohlcv_list?.[0]?.[1],
    poolAddress,
  };
};

const modifyContributions = async (contributions, blockchain) => {
  const poolMapping = await fetchGoogleSheetPoolMappings(blockchain);
  const modifiedContributions = [];

  for (const contribution of contributions) {
    const tokenPriceAndPoolAddress = await fetchTokenPrice(
      contribution?.contributionTokenAddress,
      poolMapping,
      blockchain,
      contribution?.timestamp
    );

    const contributionTokenUSDPrice = tokenPriceAndPoolAddress?.price;
    const contributionTokenPoolAddress = tokenPriceAndPoolAddress?.poolAddress;
    const approxContributionValueInUSD =
      contributionTokenUSDPrice * contribution?.totalContributionTokenAmount;

    modifiedContributions.push({
      ...contribution,
      contributionTokenUSDPrice,
      approxContributionValueInUSD,
      contributionTokenPoolAddress,
      era: 1,
    });

    await sleep(500);
  }

  return modifiedContributions;
};

const fetchContributions = async (blockchain) => {
  const contributionsSchema = new Schema({}, { strict: false });
  const contributionsModel = model("contributions", contributionsSchema);

  const pointsSchema = new Schema({}, { strict: false });
  const pointsModel = model("points", pointsSchema);

  const transactions =
    blockchain === "pulsechain"
      ? await fetchPulsechainTransactions()
      : await fetchPulsechainTransactions();

  const tokenTransfers =
    blockchain === "pulsechain"
      ? await fetchPulsechainTokenTransfers()
      : await fetchPulsechainTokenTransfers();

  const dbContributions = await contributionsModel.find({});
  const dbTransactionHashes = new Set(
    dbContributions.map((contribution) => contribution.transactionHash)
  );

  //   const contributions = [...transactions, ...tokenTransfers];
  const contributions = [transactions[1], tokenTransfers[1]];

  const newContributions = contributions.filter(
    (contribution) => !dbTransactionHashes.has(contribution.transactionHash)
  );

  const modifiedContributions = await modifyContributions(
    newContributions,
    blockchain
  );

  console.log(modifiedContributions);
  const insertedContributions = await contributionsModel.insertMany(
    modifiedContributions
  );

  let pointsList = [];
  insertedContributions.forEach((contribution) => {
    const multiplier = getMultiplier(contribution.timestamp);
    pointsList.push({
      era: 1,
      walletAddress: contribution.walletAddress,
      contributionId: contribution._id,
      multiplier,
      points: contribution.approxContributionValueInUSD * multiplier,
      isGrantedByAdmin: false,
    });
  });
  console.log("Points List: ", pointsList);
  if (pointsList?.length) {
    await pointsModel.insertMany(pointsList);
  }
  mongoose.connection.close();
};

fetchContributions("pulsechain");
