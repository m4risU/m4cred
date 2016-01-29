/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This configuration of passport for express App.
 *
 * Version 1.1
 *     - Added return user name from token
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var _ = require('underscore');
var config = require('config');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var JwtStrategy = require('passport-jwt').Strategy;

module.exports = function (app) {

    //use cookie
    app.use(cookieParser());

    //Init passport
    app.use(passport.initialize());

    //Serialize user
    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    //Deserialize user
    passport.deserializeUser(function (obj, done) {
        done(null, obj);
    });
    //use JWT strategy
    passport.use(new JwtStrategy(config.JWT_OPTIONS, function (jwtPayload, done) {
        //get id from decoded token directly
        return done(null, _.pick(jwtPayload, ['intranetID', 'id', 'name']));
    }));
};
