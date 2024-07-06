# Use the official Node.js image from the Docker Hub
FROM node:lts-alpine

# Set the working directory
WORKDIR /usr/src/app/master-service

# Copy package.json and package-lock.json
RUN mkdir master-service
COPY master-service/package*.json ../master-service/.

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY master-service/. ../master-service/.

RUN apk --no-cache update && \
    apk --no-cache add aws-cli

ENV AWS_ACCESS_KEY_ID=AKIAVRUVPUOTLYV6WYWM
ENV AWS_SECRET_ACCESS_KEY=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
ENV AWS_DEFAULT_REGION=us-east-1

RUN aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID && \
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY && \
    aws configure set default.region $AWS_DEFAULT_REGION && \
    aws configure set default.output json

RUN mkdir secrets-manager
COPY secrets-manager/. ../secrets-manager/.
RUN cd secrets-manager && npm install
RUN npm i @aws-sdk/client-secrets-manager

RUN cd ../
RUN mkdir helpers
COPY helpers/. ../helpers/.
RUN cd helpers && npm install

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]

