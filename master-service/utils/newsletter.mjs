import mongoose from "mongoose";
import { fetchSecretsList } from "../../secrets-manager/secrets-manager.mjs";

const { Schema, model } = mongoose;
const secrets = await fetchSecretsList();
await mongoose.connect(secrets?.MONGODB_CONNECTION_STRING);

const newsletterEnrollmentSchema = new Schema({}, { strict: false });
const newsletterEnrollmentModel = model(
  "newsletterEnrollment",
  newsletterEnrollmentSchema
);

export const enrollUserToNewsletter = async (name, email) => {
  await newsletterEnrollmentModel.create({
    name: name,
    email: email,
  });
  return { success: true };
};
