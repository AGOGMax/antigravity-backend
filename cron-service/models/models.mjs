import mongoose from "mongoose";

const { Schema, model } = mongoose;

const contributionsSchema = new Schema({}, { strict: false });
const contributionsModel = model("contributions", contributionsSchema);

const pointsSchema = new Schema({}, { strict: false });
const pointsModel = model("points", pointsSchema);

const usersSchema = new Schema({}, { strict: false });
const usersModel = model("users", usersSchema);

const era3TimetampsSchema = new Schema({}, { strict: false });
const era3TimestampsModel = model("era3Timestamps", era3TimetampsSchema);

const lotteryResultsSchema = new Schema({}, { strict: false });
lotteryResultsSchema.index({ journeyId: 1, lotteryId: 1 }, { unique: true });
const lotteryResultsModel = model("lotteryResults", lotteryResultsSchema);

const lotteryEntriesSchema = new Schema({}, { strict: false });
lotteryEntriesSchema.index(
  { tokenId: 1, journeyId: 1, lotteryId: 1 },
  { unique: true }
);
const lotteryEntriesModel = model("lotteryEntries", lotteryEntriesSchema);

const transfersCronTimestampSchema = new Schema({}, { strict: false });
const transfersCronTimestampModel = model(
  "transfersCronTimestamp",
  transfersCronTimestampSchema
);

export {
  contributionsModel,
  pointsModel,
  usersModel,
  era3TimestampsModel,
  lotteryResultsModel,
  lotteryEntriesModel,
  transfersCronTimestampModel,
};
