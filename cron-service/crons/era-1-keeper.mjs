import AWS from "aws-sdk";

export const invokeEra1Keeper = async () => {
  const lambda = new AWS.Lambda({
    region: "us-east-1",
  });

  const params = {
    FunctionName: "era-1-testing-keeper",
    InvocationType: "Event",
    Payload: JSON.stringify({}),
  };

  lambda.invoke(params, (err, data) => {
    if (err) {
      console.error("Error invoking Era 1 Lambda function", err);
    } else {
      console.log("Era 1 Lambda function invoked successfully", data);
    }
  });
};
