const express = require("express");
const app = express();
const port = 5000;
const passport = require("passport");
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
  done(null, user);
  // if you use Model.id as your idAttribute maybe you'd want
  // done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  done(null, id);
});
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "658254840670-23f7m3u1hpo8popp3ovsscu3r8qipap2.apps.googleusercontent.com",
      clientSecret: "BcbAks57gpAYRaLQaXU_6Qk9",
      callbackURL: "http://localhost:5000/auth/google/callback"
    },
    function(accessToken, refreshToken, profile, cb) {
      console.log({ accessToken, refreshToken, profile, cb });
      // User.findOrCreate({ googleId: profile.id }, function (err, user) {
      //   return cb(err, user);
      // });
      return cb(null, { googleId: profile.id });
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log("successful auth");
    res.redirect("/home");
  }
);

app.get("/", (req, res) => res.send({ data: "api ok" }));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
