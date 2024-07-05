import { createWriteStream, existsSync, mkdirSync } from "fs";

const generateTransactionsHTML = (transactions) => {
  let transactionsHTML = "";
  transactions?.forEach((transaction) => {
    transactionsHTML =
      transactionsHTML +
      `<div class="transaction">
         <p class="token_name">${transaction?.contributionTokenName}</p>
         <p class="token_amount">${transaction?.totalContributionTokenAmount} ${transaction?.contributionTokenSymbol}</p>
         <p class="token_conversion">$${transaction?.approxContributionValueInUSD}</p>
         </div>`;
  });
  return transactionsHTML;
};

const generateEra1Html = (htmlPayload, filename) => {
  const { transactions, totalAmount, totalPoints } = htmlPayload;
  const html = `<html><head>
        <style>
          @font-face {
            font-family: 'Cabinet Grotesk';
            src: url('./fonts/CabinetGrotesk-Regular.woff2') format('woff2');
            font-weight: 400;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cabinet Grotesk';
            src: url('./fonts/CabinetGrotesk-Medium.woff2') format('woff2');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cabinet Grotesk';
            src: url('./fonts/CabinetGrotesk-Bold.woff2') format('woff2');
            font-weight: 700;
            font-style: normal;
          } 
          @font-face {
            font-family: 'Cabinet Grotesk';
            src: url('./fonts/CabinetGrotesk-Black.woff2') format('woff2');
            font-weight: 900;
            font-style: normal;
          } 
          body {
            margin: 0;
            width: fit-content;
            height: fit-content;
          }
          #nft {
            width: fit-content;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 349px;
            padding: 16px 12px 0 12px;
            background-image: url("./assets/starsVector.svg");
          }
          #container {
            background: linear-gradient(180deg, #030404 0%, #131a1a 100%);
            width: fit-content;
            height: fit-content;
            background-repeat: repeat;
            border-width: 8px;
            border-style: solid;
            border-image: linear-gradient(#3c00dc, #ff5001) 45;
          }
          #logo {
            margin-bottom: 8px;
          }
          #logo_underline {
            background: linear-gradient(90deg, #ff5001 0%, #3c00dc 100%);
            height: 2.8px;
            width: 100%;
          }
          #transactions {
            color: white;
            margin-top: 8px;
            width: calc(100% - 12px);
            padding: 0px 6px;
          }
          .transaction {
            font-family: "Cabinet Grotesk", sans-serif;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            background-color: rgba(60, 0, 220, 0.33);
            padding: 16px;
            margin-bottom: 8px;
          }
          .transaction p {
            margin: 0;
            color: #feffff;
          }
          .token_name {
            opacity: 66%;
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 8px !important;
          }
          .token_amount {
            font-weight: 900;
            font-size: 28px;
            line-height: 35px;
          }
          .token_conversion {
            font-weight: 700;
            font-size: 16px;
            line-height: 20px;
          }
          #total_container {
            font-family: "Cabinet Grotesk", sans-serif;
            background-color: rgba(60, 0, 220, 0.33);
            padding: 16px;
            margin-bottom: 8px;
            gap: 8px;
            display: flex;
            flex-direction: column;
          }
          #total_container div p {
            margin: 0;
          }
          .total_heading {
            color: #feffff;
            opacity: 66%;
            line-height: 20px;
            font-size: 16px;
            font-weight: 700;
          }
          .total_value {
            font-weight: 900;
            font-size: 28px;
            line-height: 35px;
          }
          #conversion_text {
            font-family: "Cabinet Grotesk", sans-serif;
            color: #feffff;
            opacity: 60%;
            margin: 0;
            text-align: left;
            width: 100%;
            line-height: 20px;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 16px;
          }
        </style>
      </head><body><div id="container">
                  <div id="nft" style="background-color: black; width: fit-content; height: fit-content">
                  <img id="logo" src="./assets/wishwellLogo.svg" />
                  <div id="logo_underline"></div>
                  <div id="transactions">
                      ${generateTransactionsHTML(transactions)}
                      <div id="total_container">
                      <div>
                          <p class="total_heading">TOTAL VALUE</p>
                          <p class="total_value">$${totalAmount}</p>
                      </div>
                      <div>
                          <p class="total_heading">TOTAL POINTS</p>
                          <p class="total_value">${totalPoints}</p>
                      </div>
                      </div>
                  </div>
                  <p id="conversion_text">AVG: ${
                    Math.round(totalPoints / totalAmount) || 0
                  } POINTS / $1</p>
                  </div>
                </div>
                </body></html>`;
  if (!existsSync("./static")) {
    mkdirSync("./static");
  }
  const fileNameWithExtension = `./static/${filename}.html`;
  const stream = createWriteStream(fileNameWithExtension);
  stream.once("open", function (fd) {
    stream.end(html);
  });
};

export default generateEra1Html;
