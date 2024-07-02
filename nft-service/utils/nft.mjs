import AWS from "aws-sdk";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";
import isEmpty from "lodash/isEmpty.js";
import generateEra1Html from "./generateEra1Html.mjs";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { unlink } from "fs";
import path from "path";
import generateEra2Html from "./generateEra2Html.mjs";

const s3 = new AWS.S3();
const secrets = await fetchSecretsList();

const fetchNFTFromS3 = async (filename) => {
  const bucketName = secrets?.S3_BUCKET_NAME;
  const regionName = secrets?.S3_REGION_NAME;

  const params = {
    Bucket: bucketName,
    Key: `nft/${filename}.png`,
  };

  try {
    await s3.headObject(params).promise();
    const url = `https://${bucketName}.s3.${regionName}.amazonaws.com/${params.Key}`;
    return url;
  } catch (error) {
    console.error("Error fetching file from S3:", error);
    return null;
  }
};

const generateNFTBuffer = async (filename) => {
  const browser = await puppeteer.launch({
    args: ["--disable-web-security"],
    defaultViewport: null,
  });
  const page = await browser.newPage();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const htmlFilePath = path.join(__dirname, "../static", `${filename}.html`);

  page.goto(`file://${htmlFilePath}`);

  await page.waitForSelector("#container");
  const content = await page.$("#container");
  const imageBuffer = await content.screenshot({ omitBackground: true });

  unlink(htmlFilePath, (err) => {
    if (err) {
      console.error(`Error deleting file: ${err}`);
      return;
    }
    console.log(`File ${htmlFilePath} has been deleted`);
  });
  page.close();
  browser.close();
  return imageBuffer;
};

const uploadNftToS3 = async (imageBuffer, filename) => {
  const bucketName = secrets?.S3_BUCKET_NAME;
  const regionName = secrets?.S3_REGION_NAME;

  const params = {
    Bucket: bucketName,
    Key: `nft/${filename}.png`,
    Body: imageBuffer,
    ContentType: "image/png",
  };

  let url = "";
  try {
    await s3.upload(params).promise();
    url = `https://${bucketName}.s3.${regionName}.amazonaws.com/${params.Key}`;
    console.log(
      "Successfully uploaded data to " +
        bucketName +
        "/" +
        `nft/${filename}.png`
    );
    console.log("File URL: ", url);
  } catch (err) {
    console.log("Error uploading data: ", err);
  }
  return url;
};

export const fetchNFT = async (nftPayload, filename) => {
  const s3NftUrl = await fetchNFTFromS3(filename);

  if (!isEmpty(s3NftUrl)) {
    return s3NftUrl;
  } else {
    if (nftPayload.era === 1) {
      generateEra1Html(nftPayload, filename);
    } else if (nftPayload.era === 2) {
      generateEra2Html(nftPayload, filename);
    }
    const nftBuffer = await generateNFTBuffer(filename);
    const generatedNftUrl = await uploadNftToS3(nftBuffer, filename);
    return generatedNftUrl;
  }
};
