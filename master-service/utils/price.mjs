import axios from "axios";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

export const fetchTokenPrice = async (
  tokenAddress,
  poolAddress,
  network,
  isNativeToken
) => {
  const timestamp = Math.floor(Date.now() / 1000);
  let url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/networks/${network}/pools/${poolAddress}/ohlcv/minute?before_timestamp=${timestamp}&token=${tokenAddress}`;
  if (isNativeToken) {
    url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/networks/${network}/pools/${poolAddress}/ohlcv/minute?before_timestamp=${timestamp}&token=quote`;
  }

  let response = {};
  try {
    response = await axios.get(url, {
      headers: {
        [secrets?.COINGECKO_API_KEY_HEADER]: secrets?.COINGECKO_API_KEY,
      },
    });
  } catch (e) {
    console.error("Error while fetching token price from CoinGecko: ", e);
  }

  return {
    price: response?.data?.data?.attributes?.ohlcv_list?.[0]?.[1],
  };
};
