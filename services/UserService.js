/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * This service provides methods for managing accounts.
 *
 * @version 1.0
 */
'use strict';

var jwt = require('jsonwebtoken');
var _ = require('underscore');
var async = require('async');
var request = require('superagent');
var config = require('config');

var cloudantHelper = require('../helpers/cloudantHelper');
var db = require('../CloudantUtil').getCloudantDatabase(config.DATABASE);

var ProfileService = require('../services/ProfileService');

var helper = require('../helpers/helper');
var validate = require('../helpers/validator').validate;
var logger = require('../helpers/logger');

var BadRequestError = require('../helpers/errors').BadRequestError;
var NotFoundError = require('../helpers/errors').NotFoundError;
var NotAuthenticatedError = require('../helpers/errors').NotAuthenticatedError;

/**
 * Send login request to IBM auth endpoint.
 * @param {Object} body the request body
 * @param {function(Error, Object)} callback the callback function
 */
function _sendLoginRequest (body, callback) {
    request
        .post(config.AUTH_URL)
        .send(body)
        .set('Content-Type', 'application/json')
        .end(callback);
}

/**
 * Handle login auth request response
 * @param  {Object}   err      Error
 * @param  {Object}   res      Auth response
 * @param {function(Error, Object)} callback the callback function
 */
function _handleLoginResponse (err, res, callback) {
    if (err) {
        return callback(new NotAuthenticatedError());
    }

    switch (res.body.status) {
        case 'COMPLETED':
            /* Authentication process completed */
            return callback(null, res.body);
        case 'OTP_DELIVERED':
            /* Validate OTP */
            _sendLoginRequest({
                requestType: 'OTP_VALIDATE',
                requestId: res.body.requestId,
                otpInfo: {
                    otpValue: res.body.otpHint,
                    otpHint: res.body.otpHint
                }
            }, function (err, res) {
                return _handleLoginResponse(err, res, callback);
            });
            return;
        case 'OTP_DELIVERY_METHOD_SENT':
            /* Due to a bug in the Auth backend, we need to handle some
             * OTP_DELIVERY_METHOD_SENT messages like OTP_DELIVERED
             * messages.
             *
             * Remark: This is a very dirty work around. The auth backend
             * should get fixed instead!
             */
            if (!res.body.otpDeliveryMethods && res.body.otpHint) {
                _sendLoginRequest({
                    requestType: 'OTP_VALIDATE',
                    requestId: res.body.requestId,
                    otpInfo: {
                        otpValue: res.body.otpHint,
                        otpHint: res.body.otpHint
                    }
                }, function (err, res) {
                    return _handleLoginResponse(err, res, callback);
                });
                return;
            }

            /* Select first OTP delivery method */
            if (!res.body.otpDeliveryMethods || !res.body.otpDeliveryMethods.length) {
                return callback(new NotAuthenticatedError());
            }
            var method = res.body.otpDeliveryMethods[0];
            switch (method.methodId) {
                case 'sms':
                case 'email':
                    return _sendLoginRequest({
                        requestType: 'OTP_GENERATE',
                        requestId: res.body.requestId,
                        otpInfo: {
                            otpMethodId: method.methodId
                        }
                    }, function (err, res) {
                        _handleLoginResponse(err, res, callback);
                    });
                default:
                    return callback(new NotAuthenticatedError());
            }
            return;
        default:
            return callback(new NotAuthenticatedError('Invalid intranet ID or password'));
    }
}

/**
 * Login user.
 * @param {Object} body the request body
 * @param {function(Error, Object)} callback the callback function
 */
function _login (body, callback) {
    var error = validate(
        {body: body},
        {
            body: {
                __obj: true,
                requestType: String,
                deviceId: String,
                clientId: String,
                authInfo: {
                    __obj: true,
                    username: String,
                    password: String
                }
            }
        });
    if (error) {
        return callback(new BadRequestError());
    }

    _sendLoginRequest(body, function (err, res) {
        return _handleLoginResponse(err, res, callback);
    });
}

/**
 * Login.
 * @param {Object} req the request
 * @param {Object} res the response
 * @param {function(Error, Object)} callback the callback function
 */
function login (req, callback) {
    var error = validate({
        req: req,
        callback: callback
    }, {
        req: 'AnyObject',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    async.waterfall([
        function (cb) {
            _login(req.body, cb);
        }, function (authResult, cb) {
            ProfileService.getFullUserByIntranetID(req.body.authInfo.username, function (err, account) {
                if (err) {
                    cb(err);
                } else if (!account) {
                    cb(new NotAuthenticatedError('Account is not found'));
                } else {
                    cb(null, account);
                }
            });
        },
        function (account, cb) {
            req.user = {
                id: account._id,
                name: account.name,
                intranetID: account.intranetID,
                photo: account.photo
            };
            account.id = account._id;
            delete account.token;
            delete account.tokeExpiresAt;
            var token = jwt.sign(_.clone(account), config.JWT_OPTIONS.secretOrKey, config.JWT_OPTIONS);
            account.token = token;
            var decoded = jwt.verify(token, config.JWT_OPTIONS.secretOrKey, config.JWT_OPTIONS);
            account.tokeExpiresAt = decoded.exp * 1000;
            delete account.id;
            cloudantHelper.insert(db, account, cb);
        }
    ], function (err, account) {
        if (err) {
            callback(err);
            return;
        }
        console.log(req.user);
        callback(null, {
            token: account.token,
            user: req.user
        });
    });
}

/**
 * Logout.
 * @param {Object} user the user
 * @param {function(Error, Object)} callback the callback function
 */
function logout (user, callback) {
    var error = validate({
        user: user,
        callback: callback
    }, {
        user: 'UserValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    ProfileService.getFullUserByIntranetID(user.intranetID, function (err, account) {
        if (err) {
            return callback(err);
        } else if (!account) {
            return callback(new NotFoundError('Account is not found'));
        } else {
            // delete token on logout
            account.token = undefined;
            cloudantHelper.insert(db, account, function (err, saved) {
                if (err) {
                    callback(err);
                    return;
                }
                callback(null, {
                    sucess: true
                });
            });
        }
    });
}

module.exports = {
    login: login,
    logout: logout
};

logger.wrapFunctions(module.exports, 'UserService');
