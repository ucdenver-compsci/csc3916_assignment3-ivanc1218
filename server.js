/*
CSC3916 HW3
File: Server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var mongoose = require('mongoose');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://ivancontreras1218:Eie99BjRVpJyLQUL@ivancluster.iszkdbf.mongodb.net/?retryWrites=true&w=majority&appName=IvanCluster";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }
            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.all('/signup', (req, res) => {
    // Returns a message stating that the HTTP method is unsupported.
    res.status(405).send({ message: 'HTTP method not supported.' });
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }
        
        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.all('/signin', (req, res) => {
    // Returns a message stating that the HTTP method is unsupported.
    res.status(405).send({ message: 'HTTP method not supported.' });
});

router.route('/movies/:title')
    .get(authJwtController.isAuthenticated, function (req, res) {
        Movie.findOne({title: req.params.title}, function(err, data) {
            if (err || data.length == 0) {
                res.json({status: 400, message: "Movie ''" + req.params.title + "'' couldn't be found."})
            }
            else {
                res.json({status: 200, message: "" + req.params.title + " was found!", movie: data});
            }
        })
    })

    .post(authJwtController.isAuthenticated, (req, res) => {
        res.json({status: 400, message: "Invalid action."})
    })

    .put(authJwtController.isAuthenticated,function(req, res) {
        Movie.findOneAndUpdate(
            {title: req.params.title}, { 
                title: req.body.title,
                releaseDate: req.body.releaseDate,
                genre: req.body.genre,
                actors: req.body.actors 
            },
            { new: true },
            function(err, doc) {
                if (err) {
                    res.json({ message: "Movie could not be updated." });
                }
                else if (!doc) {
                    res.json({ message: "Movie not found." });
                }
                else {
                    res.json({ status: 200, message: "" + req.body.title + " UPDATED"});
                }
            }
        );
    })

    .delete(authJwtController.isAuthenticated, function(req, res) {
        Movie.findOneAndDelete({title: req.params.title}, function(err, data) {
            if (err || data.length == 0) {
                res.json(err);
                res.json({message: "There was an issue trying to find your movie"})
            }
            else {
                res.json({message: "" + req.params.title + " DELETED"});
            }
        })
    })
    
    .all((req, res) => {
        // Any other HTTP Method
        // Returns a message stating that the HTTP method is unsupported.
        res.status(405).send({ message: 'HTTP method not supported.' });
    }
);

router.route('/movies')
    .get(authJwtController.isAuthenticated, function (req, res) {
        Movie.find({}, 'title', function(err, data) {
            if (err || data.length == 0) {
                res.json({status: 400, message: "No movies found."})
            }
            else {
                const movieTitles = data.map(movie => movie.title);
                res.json({status: 200, message: "Movies found!", titles: movieTitles});
            }
        })
    })
    
    .post(authJwtController.isAuthenticated, function(req, res) {
        Movie.findOne({title: req.body.title}, function(err) {
            if (err) {
                res.status(400);
            }
            else if (req.body.actors.length < 3) {
                res.json({message: "Not enough actors. (You need at least 3)"});
            }
            else {
                var newMovie = new Movie();
                newMovie.title = req.body.title;
                newMovie.releaseDate = req.body.releaseDate;
                newMovie.genre = req.body.genre;
                newMovie.actors = req.body.actors;
                
                newMovie.save(function (err) {
                    if (err) {
                    res.json({message: err});
                    }
                    else {
                        res.json({status: 200, success: true, message: "" + req.body.title + " SAVED"});
                    }
                });
            }

        });
    })

    .put(authJwtController.isAuthenticated, (req, res) => {
        res.json({status: 400, message: "Invalid action."})
    })

    .delete(authJwtController.isAuthenticated, (req, res) => {
        res.json({status: 400, message: "Invalid action."})
    })

    .all((req, res) => {
        // Any other HTTP Method
        // Returns a message stating that the HTTP method is unsupported.
        res.status(405).send({ message: 'HTTP method not supported.' });
    })

app.use('/', router);
app.listen(process.env.PORT || 8080 );
module.exports = app; // for testing only


