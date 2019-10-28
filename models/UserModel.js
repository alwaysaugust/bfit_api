//Require Mongoose
var mongoose = require("mongoose");
var moment = require("moment");
var fetch = require("node-fetch");
mongoose.connect("mongodb://localhost/test_loyalty_token_database");
// Define schema
var Schema = mongoose.Schema;

var DayStepsPoints = new Schema({
  day: Number, //unix timestamp as of midnight of that day
  steps: Number,
  points: Number
});

var UserRewardDedemption = new Schema({
  rewardId: Schema.Types.ObjectId,
  timeStamp: Number //unix timestamp
});

var VendorReward = new Schema({
  cost: Number,
  expirationDate: Number, //unix timestamp
  title: String,
  description: String,
  image: Buffer
});

var UserModelSchema = new Schema({
  accessToken: String,
  refreshToken: String,
  googleId: String,
  picture: String,
  displayName: String,
  given_name: String,
  family_name: String,
  roleType: Number, //0 user, 1 vendor
  steps: [DayStepsPoints],
  redemptions: [UserRewardDedemption],
  rewards: [VendorReward] //empty if not vendor
});
UserModelSchema.methods.getSteps = function getSteps(cb) {
  const start = moment()
    .startOf("day")
    .unix();
  const startTime = start * 1000;
  const endTime = moment().unix() * 1000;

  fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataSources/derived:com.google.step_count.delta:com.google.android.gms:estimated_steps/datasets/" +
      startTime +
      "000000-" +
      endTime +
      "000000",
    {
      method: "get",
      headers: {
        "Content-Type": "application/json;encoding=utf-8",
        Authorization: `Bearer ${this.accessToken}`
      }
    }
  )
    .then(res => res.json())
    .then(jsonData => {
      let totalSteps = 0;
      if (jsonData.error) {
        cb(jsonData.error, null);
        return;
      }
      jsonData.point.forEach(point => {
        totalSteps += point.value[0].intVal;
      });
      if (
        this.steps.length > 0 &&
        this.steps[this.steps.length - 1].day === start
      ) {
        this.steps[this.steps.length - 1].steps = totalSteps;
      } else {
        this.steps.push({ day: start, steps: totalSteps, points: 0 }); //todo find old points
      }
      console.log("saving new steps");
      this.save(cb);
      //cb(totalSteps);
    })
    .catch(error => cb(error, null));
};
UserModelSchema.statics.findOrCreate = function findOrCreate(
  profile,
  accessToken,
  refreshToken,
  cb
) {
  console.log(profile);
  var userObj = new this({
    accessToken,
    refreshToken,
    displayName: profile.displayName,
    googleId: profile.id,
    picture: profile.photos[0].value,
    given_name: profile.name.givenName,
    family_name: profile.name.familyName
  });
  console.log("findOrCreate");
  this.findOne({ googleId: profile.id }, function(err, result) {
    console.log("found:" + result);
    if (result) {
      // old
      result.accessToken = accessToken; //refresh accessToken
      result.save(cb);
    } else {
      // new
      userObj.save(cb);
    }
  });
};

UserModelSchema.statics.findUser = function findOrCreate(profile, cb) {
  console.log("findOne: " + JSON.stringify(profile));
  let searchId;
  if (profile.id) {
    searchId = profile.id;
  } else {
    searchId = profile["googleId"];
  }
  this.findOne({ googleId: searchId }, function(err, result) {
    console.log("found:" + result);
    result.getSteps(cb);
    //cb(result);
  });
};

var UserModel = mongoose.model("UserModel", UserModelSchema);

// Compile model from schema
module.exports = UserModel;
