import mongoose from "mongoose";

const { Schema, model } = mongoose;

const newsletterEnrollmentSchema = new Schema({}, { strict: false });
const newsletterEnrollmentModel = model(
  "newsletterEnrollment",
  newsletterEnrollmentSchema
);

const enrollUserToNewsletter = async (name, email) => {
  const existingUser = await newsletterEnrollmentModel.findOne({
    email: email,
  });

  if (!existingUser) {
    await newsletterEnrollmentModel.create({
      name: name,
      email: email,
    });
  }
  return { success: true };
};

const fetchNewsletterEnrollments = async () => {
  const enrollments = await newsletterEnrollmentModel.find();
  return enrollments;
};

export { enrollUserToNewsletter, fetchNewsletterEnrollments };
