import axios from "axios";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const secrets = await fetchSecretsList();

export const fetchTokenPrice = async (
  tokenAddress,
  poolAddress,
  network,
  timestamp,
  isNativeToken
) => {
  let url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/networks/${network}/pools/${poolAddress}/ohlcv/minute?before_timestamp=${timestamp}&token=${tokenAddress}`;
  if (isNativeToken) {
    url = `${secrets?.COINGECKO_API_URL}/api/v3/onchain/networks/${network}/pools/${poolAddress}/ohlcv/minute?before_timestamp=${timestamp}&token=quote`;
  }

  const response = await axios.get(url, {
    headers: {
      [secrets?.COINGECKO_API_KEY_HEADER]: secrets?.COINGECKO_API_KEY,
    },
  });

  return {
    price: response?.data?.data?.attributes?.ohlcv_list?.[0]?.[1],
  };
};
