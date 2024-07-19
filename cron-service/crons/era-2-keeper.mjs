import AWS from "aws-sdk";

export const invokeEra2Keeper = async () => {
  const lambda = new AWS.Lambda({
    region: "us-east-1",
  });

  const params = {
    FunctionName: "era-2-testing-keeper",
    InvocationType: "Event",
    Payload: JSON.stringify({}),
  };

  lambda.invoke(params, (err, data) => {
    if (err) {
      console.error("Error invoking Lambda function", err);
    } else {
      console.log("Lambda function invoked successfully", data);
    }
  });
};
