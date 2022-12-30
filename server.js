// NOTES
// NECESSARY TO USE SECRETS IN REPLIT
// CONNECTED TO MONGODB ATLAST WEBSITE
// RESOURCE FOR SETUP ON FCC https://www.freecodecamp.org/news/get-started-with-mongodb-atlas/

'use strict';
require('dotenv').config();
const express = require('express');
// 3.4: Use Secrets (lock icon) to set SESSION_SECRET variable for .env
const mySecret = process.env['SESSION_SECRET']
const myDB = require('./connection');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
// #3. SET UP A PASSPORT
// 3.1: Create variables
const session = require('express-session');
const passport = require('passport');
// 4.3: Declare ObjectID (class from the mongodb package)
const { ObjectID } = require('mongodb');
//const URI = process.env['MONGO_URI']
// 6.1: Add passport-local@~1.0.0 (has already been added as a dependency) to your server.
const LocalStrategy = require('passport-local');

const app = express();

// #1. SET UP A TEMPLATE ENGINE
// 1.1: Use the set method to assign pug as the view engine property's value
// 1.2: Add a setmethod that sets the views property of app to point to the ./views/pug directory
app.set('view engine', 'pug');
app.set('views', './views/pug');

// 3.2: Set up your Express app to use the session
app.use(session({
  secret: mySecret,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// 3.3: Tell express app to use passport.initialize() and passport.session()
app.use(passport.initialize());
app.use(passport.session());

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// #5. IMPLEMENT THE SERIALIZATION OF A PASSPORT USER
myDB(async client => {
  const myDataBase = await client.db('database').collection('users');

  // Be sure to change the title
  app.route('/').get((req, res) => {
    // Change the response to render the Pug template
    res.render('index', {
      title: 'Connected to Database',
      message: 'Please log in',
      // 7.1: render login from index.pug
      showLogin: true,
      // 
      showRegistration: true
    });
  });

  // #7. HOW TO USE PASSPORT STRATEGIES
  // 7.2:  Add the route /login to accept a POST request (use middleware do this). If the authentication was successful, the user object will be rendered to the view profile.put (response from middleware only called if authentication middleware passes).
  app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
  })

  app.route('/profile').get(ensureAuthenticated, (req, res) => {
    // #9. HOW TO PUT A PROFILE TOGETHER
    // 9.1:  Pass an object w/ property username and value of req.user.username as second arg
    res.render('profile', { username: req.user.username });
  })

  // 10. LOGGING A USER OUT
  // 10.1: Unaethenticate a user
  app.route('/logout').get((req, res) => {
    req.logout();
    res.redirect('/');
  });

  // #11. REGISTRATION OF NEW USERS
  // Logic of registration: 
  //  1) registrate new user: query database w/ findOne -> if error, call next w/ error -> if user is returned, redirect back to home -> if user not found and no errors, then insertOne into the database w/ username and password; as long as no errors, call next to go to step 2, authenticating new user (which already wrote logic for in POST /login route)
  // 2) Authenticate new user
  // 3) Redirect to /profile
  app.route('/register')
  .post((req, res, next) => {
    myDataBase.findOne({ username: req.body.username }, (err, user) => {
      if (err) {
        next(err);
      } else if (user) {
        res.redirect('/');
      } else {
        myDataBase.insertOne({
          username: req.body.username,
          password: req.body.password
        },
          (err, doc) => {
            if (err) {
              res.redirect('/');
            } else {
              // The inserted document is held within
              // the ops property of the doc
              next(null, doc.ops[0]);
            }
          }
        )
      }
    })
  },
    passport.authenticate('local', { failureRedirect: '/' }),
    (req, res, next) => {
      res.redirect('/profile');
    }
  );
  
      // 10.2: Handle missing pages (404)
      app.use((req, res, next) => {
        res.status(404)
          .type('text')
          .send('Not Found');
      });


  // #6. AUTHENTICATION STRATEGIES
  // A strategy can be used to allow users to authenticate based on locally saved info (if have register first) or from other providers (e.g. Google, Github)
  // 6.2: Tell passport to use an instantiated LocalStrategy object w/ a few settings defined. Encapsulate in the database connection since it relies on it.
  passport.use(new LocalStrategy((username, password, done) => {
    myDataBase.findOne({ username: username }, (err, user) => {
      console.log(`User ${username} attempted to log in.`);
      if (err) return done(err);
      if (!user) return done(null, false);
      if (password !== user.password) return done(null, false);
      return done(null, user);
    });
  }));

  // Serialization and deserialization here...
  // #4. SERIALIZATION OF A USER OBJECT
  // 4.1: serializeUser has two args: full user obj, callback used by passport...callback expects two args: error, if any, and unique key to identify user that should be returned in the callback (use user's _id in the object)
  // 4.2: deserializeUser has two args: unique key, callback function...callback expects two args: error, if any, and full user obj. To get full user obj, make query search for Mongo _id. desearializeUser throws error until set up database connection, so comment out.
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser((id, done) => {
    myDataBase.findOne({ _id: new ObjectID(id) }, (err, doc) => {
      done(null, doc);
    });
  });

  // Be sure to add this...
}).catch(e => {
  app.route('/').get((req, res) => {
    res.render('index', { title: e, message: 'Unable to connect to database' });
  });
});
// app.listen out here...

// 1.3: Use res.render() in the route for your home page, passing index as the first argument. This will render the pug template.
// #2. USE A TEMPLATE ENGINE'S POWERS
// 2.1: Your index.pug file uses the variables title and message. Pass them from your server to the Pug file.
// NOTE: MOVED --> NESTED WITHIN myDB connection to database
//app.route('/').get((req, res) => {
//  res.render('index', {title: 'Hello', message: 'Please log in'});
//});

// #8. CREATE NEW MIDDLEWARE
// Checks if user is authenticated first before rendering the profile page. Calls Passport's isAuthenticated method on the request which checks if req.user is defined. If it is, then next() is called, else redirect to homepage.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on port' + PORT);
});
