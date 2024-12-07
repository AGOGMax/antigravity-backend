# Use the official Node.js image from the Docker Hub
FROM node:lts-alpine

# Set the working directory
WORKDIR /usr/src/master-service/

# Copy package.json and package-lock.json
COPY master-service/package*.json .

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY master-service/. .

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

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]

