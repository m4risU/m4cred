/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This entry of express App.
 *
 * Version 1.1
 *     - Added serve static profile picture
 *     - Added support for anonymous routes
 *
 * @author TCDEVELOPER
 * @version 1.1
 */

var express = require('express');
var morgan = require('morgan');
require('./helpers/function-utils');
var _ = require('underscore');
var cfenv = require('cfenv');
var createDomain = require('domain').create;

var bodyParser = require('body-parser');
var logger = require('./helpers/logger');
var ForbiddenError = require('./helpers/errors').ForbiddenError;
var NotAuthenticatedError = require('./helpers/errors').NotAuthenticatedError;
var BadRequestError = require('./helpers/errors').BadRequestError;
var ProfileService = require('./services/ProfileService');
var BadgeService = require('./services/BadgeService');
var BadgeAssertionService = require('./services/BadgeAssertionService');
// create a new express server
var app = express();
var multer = require('multer');
var autoReap  = require('multer-autoreap');
autoReap.options.reapOnError = false;
var config = require('config');
var uploadFolder = config.UPLOAD_FOLDER;
var fs = require('fs');
var passport = require('passport');
var mkdirp = require('mkdirp');
if (!fs.existsSync(uploadFolder)) {
    mkdirp.sync(uploadFolder);
}
var uploader = multer({
    dest: uploadFolder
});
//clean up uploaded files
app.use(autoReap);
app.use(morgan('dev'));
app.use(bodyParser.json());

//catch thrown errors
app.use(function (req, res, next) {
    var domain = createDomain();
    domain.add(req);
    domain.add(res);
    domain.run(function () {
        next();
    });
    domain.on('error', function (e) {
        next(e);
    });
});

// Anonymous routes
_.each(require('./routes'), function (verbs, url) {
    _.each(verbs, function (def, verb) {
        if (def.anonymous) {
            var method = require('./controllers/' + def.controller)[def.method];
            if (!method) {
                throw new Error(def.method + ' is undefined');
            }
            var actions = [];

            actions.push(method);

            app[verb](url, actions);
        }
    });
});

require('./app-passport')(app);

/* Load all user related routes */
_.each(require('./routes'), function (verbs, url) {
    _.each(verbs, function (def, verb) {

        var method = require('./controllers/' + def.controller)[def.method];
        if (!method) {
            throw new Error(def.method + ' is undefined');
        }
        var actions = [];
        actions.push(passport.authenticate('jwt', {session: false}));
        if (def.badgeAssertion) {
            actions.push(function (req, res, next) {
                var id = req.params.id;
                BadgeAssertionService.getById(id, function(err, entity) {
                    if (err) {
                        return next(err);
                    }
                    if (def.checkDenySelfBadgeAssertion) {
                        if (entity.userId === req.user.id) {
                            return next(new ForbiddenError('Can not perform action on badge assertion of yourself.'));
                        }
                    }
                    if (def.checkAllowSelfBadgeAssertion) {
                        if (entity.userId !== req.user.id) {
                            return next(new ForbiddenError('Can not perform action on badge assertion of others.'));
                        }
                    }
                    if (def.checkPublishedBadgeAssertion) {
                        if (!entity.published) {
                            var error = new ForbiddenError('Can not perform action on not published badge assertion.');
                            error.errorCode = config.BADGE_ASSERTION_NOT_PUBLISHED;
                            error.errorMsg = config.ERROR_CODES[config.BADGE_ASSERTION_MODEL][config.BADGE_ASSERTION_NOT_PUBLISHED];
                            return next(error);
                        }
                    }
                    if (def.checkExpiredBadgeAssertion) {
                        if (entity.expires < new Date().valueOf()) {
                            return next(new ForbiddenError('Can not perform action on expired badge assertion.'));
                        }
                    }
                    req.badgeAssertion = entity;
                    next();
                });
            });
        }
        if (def.badge) {
            actions.push(function (req, res, next) {
                var id = req.params.uid || req.params.id;
                var method = _.isUndefined(req.params.uid) ? 'getById' : 'getByUid';
                BadgeService[method](id, function (err, entity) {
                    if (err) {
                        return next(err);
                    }
                    req.badge = entity;
                    next();
                });
            });
        }
        if (def.profile) {
            actions.push(function (req, res, next) {
                ProfileService.getByIntranetID(req.params.id, function (err, entity) {
                    if (err) {
                        return next(err);
                    }
                    entity.id = entity._id;
                    delete entity._id;
                    req.profile = entity;
                    next();
                });
            });
        }
        if (def.anonymous !== true) {
            actions.push(method);
        }
        if (def.upload) {
            app[verb](url, uploader.array('files'), actions);
        } else {
            app[verb](url, actions);
        }
    });
});

// Serve static file
app.use('/public', express.static(__dirname + '/upload/public'));

/* Define fallback route */
app.use(function (req, res, next) {//jshint ignore:line
    res.status(config.NOT_FOUND_STATUS_CODE).json({
        error: 'Route not found for method ' + req.method + ' and url ' + req.url
    });
});

/* Define error handler */
app.use(function (err, req, res, next) {//jshint ignore:line
    logger.logFullError(err, req.method + ' ' + req.url);
    var statusCode = err.statusCode || err.httpStatus || config.INTERNAL_SERVER_STATUS_CODE;
    if (config.STATUS_CODES.indexOf(statusCode) === -1) {
        statusCode = config.INTERNAL_SERVER_STATUS_CODE;
    }
    var errorResponse = {
        error: err.message
    };
    //set errorCode and errorMsg if exist
    if (!_.isUndefined(err.errorCode)) {
        errorResponse.errorCode = Number(err.errorCode);
    }
    if (!_.isUndefined(err.errorMsg)) {
        errorResponse.errorMsg = err.errorMsg;
    }
    res.status(statusCode).json(errorResponse);
});
// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

app.listen(appEnv.port, appEnv.bind, function () {
    logger.info('Express server listening on ' + appEnv.url);
});
