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

export { contributionsModel, pointsModel, usersModel, era3TimestampsModel };
