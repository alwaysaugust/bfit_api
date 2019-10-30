const PORT = process.env.PORT || 5000;
const PUBLIC_ADDRESS = process.env.PUBLIC_ADDRESS || "http://localhost:5000";
const FRONTEND = process.env.FRONTEND || "http://localhost:3000";
// Required dependencies
const express = require("express");
var moment = require("moment");
const app = express();
var bodyParser = require("body-parser");
const passport = require("passport");
var fs = require("fs");
var path = require("path");
var multer = require("multer");
const cors = require("cors");
var mongoose = require("mongoose");
const GoogleStrategy = require("passport-google-oauth20");
const cookieSession = require("cookie-session");

const UserModel = require("./models/UserModel");
const RewardModel = require("./models/RewardModel");

//parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//images
app.use(express.static(path.join(__dirname, "uploads")));
var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function(req, file, cb) {
    const timeStamp = moment().unix();
    cb(null, timeStamp + "_" + file.originalname);
  }
});

var upload = multer({
  storage: storage
});

// cookieSession config
app.use(
  cookieSession({
    maxAge: 24 * 60 * 60 * 1000, // One day in milliseconds
    keys: ["randomstringhere"]
  })
);

app.use(passport.initialize()); // Used to initialize passport
app.use(passport.session()); // Used to persist login sessions

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// Strategy config
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "658254840670-23f7m3u1hpo8popp3ovsscu3r8qipap2.apps.googleusercontent.com",
      clientSecret: "BcbAks57gpAYRaLQaXU_6Qk9",
      callbackURL: `${PUBLIC_ADDRESS}/auth/google/callback`
    },
    (accessToken, refreshToken, profile, cb) => {
      console.log({ accessToken, refreshToken });
      UserModel.findOrCreate(profile, accessToken, refreshToken, cb);
    }
  )
);

// Used to stuff a piece of information into a cookie
passport.serializeUser((user, done) => {
  console.log("serizalizeUser:");
  done(null, user);
});

// Used to decode the received cookie and persist session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Middleware to check if the user is authenticated
function isUserAuthenticated(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.send({ error: "Please Login" });
  }
}

// Routes
app.get("/", (req, res) => res.send({ data: "api ok" }));

// passport.authenticate middleware is used here to authenticate the request
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "https://www.googleapis.com/auth/fitness.activity.read"] // Used to specify the required data
  })
);

// The middleware receives the data from Google and runs the function on Strategy config
app.get(
  "/auth/google/callback",
  passport.authenticate("google"),
  (req, res) => {
    res.redirect(`${FRONTEND}/`);
  }
);

