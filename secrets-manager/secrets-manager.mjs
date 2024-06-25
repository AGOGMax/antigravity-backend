import {
  SecretsManagerClient,
  ListSecretsCommand,
  BatchGetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: "us-east-1",
});

const fetchSecretsList = async () => {
  try {
    const fetchSecretsListCommand = new ListSecretsCommand({ MaxResults: 50 });
    const secretsList = await client.send(fetchSecretsListCommand);

    const input = {
      SecretIdList: secretsList?.SecretList?.map((secret) => secret?.Name),
    };

    const secretValueCommand = new BatchGetSecretValueCommand(input);
    const secretsValue = await client.send(secretValueCommand);

    let secretsMapping = {};

    secretsValue?.SecretValues?.forEach((secretValue) => {
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
