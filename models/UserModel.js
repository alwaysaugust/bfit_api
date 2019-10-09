//Require Mongoose
var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost/test_loyalty_token_database");
// Define schema
var Schema = mongoose.Schema;

var UserModelSchema = new Schema({
  accessToken: String,
  refreshToken: String,
  googleId: String,
  picture: String,
  displayName: String,
  given_name: String,
  family_name: String
});
UserModelSchema.methods.getSteps = function getSteps() {
  const body = {
    aggregateBy: [
      {
        dataTypeName: "com.google.step_count.delta",
        dataSourceId:
          "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps"
      }
    ],
    bucketByTime: { durationMillis: 86400000 },
    startTimeMillis: 1570129611000,
    endTimeMillis: 1570216071000
  };

  fetch("www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json;encoding=utf-8",
      Authorization: `Bearer ${this.accessToken}`
    }
  })
    .then(res => res.json())
    .then(json => console.log(json));
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
    result.accessToken = accessToken; //refresh accessToken
    userObj.save(cb);
  });
};

var UserModel = mongoose.model("UserModel", UserModelSchema);

// Compile model from schema
module.exports = UserModel;
