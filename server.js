// see https://github.com/passport/express-4.x-facebook-example/blob/master/server.js
const express = require("express");
const app = express();
const UserModel = require("./models/UserModel");
const port = 5000;
//see https://stackoverflow.com/questions/16781294/passport-js-passport-initialize-middleware-not-in-use
const passport = require("passport");
//see https://github.com/jaredhanson/passport-google-oauth2
var GoogleStrategy = require("passport-google-oauth20").Strategy;
app.use(require("cookie-parser")());
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: "keyboard cat",
    resave: true,
    saveUninitialized: true
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});
passport.serializeUser(function(user, done) {
  console.log("serizalizeUser:");
  console.log(user);
  done(null, user);
  //see https://stackoverflow.com/questions/19948816/passport-js-error-failed-to-serialize-user-into-session
  // if you use Model.id as your idAttribute maybe you'd want
  // done(null, user.id);
});

passport.deserializeUser(function(user, done) {
  console.log("deserizalizeUser:");
  console.log(user);
  done(null, user);
});
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "658254840670-23f7m3u1hpo8popp3ovsscu3r8qipap2.apps.googleusercontent.com",
      clientSecret: "BcbAks57gpAYRaLQaXU_6Qk9",
      callbackURL: "http://localhost:5000/auth/google/callback",
      accessType: "offline",
      passReqToCallback: true
    },
    function(request, accessToken, refreshToken, profile, cb) {
      console.log({ accessToken, refreshToken });
      UserModel.findOrCreate(profile, accessToken, refreshToken, cb);
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    accessType: "offline",
    prompt: "consent",
    session: false,
    scope: ["profile", "https://www.googleapis.com/auth/fitness.activity.read"]
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:3000/login"
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log(req.params);
    console.log(req.query);
    console.log("successful auth");
    res.redirect("http://localhost:3000/");
  }
);

app.get("/", (req, res) => res.send({ data: "api ok" }));

app.get(
  "/testAuth",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:3000/login",
    scope: ["profile", "https://www.googleapis.com/auth/fitness.activity.read"]
  }),
  function(req, res) {
    res.json(req.user);
  }
);

app.get("/steps", async (req, res) => {
  //load steps
  console.log("load steps");
  console.log(req.params);
  console.log(req.query);
  console.log(req.user);
  console.log(req.session);
  res.send({ data: "todo get steps" });
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
