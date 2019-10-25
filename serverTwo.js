const PORT = process.env.PORT || 5000;
const ADDRESS = process.env.ADDRESS || "http://localhost";
const FRONTEND = process.env.FRONTEND || "http://localhost:3000";
// Required dependencies
const express = require("express");
const app = express();
var bodyParser = require("body-parser");
const passport = require("passport");
const cors = require("cors");
const GoogleStrategy = require("passport-google-oauth20");
const cookieSession = require("cookie-session");

const UserModel = require("./models/UserModel");
//parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//cors
app.use("*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", FRONTEND);
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

//enable pre-flight
app.options("*", cors({ credentials: true, origin: FRONTEND }));

// cookieSession config
app.use(
  cookieSession({
    maxAge: 24 * 60 * 60 * 1000, // One day in milliseconds
    keys: ["randomstringhere"]
  })
);

app.use(passport.initialize()); // Used to initialize passport
app.use(passport.session()); // Used to persist login sessions

// Strategy config
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "658254840670-23f7m3u1hpo8popp3ovsscu3r8qipap2.apps.googleusercontent.com",
      clientSecret: "BcbAks57gpAYRaLQaXU_6Qk9",
      callbackURL: `${ADDRESS}:${PORT}/auth/google/callback`
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
  console.log(user);
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
    scope: ["profile"] // Used to specify the required data
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
  UserModel.findUser(req.user, user => {
    user.roleType = req.body.roleType;
    user.save((err, savedUser) => {
      res.send({ data: savedUser });
    });
  });
});

app.get("/user", isUserAuthenticated, async (req, res) => {
  console.log("get user");
  console.log(req.params);
  console.log(req.query);
  console.log(req.user);
  console.log(req.session);
  if (!req.user) {
    res.redirect(`${FRONTEND}/login`);
  } else {
    UserModel.findUser(req.user, user => {
      res.send({ data: user });
    });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect(`${FRONTEND}/login`);
});

app.listen(PORT, () => {
  console.log("BFIT Server Started!");
});
