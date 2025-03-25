# Use the official Node.js image from the Docker Hub
FROM node:lts-alpine

# Set the working directory
WORKDIR /usr/src/cron-service/

# Copy package.json and package-lock.json
COPY cron-service/package*.json .

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY cron-service/. .

RUN apk --no-cache update && \
    apk --no-cache add aws-cli

ENV AWS_ACCESS_KEY_ID=
ENV AWS_SECRET_ACCESS_KEY=
ENV AWS_DEFAULT_REGION=
ENV ENV=

RUN aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID && \
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY && \
    aws configure set default.region $AWS_DEFAULT_REGION && \
    aws configure set default.output json

COPY secrets-manager/. ../secrets-manager/.
RUN cd ../secrets-manager && npm install

COPY helpers/. ../helpers/.
RUN cd ../helpers && npm install

# Command to run the application
CMD ["node", "start-crons.mjs"]

