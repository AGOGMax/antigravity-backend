import express from "express";
import { fetchNFT } from "./utils/nft.mjs";
import { fetchSecretsList } from "../secrets-manager/secrets-manager.mjs";
import * as Sentry from "@sentry/node";

const secrets = await fetchSecretsList();
const environment = process.env.ENV || "TEST";

const app = express();
app.use(express.json());

Sentry.init({
  dsn: secrets?.SENTRY_DSN_URL,
  tracesSampleRate: 0.3,
  enabled: environment === "PRODUCTION",
  environment: environment,
});

const captureErrorWithContext = (error, contextMessage) => {
  Sentry.withScope((scope) => {
    scope.setExtra("contextMessage", contextMessage);
    Sentry.captureException(error);
  });
};

app.post("/api/generate-nft", async (req, res) => {
  try {
    const { nftPayload, filename } = req.body;
    const url = await fetchNFT(nftPayload, filename);
    res.json({ url });
  } catch (error) {
    console.error(`NFT Service: Generate NFT: ${error}`);
    captureErrorWithContext(error, "NFT Service: Generate NFT");
    res.status(500).send("Internal Server Error");
  }
});

Sentry.setupExpressErrorHandler(app);
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { captureErrorWithContext };
