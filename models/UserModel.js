//Require Mongoose
var mongoose = require("mongoose");
var moment = require("moment");
var fetch = require("node-fetch");
mongoose.connect("mongodb://localhost/test_loyalty_token_database");

const RewardModel = require("./RewardModel");
// Define schema
var Schema = mongoose.Schema;

var VendorData = new Schema({
  name: String,
  image: String, // path to servers /uploads folder
  addressOne: String,
  addressTwo: String,
  addressCity: String,
  addressProvince: String,
  addressCountry: String,
  addressPostalCode: String,
  category: String,
  about: String,
  status: Number, // 0 pending, 1, approved, 2 rejected
  rejectedReason: String,
  isAdmin: Boolean
});

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
  email: String,
  roleType: Number, //0 user, 1 vendor
  steps: [DayStepsPoints],
  redemptions: [UserRewardDedemption],
  rewards: [VendorReward], //empty if not vendor
  vendorData: VendorData //empty if not vendor
});
UserModelSchema.methods.canCreate = function canCreate(cb) {
  if (this.vendorData.status !== 1) {
    cb("Vendor not approved to create rewards");
  } else {
    let filter = { creator: this._id };

    RewardModel.find(filter, (error, rewards) => {
      if (error) {
        cb("Error fingind user", false);
      } else {
        let totalValid = rewards.filter(reward => !reward.isExpired()).length;
        cb("Too many Rewards created", totalValid < 3);
      }
    });
  }
};
UserModelSchema.methods.inflateData = function inflateData(cb) {
  //iflate redemption data
  console.log("...inflating user data");
  if (this.roleType === 1) {
    RewardModel.find({ creator: this._id }, (error, rewardsCreated) => {
      if (error) {
        cb(error);
      } else {
        UserModel.find(
          { "redemptions.rewardId": { $in: rewardsCreated } },
          (error, usersRedeemed) => {
            if (error) {
              cb(error);
            } else {
              const userObject = this.toObject();
              const vendorRedemptions = [];
              usersRedeemed.forEach(user => {
                user.redemptions.forEach(red => {
                  let rewardObject = rewardsCreated.find(el => {
                    console.log(el._id);
                    console.log(red.rewardId);
                    console.log(el._id.equals(red.rewardId));
                    return el._id.equals(red.rewardId);
                  });
                  if (!rewardObject) {
                    console.log("rewardObject:" + rewardObject);
                  } else {
                    vendorRedemptions.push({
                      timeStamp: red.timeStamp,
                      cost: rewardObject.cost,
                      image: rewardObject.image,
                      creatorLogo: rewardObject.creatorLogo,
                      rewardId: red.rewardId,
                      userName: user.displayName
                    });
                  }
                });
              });
              userObject.vendorRedemptions = vendorRedemptions;
              cb(null, userObject);
            }
          }
        );
      }
    });
  } else {
    //user
    if (this.redemptions.length > 0) {
      let inflatedRedemptions = [];
      const userObject = this.toObject();
      const promises = [];
      let redIds = this.redemptions.map(red => {
        promises.push(
          new Promise((resolve, reject) => {
            RewardModel.findById(red.rewardId, (err, model) => {
              if (err) {
                reject(err);
              } else {
                resolve(model);
              }
            });
          })
        );
        return new mongoose.Types.ObjectId(red.rewardId);
      });
      Promise.all(promises)
        .then(models => {
          models.forEach((rewardObject, index) => {
            inflatedRedemptions.push({
              timeStamp: this.redemptions[index].timeStamp,
              cost: rewardObject.cost,
              image: rewardObject.image,
              creatorLogo: rewardObject.creatorLogo,
              rewardId: this.redemptions[index].rewardId
            }); //todo add more vendor data
          });
          userObject.redemptions = inflatedRedemptions;
          cb(null, userObject);
        })
        .catch(cb);
    } else {
      cb(null, this.toObject());
    }
  }
};
UserModelSchema.methods.redeem = function redeem(rewardId, cb) {
  RewardModel.findById(rewardId, (error, reward) => {
    if (error) {
      cb(error);
    } else {
      console.log(rewardId);
      console.log(reward);
      let pointsRequired = reward.cost;
      let total = 0;
      this.steps.forEach(stepData => {
        total += stepData.points;
      });

      console.log("total:" + total);
      console.log("points:" + pointsRequired);
      if (total > pointsRequired) {
        console.log("adding redemption");
        this.redemptions.push({
          rewardId: rewardId,
          timeStamp: moment().unix()
        });
        this.save(cb);
      } else {
        cb("Not enough points to redeem");
      }
    }
  });
};
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
  cb,
  roleType
) {
  //console.log(profile);
  var userObj = new this({
    accessToken,
    refreshToken,
    displayName: profile.displayName,
    googleId: profile.id,
    picture: profile.photos[0].value,
    given_name: profile.name.givenName,
    family_name: profile.name.familyName,
    email: profile.emails[0].value,
    roleType: roleType
  });
  console.log("findOrCreate");
  this.findOne({ googleId: profile.id }, function(err, result) {
    //console.log("found:" + result);
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
  let searchId;
  if (profile.id) {
    searchId = profile.id;
  } else {
    searchId = profile["googleId"];
  }
  console.log("findOne: " + searchId);
  this.findOne({ googleId: searchId }, function(err, result) {
    if (result) {
      console.log("found");
      result.getSteps(cb);
    } else {
      console.log("not found");
      cb("No user");
    }
  });
};

var UserModel = mongoose.model("UserModel", UserModelSchema);

// Compile model from schema
module.exports = UserModel;
