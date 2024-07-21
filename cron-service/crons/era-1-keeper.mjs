import AWS from "aws-sdk";
import { captureErrorWithContext } from "../start-crons.mjs";

export const invokeEra1Keeper = async () => {
  const lambda = new AWS.Lambda({
    region: "us-east-1",
  });

  const params = {
    FunctionName: "era-1-testing-keeper",
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({}),
  };

  lambda.invoke(params, (err, data) => {
    if (err) {
      console.error("Cron Keeper: Error invoking Era 1 Lambda function", err);
      captureErrorWithContext(
        err,
        "Cron Keeper: Error invoking Era 1 Lambda function"
      );
    } else {
      const responsePayload = JSON.parse(data.Payload);
      console.log(
        "Cron Keeper: Era 1 Lambda function invoked successfully",
        responsePayload
      );
      if (responsePayload?.statusCode !== 200) {
        captureErrorWithContext(
          new Error(
            "Cron Keeper: Era 1 Lambda function not returning 200.",
            responsePayload
          )
        );
      }
    }
  });
};
