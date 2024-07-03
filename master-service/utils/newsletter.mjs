import mongoose from "mongoose";

const { Schema, model } = mongoose;

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
