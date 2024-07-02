import express from "express";
import { fetchNFT } from "./utils/nft.mjs";

const app = express();
app.use(express.json());

app.post("/api/generate-nft", async (req, res) => {
  try {
    const { nftPayload, filename } = req.body;
    const url = await fetchNFT(nftPayload, filename);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
