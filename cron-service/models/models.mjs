import mongoose from "mongoose";

const { Schema, model } = mongoose;

const contributionsSchema = new Schema({}, { strict: false });
const contributionsModel = model("contributions", contributionsSchema);

const pointsSchema = new Schema({}, { strict: false });
const pointsModel = model("points", pointsSchema);

const usersSchema = new Schema({}, { strict: false });
const usersModel = model("users", usersSchema);

export { contributionsModel, pointsModel, usersModel };
