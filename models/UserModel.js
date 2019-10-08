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
  console.log("... will get steps for " + this.accessToken);
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
