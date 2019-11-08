//Require Mongoose
var mongoose = require("mongoose");
var fetch = require("node-fetch");

var moment = require("moment");
mongoose.connect("mongodb://localhost/test_loyalty_token_database");
// Define schema
var Schema = mongoose.Schema;

var RewardModelSchema = new Schema({
  cost: Number,
  expirationDate: Number, //unix timestamp
  title: String,
  description: String,
  image: String, // path to servers /uploads folder
  creator: mongoose.Schema.Types.ObjectId,
  creatorLogo: String
});
RewardModelSchema.methods.isExpired = function isExpired() {
  return this.expirationDate < moment().unix();
};

var RewardModel = mongoose.model("RewardModel", RewardModelSchema);

// Compile model from schema
module.exports = RewardModel;
