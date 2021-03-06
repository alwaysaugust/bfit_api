const PORT = process.env.PORT || 5000;
const PUBLIC_ADDRESS = process.env.PUBLIC_ADDRESS || "http://localhost:5000";
const FRONTEND = process.env.FRONTEND || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "oleksiy@alwaysaugust.co";
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
const { send } = require("./mailHelper");
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
      passReqToCallback: true,
      callbackURL: `${PUBLIC_ADDRESS}/auth/google/callback`
    },
    (req, accessToken, refreshToken, profile, cb) => {
      const userType = req.session.userType;
      console.log("user type: " + userType);
      console.log({ accessToken, refreshToken });
      console.log(profile);
      UserModel.findOrCreate(profile, accessToken, refreshToken, cb, userType);
    }
  )
);

// Used to stuff a piece of information into a cookie
passport.serializeUser((user, done) => {
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
app.get("/auth/google", (req, res, next) => {
  req.session.userType = req.query.userType;
  next();
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    passReqToCallback: true,
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/fitness.activity.read"
    ] // Used to specify the required data
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
app.get("/changeRole", isUserAuthenticated, (req, res) => {
  UserModel.findUser(req.user, (error, user) => {
    if (error) {
      res.send({ error: error });
    } else {
      if (user.roleType === 0) {
        user.roleType = 1;
      } else {
        user.roleType = 0;
      }

      user.save((err, savedUser) => {
        if (err) {
          res.send({ error: err });
        } else {
          savedUser.inflateData((error, inflatedUser) => {
            if (error) {
              res.send({ error: error });
            } else {
              res.redirect(`${FRONTEND}/`);
            }
          });
        }
      });
    }
  });
});
app.post("/approveRejectVendor", isUserAuthenticated, (req, res) => {
  if (!isAdmin(req.user)) {
    res.send({ error: "Please login as admin account" });
    return;
  }
  UserModel.findUser(req.user, (error, user) => {
    if (error) {
      res.send({ error: error });
    } else {
      UserModel.findById(req.body.data.id, (error, user) => {
        if (error) {
          res.send({ error: error });
        } else {
          if (req.body.data.flag) {
            //send(user.email, "d-8636ec0293d4466eb004547063c4e9c6");
            user.vendorData.status = 1;
          } else {
            //send(user.email, "d-b6f3182a304e4e4191659dfab4ab6b00");
            user.vendorData.status = 2;
          }
          user.save((err, savedUser) => {
            if (err) {
              res.send({ error: err });
            } else {
              savedUser.inflateData((error, inflatedUser) => {
                if (error) {
                  res.send({ error: error });
                } else {
                  res.send({ data: inflatedUser });
                }
              });
            }
          });
        }
      });
    }
  });
});
app.post("/setRole", isUserAuthenticated, (req, res) => {
  const { roleType, vendorData } = req.body;
  if (roleType === 1 && !vendorData) {
    res.send({ error: "Missing vendor data" });
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: error });
      } else {
        user.roleType = roleType;
        user.vendorData = vendorData;
        user.vendorData.status = 0; //pending approval
        user.save((err, savedUser) => {
          if (err) {
            res.send({ error: err });
          } else {
            savedUser.inflateData((error, inflatedUser) => {
              if (error) {
                res.send({ error: error });
              } else {
                res.send({ data: inflatedUser });
              }
            });
          }
        });
      }
    });
  }
});
app.post("/setVendorImage", upload.any(), (req, res) => {
  UserModel.findUser(req.user, (error, vendor) => {
    if (error) {
      res.send({ error: error });
    } else {
      vendor.vendorData.image = req.files[0].filename;
      vendor.save((error, savedUser) => {
        if (error) {
          res.send({ error: error });
        } else {
          savedUser.inflateData((error, inflatedUser) => {
            if (error) {
              res.send({ error: error });
            } else {
              res.send({ data: inflatedUser });
            }
          });
        }
      });
    }
  });
});
app.get("/user", isUserAuthenticated, async (req, res) => {
  if (!req.user) {
    res.redirect(`${FRONTEND}/login`);
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: error });
      } else {
        user.inflateData((error, inflatedUser) => {
          if (error) {
            res.send({ error: error });
          } else {
            res.send({ data: inflatedUser });
          }
        });
      }
    });
  }
});
app.get("/convertToPoints", isUserAuthenticated, async (req, res) => {
  if (!req.user) {
    res.redirect(`${FRONTEND}/login`);
  } else {
    UserModel.findUser(req.user, (error, user) => {
      if (error) {
        res.send({ error: error });
      } else {
        const REDEMPTION_RATIO = 10;
        let stepsData = user.steps[user.steps.length - 1];
        stepsData.points = Math.floor(stepsData.steps / REDEMPTION_RATIO);
        user.save((err, savedUser) => {
          res.send({ data: savedUser });
        });
      }
    });
  }
});
app.get("/pendingVendors", isUserAuthenticated, (req, res) => {
  if (!isAdmin(req.user)) {
    res.send({ error: "Please login as admin account" });
    return;
  }
  UserModel.find(
    { roleType: 1, "vendorData.status": { $nin: [1, 2] } },
    (error, results) => {
      if (error) {
        res.send({ error: error });
      } else {
        res.send({ data: results });
      }
    }
  );
});
app.get("/getRewards", isUserAuthenticated, (req, res) => {
  let filter = {};
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
  const { reward } = req.body;

  UserModel.findUser(req.user, (error, user) => {
    if (error) {
      res.send({ error: error });
    } else {
      if (!reward) {
        res.send({ error: { message: "missing reward form data" } });
      } else if (user.roleType !== 1) {
        res.send({ error: { message: "user must be admin" } });
      } else {
        const { id } = req.params;
        if (!id) {
          user.canCreate((err, flag) => {
            if (!flag) {
              res.send({ error: err });
            } else {
              let rewardModel = new RewardModel({
                cost: reward.cost,
                expirationDate: reward.expirationDate,
                title: reward.title,
                description: reward.description,
                image: null, // set seperately
                creator: user,
                creatorLogo: user.vendorData.image
              });
              rewardModel.save((error, model) => {
                if (error) {
                  res.send({ error: error });
                } else {
                  res.send({ data: model });
                }
              });
            }
          });
        } else {
          RewardModel.findById(id, (error, oldReward) => {
            if (error) {
              res.send({ error: error });
            } else {
              oldReward.cost = reward.cost;
              oldReward.expirationDate = reward.expirationDate;
              oldReward.title = reward.title;
              oldReward.description = reward.description;
              oldReward.creator = user;
              oldReward.creatorLogo = user.vendorData.image;
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
    }
  });
});
app.post("/setRewardImage/:id", upload.any(), (req, res) => {
  const { id } = req.params;
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
});

app.get("/getReward/:id", (req, res) => {
  const { id } = req.params;
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
  const { id } = req.params;
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
            user.inflateData((error, inflatedUser) => {
              if (error) {
                res.send({ error: error });
              } else {
                res.send({ data: inflatedUser });
              }
            });
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

app.get("/delete", (req, res) => {
  let idRef = req.user._id;
  req.logout();
  UserModel.findById(idRef).deleteOne((error, model) => {
    if (error) {
      res.send({ error });
    } else {
      res.redirect(`${FRONTEND}/login`);
    }
  });
});
app.listen(PORT, () => {
  console.log("BFIT Server Started on port:" + PORT);
});

const isAdmin = user => {
  const admins = [ADMIN_EMAIL];
  return admins.find(admin => admin === user.email) != undefined;
};
