FROM node:lts-alpine

WORKDIR /usr/src/pmw-listener/

RUN apk --no-cache update && \
    apk --no-cache add aws-cli

COPY pmw-listener/package*.json ./
RUN npm install

COPY pmw-listener/. .

COPY secrets-manager/. ../secrets-manager/.
RUN cd ../secrets-manager && npm install

COPY helpers/. ../helpers/.
RUN cd ../helpers && npm install

ENV AWS_ACCESS_KEY_ID=
ENV AWS_SECRET_ACCESS_KEY=
ENV AWS_DEFAULT_REGION=
ENV ENV=

RUN aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID && \
    aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY && \
    aws configure set default.region $AWS_DEFAULT_REGION && \
    aws configure set default.output json

# Optional: expose port (if you later add a healthcheck server)
# EXPOSE 3001

CMD ["node", "--experimental-modules", "eventListener.mjs"]
