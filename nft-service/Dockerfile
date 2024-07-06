# Use the official Node.js image from the Docker Hub
FROM node:slim

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/nft-service/

# Copy package.json and package-lock.json
COPY nft-service/package*.json .

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY nft-service/. .

sudo apt-get install -y libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget


RUN apk --no-cache update && \
    apk --no-cache add aws-cli

ENV AWS_ACCESS_KEY_ID=AKIAVRUVPUOTLYV6WYWM
ENV AWS_SECRET_ACCESS_KEY=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
ENV AWS_DEFAULT_REGION=us-east-1

RUN aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID && \
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY && \
    aws configure set default.region $AWS_DEFAULT_REGION && \
    aws configure set default.output json

COPY secrets-manager/. ../secrets-manager/.
RUN cd ../secrets-manager && npm install

COPY helpers/. ../helpers/.
RUN cd ../helpers && npm install

# Expose the application port
EXPOSE 3001

# Command to run the application
CMD ["npm", "start"]

