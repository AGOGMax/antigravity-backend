import express from "express";
import { fetchLeaderboard } from "./utils/leaderboard.mjs";
import { fetchTokenPrice } from "./utils/price.mjs";
import { enrollUserToNewsletter } from "./utils/newsletter.mjs";
import { checkOrCreateUser } from "./utils/user.mjs";

const app = express();
app.use(express.json());

app.post("/api/leaderboard", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const leaderboard = await fetchLeaderboard(walletAddress);
    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/token-price", async (req, res) => {
  try {
    const { tokenAddress, poolAddress, network, timestamp, isNativeToken } =
      req.body;
    const price = await fetchTokenPrice(
      tokenAddress,
      poolAddress,
      network,
      timestamp,
      isNativeToken
    );
    res.json(price);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/newsletter", async (req, res) => {
  try {
    const { name, email } = req.body;
    const newsletter = await enrollUserToNewsletter(name, email);
    res.json(newsletter);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/user", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const user = await checkOrCreateUser(walletAddress);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