app.post("/setRole", isUserAuthenticated, (req, res) => {
  console.log("/setRole");
  console.log(req.body.roleType);
  UserModel.findUser(req.user, (error, user) => {
    if (error) {
      res.send({ error: error });
    } else {
      user.roleType = req.body.roleType;
      user.save((err, savedUser) => {
        res.send({ data: savedUser });
      });
    }
  });
});
app.get("/user", isUserAuthenticated, async (req, res) => {
  console.log("get user");
  if (!req.user) {
    res.redirect(`${FRONTEND}/login`);
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: error });
      } else {
        //iflate redemption data
        if (user.redemptions.length > 0) {
          let inflatedRedemptions = [];
          user.redemptions.forEach((red, index) => {
            const userObject = user.toObject();
            RewardModel.findById(red.rewardId, (err, rewardObject) => {
              console.log("..");

              inflatedRedemptions[index] = {
                timeStamp: red.timeStamp,
                cost: rewardObject.cost,
                image: rewardObject.image,
                creatorLogo: rewardObject.creatorLogo,
                rewardId: red.rewardId
              }; //todo add more vendor data
              if (index === user.redemptions.length - 1) {
                console.log(inflatedRedemptions);
                userObject.redemptions = inflatedRedemptions;
                console.log("sending inflated data");
                console.log(userObject);

                res.send({ data: userObject });
              }
            });
          });
        } else {
          res.send({ data: user });
        }
      }
    });
  }
});
app.get("/convertToPoints", isUserAuthenticated, async (req, res) => {
  console.log("get steps");
  if (!req.user) {
    res.redirect(`${FRONTEND}/login`);
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: error });
      } else {
        let stepsData = user.steps[user.steps.length - 1];
        stepsData.points = stepsData.steps;
        user.save((err, savedUser) => {
          res.send({ data: savedUser });
        });
      }
    });
  }
});
app.get("/getRewards", isUserAuthenticated, (req, res) => {
  console.log("/getRewards");
  let filter = {};
  console.log(req.query);
  if (req.query.vendorId) {
    filter = { creator: new mongoose.Types.ObjectId(req.query.vendorId) };
  }
  RewardModel.find(filter, (error, rewards) => {
    if (error) {
      res.send({ error: error });
    } else {
      res.send({ data: rewards });
    }
  });
});
app.post("/createReward/:id*?", isUserAuthenticated, (req, res) => {
  console.log("/createReward");
  const { reward } = req.body;
  if (!reward) {
    res.send({ error: { message: "missing reward form data" } });
  } else if (req.user.roleType !== 1) {
    res.send({ error: { message: "user must be admin" } });
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: error });
      } else {
        const { id } = req.params;
        if (!id) {
          let rewardModel = new RewardModel({
            cost: reward.cost,
            expirationDate: reward.expirationDate,
            title: reward.title,
            description: reward.description,
            image: null, // set seperately
            creator: user,
            creatorLogo: user.picture
          });
          rewardModel.save((error, model) => {
            if (error) {
              res.send({ error: error });
            } else {
              res.send({ data: model });
            }
          });
        } else {
          console.log("update id: " + id);
          RewardModel.findById(id, (error, oldReward) => {
            console.log(oldReward);
            if (error) {
              res.send({ error: error });
            } else {
              oldReward.cost = reward.cost;
              oldReward.expirationDate = reward.expirationDate;
              oldReward.title = reward.title;
              oldReward.description = reward.description;
              oldReward.creator = user;
              oldReward.creatorLogo = user.picture;
              oldReward.save((error, model) => {
                if (error) {
                  res.send({ error: error });
                } else {
                  res.send({ data: model });
                }
              });
            }
          });
        }
      }
    });
  }
});
app.post("/setRewardImage/:id", upload.any(), (req, res) => {
  console.log("/setRewardImage");

  const { id } = req.params;
  console.log(req.params.id);
  if (!id) {
    res.send({ error: { message: "missing reward id data" } });
  } else if (req.user.roleType !== 1) {
    res.send({ error: { message: "user must be admin" } });
  } else {
    RewardModel.findById(id, (error, reward) => {
      if (error) {
        res.send({ error: error });
      } else {
        reward.image = req.files[0].filename;
        reward.save((error, reward) => {
          if (error) {
            res.send({ error: error });
          } else {
            res.send({ data: reward });
          }
        });
      }
    });
  }
});

app.get("/getReward/:id", (req, res) => {
  console.log("/getReward");

  const { id } = req.params;
  console.log(req.params.id);
  if (!id) {
    res.send({ error: { message: "missing reward id data" } });
  } else {
    RewardModel.findById(id, (error, reward) => {
      if (error) {
        res.send({ error: error });
      } else {
        res.send({ data: reward });
      }
    });
  }
});
app.post("/redeemReward/:id", isUserAuthenticated, (req, res) => {
  console.log("/redeemReward");
  const { id } = req.params;
  console.log(req.params.id);
  if (!id) {
    res.send({ error: { message: "missing reward id data" } });
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: eror });
      } else {
        user.redeem(id, (error, user) => {
          if (error) {
            res.send({ error: error });
          } else {
            res.send({ data: user });
          }
        });
      }
    });
  }
});
// Logout route
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect(`${FRONTEND}/login`);
});

app.listen(PORT, () => {
  console.log("BFIT Server Started on port:" + PORT);
});

// const test = () => {
//   UserModel.findUser({ id: "115033584257748466608" }, (error, user) => {
//     console.log(user);
//     console.log(error);
//     user.redeem("5db98d1c2d279737ce316720", (error, user) => {
//       console.log("tried to redeem");
//       console.log(error);
//       console.log(user);
//     });
//   });
// };
// test();
