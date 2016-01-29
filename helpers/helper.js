/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This module exposes helper functions that are useful for the app.
 *
 * @author TCDEVELOPER
 * @version 1.0
 */

var _ = require('underscore');
var config = require('config');
var helper = {};

/**
 * Get arguments for service methods.
 * @param {Object} req the request object
 * @param {Array} fields the request fields.
 * @returns {Array} The arguments for service method.
 */
function getMethodArguments(req, fields) {
    return _.map(fields, function(field) {
        if (field === '*') {
            return req;
        }else if (field.indexOf('.') === -1) {
            return req[field];
        }else {
            //only params.XX
            var splits = field.split('.');
            return req[splits[0]][splits[1]];
        }
    });
}

/**
 * Respond data from service method with arguments.
 * @param {Object} service the service object
 * @param {String} method the service method
 * @param {Array} fields the fields of request
 * @returns {Function} the wrapped service function for express
 */
helper.respondWithData = function(service, method, fields) {
    return function (req, res, next) {
        var params = getMethodArguments(req, fields);
        params.push(function(err, data) {
            if (err) {
                return next(err);
            }else {
                res.send(data);
            }
        });
        service[method].apply(null,params);
    };
};

/**
 * Respond ok status if succeed to run service method with arguments.
 * @param {Object} service the service object
 * @param {String} method the service method
 * @param {Array} fields the fields of request
 * @returns {Function} the wrapped service function for express
 */
helper.respondWithOKStatus = function(service, method, fields) {
    return function (req, res, next) {
        var params = getMethodArguments(req, fields);
        params.push(function(err) {
            if (err) {
                return next(err);
            }else {
                res.status(config.OK_STATUS_CODE).end();
            }
        });
        service[method].apply(null,params);
    };
};

module.exports = helper;
