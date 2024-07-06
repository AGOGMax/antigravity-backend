# Use the official Node.js image from the Docker Hub
FROM node:lts-bookworm

# Set the working directory
WORKDIR /usr/src/nft-service/

# Copy package.json and package-lock.json
COPY nft-service/package*.json .

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY nft-service/. .

RUN apt-get update
RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
RUN apt-get install -y libgbm-dev

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

