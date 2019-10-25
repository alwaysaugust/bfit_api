// see https://github.com/passport/express-4.x-facebook-example/blob/master/server.js
const express = require("express");
const app = express();
const UserModel = require("./models/UserModel");
const port = 5000;
//see https://stackoverflow.com/questions/16781294/passport-js-passport-initialize-middleware-not-in-use
const passport = require("passport");
//see https://github.com/jaredhanson/passport-google-oauth2
var GoogleStrategy = require("passport-google-oauth20").Strategy;
app.use(require("cookie-parser")("www.billi.cat"));
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: "www.billi.cat",
    resave: true,
    saveUninitialized: true
  })
);
const cookieSession = require("cookie-session");

// cookieSession config
// app.use(
//   cookieSession({
//     maxAge: 24 * 60 * 60 * 1000, // One day in milliseconds
//     keys: ["www.billi.cat"]
//   })
// );
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With"
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
    session: true,
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

    res.redirect("http://localhost:5000/login");
  }
);

app.get("/login", (req, res) => {
  console.log("/login");
  console.log(req.user);
  if (req.user) {
    res.cookie("api_session", req.user.googleId, {
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
    res.cookie("user", JSON.stringify(req.user), {
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
    res.redirect(302, "http://localhost:3000/");
  } else {
    res.redirect(302, "http://localhost:3000/login");
  }
});

app.get("/", (req, res) => res.send({ data: "api ok" }));

app.get(
  "/testAuth",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:3000/login",
    scope: ["profile", "https://www.googleapis.com/auth/fitness.activity.read"]
  }),
  function(req, res) {
    res.json({ data: req.user });
  }
);

app.get("/user", async (req, res) => {
  console.log("get user");
  console.log(req.params);
  console.log(req.query);
  console.log(req.user);
  console.log(req.session);
  if (!req.user) {
    res.send({ error: { code: 0, message: "User needs to login/register" } });
  } else {
    res.send({ data: req.user });
  }
});

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
  res.redirect("http://localhost:3000/login");
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
