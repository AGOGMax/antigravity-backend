import {
  SecretsManagerClient,
  ListSecretsCommand,
  BatchGetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: "us-east-1",
});

const createBatches = (array, batchSize) => {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

const fetchSecretsList = async () => {
  try {
    const fetchSecretsListCommand = new ListSecretsCommand({ MaxResults: 50 });
    const secretsList = await client.send(fetchSecretsListCommand);
    const secretNames = secretsList?.SecretList?.map((secret) => secret?.Name);
    const batches = createBatches(secretNames, 20);

    const batchGetSecretPromises = batches.map(async (batch) => {
      const input = { SecretIdList: batch };
      const secretValueCommand = new BatchGetSecretValueCommand(input);
      return client.send(secretValueCommand);
    });

    const secretsValuesResponses = await Promise.all(batchGetSecretPromises);
    const allSecrets = secretsValuesResponses.flatMap(
      (response) => response?.SecretValues
    );

    let secretsMapping = {};

    allSecrets?.forEach((secretValue) => {
      secretsMapping = {
        ...secretsMapping,
        ...JSON.parse(secretValue?.SecretString),
      };
    });
    return secretsMapping;
  } catch (error) {
    throw error;
  }
};

export { fetchSecretsList };
