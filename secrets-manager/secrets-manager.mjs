import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: "us-east-1",
});

const fetchSecretsList = async () => {
  try {
    const environment = process.env.ENV || "TEST";
    const secretName = `${environment}_SECRETS`;

    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response?.SecretString) {
      const secretsMapping = JSON.parse(response.SecretString);
      return secretsMapping;
    } else {
      throw new Error("SecretString not found in the response");
    }
  } catch (error) {
    console.error("Error fetching SECRETS:", error);
    throw error;
  }
};

export { fetchSecretsList };
