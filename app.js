require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const _ = require('lodash');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const back = require('express-back');
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "This is my Secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const clusterConnect = "mongodb+srv://admin-jin:" + process.env.CLUSTER_PASSWORD + "@cluster0.sbqc3.mongodb.net/<dbname>?retryWrites=true&w=majority/myWeddingDB"
mongoose.connect(clusterConnect, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});

app.use(session({
  secret: 'super secret',
  resave: true,
  saveUninitialized: true
}));
app.use(back());

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://still-inlet-30675.herokuapp.com/auth/google/mywedding"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id,
      username: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

const venueSchema = new mongoose.Schema({
  name: String,
  nameEng: String,
  address: {
    doshi: String,
    shigungu: String,
    rest: String
  },
  tel: String,
  homepage: String,
  type: String,
  url: String
  // rating:
});

const Venue = mongoose.model("Venue", venueSchema);

////////////////// local register and login //////////////////
app.get("/register", function(req, res) {
  res.render("register");
});

app.post("/register", function(req, res) {
  User.register({
    username: req.body.username,
    active: false
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
      // res.render("errors", {
      //   error: err
      // });
    } else {
      passport.authenticate("local")(req, res, function() { // this creates a cookie
        res.redirect("about"); // if authentication was succesful
      });
    }
  });
});

//
// app.get("/register/nickname", function(req, res) {
//   res.render("nickname");
// });
//
// app.post("/register", function(req, res) {
//   User.register({
//     username: req.body.username,
//     active: false
//   }, req.body.password, function(err, user) {
//     if (err) {
//       console.log(err);
//       res.redirect("/register");
//       // res.render("errors", {
//       //   error: err
//       // });
//     } else {
//       passport.authenticate("local")(req, res, function() { // this creates a cookie
//         res.redirect("/register/nickname"); // if authentication was succesful
//       });
//     }
//   });
// });

app.get("/login", function(req, res) {
  res.render("login");
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) { // the login() comes from passport
    if (err) {
      console.log(err);
      // res.render("errors", {
      //   error: err
      // });
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/about");
      });
    }
  });
});

////////////////// for google OAuth //////////////////
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile']
  }));

app.get('/auth/google/mywedding',
  passport.authenticate('google', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/about');
  });

////////////////// logout //////////////////
app.get("/logout", function(req, res) {
  req.logout();
  res.back();
});

////////////////// main page //////////////////
app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("home", {
      loggedIn: true
    });
  } else {
    res.render("home", {
      loggedIn: false
    });
  }
});

////////////////// about page //////////////////
app.get("/about", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("about", {
      username: req.user.username,
      loggedIn: true
    });
  } else {
    res.render("about", {
      loggedIn: false
    });
  }
});

////////////////// location page //////////////////
// app.get("/location", function(req, res) {
//   console.log(req.body);
//   if (req.isAuthenticated()) {
//     res.render("location", {
//       username: req.user.username,
//       loggedIn: true
//     });
//   } else {
//     res.render("location", {
//       loggedIn: false
//     });
//   }
// });



app.get("/location/:locationUrl", function(req, res) {
  let currLocationUrl = req.params.locationUrl //seoul

  Venue.find({}, function(err, venues) {
    if (req.isAuthenticated()) {
      res.render("location", {
        username: req.user.username,
        venues: venues,
        loggedIn: true
      });
    } else {
      res.render("location", {
        venues: venues,
        loggedIn: false
      });
    }
  });
});

////////////////// venue main page //////////////////
app.get("/venue-main/:venueUrl", function(req, res) {

  Venue.findOne({
    url: req.params.venueUrl
  }, function(err, existingVenue) {
    if (err) {
      console.log(err);
    } else {
      if (!existingVenue) {
        if (req.isAuthenticated()) {
          res.render("location", {
            username: req.user.username,
            loggedIn: true
          });
        } else {
          res.render("location", {
            loggedIn: false
          });
        }
      } else {
        if (req.isAuthenticated()) {
          res.render("venue-main", {
            username: req.user.username,
            loggedIn: true,
            venue: existingVenue
          });
        } else {
          res.render("venue-main", {
            loggedIn: false,
            venue: existingVenue
          });
        }
      }
    }
  });
});

////////////////// compose venue page //////////////////
app.get("/compose", function(req, res) {
  res.render("compose");
});

app.post("/compose", function(req, res) {
  const newVenue = {
    name: req.body.newName,
    nameEng: req.body.newEngName,
    address: {
      doshi: req.body.newAddressShido,
      shigungu: req.body.newAddressShidogungu,
      rest: req.body.newAddressRest
    },
    tel: req.body.newTel,
    homepage: req.body.newPage,
    type: req.body.newType,
    // rating:
  };

  Venue.findOne({
    name: _.lowerCase(newVenue.name)
  }, function(err, existingVenue) {
    if (err) {
      console.log(err);
    } else {
      if (!existingVenue) {
        const venue = new Venue({
          name: newVenue.name,
          nameEng: newVenue.nameEng,
          address: {
            doshi: newVenue.address.doshi,
            shigungu: newVenue.address.shigungu,
            rest: newVenue.address.rest
          },
          tel: newVenue.tel,
          homepage: newVenue.homepage,
          type: newVenue.type,
          url: _.lowerCase(newVenue.nameEng)
        });
        venue.save();
        res.redirect("venue-main/" + venue.url);
      } else {
        res.render("compose");
      }
    }
  });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 8000;
}

app.listen(port, function() {
  console.log("Server has started succesfully");
});
