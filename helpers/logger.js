/*
 * Copyright (C) 2015 TopCoder Inc., All Rights Reserved.
 */
/**
 * This module contains the winston logger configuration.
 *
 * @version 1.0
 * @author TCDEVELOPER
 */

var _ = require('underscore');
var winston = require('winston');
var util = require('util');
var config = require('config');
var logger = new (winston.Logger)({
    transports: [
        new(winston.transports.Console)({
            level: config.LOG_LEVEL,
            timestamp: function() {
                return (new Date().toISOString());
            }
        })
    ]
});

/**
 * Log error details with signature
 * @param err the error
 * @param signature the signature
 */
logger.logFullError = function (err, signature) {//jshint ignore:line
    if (!err) {
        return;
    }
    var args = Array.prototype.slice.call(arguments);
    args.shift();
    logger.error.apply(winston, args);
    logger.error(util.inspect(err));
    logger.error(err.stack);
};


/**
 * Wrap all functions of a service and log debug information if DEBUG is enabled
 * @param {Object} service the service to wrap
 * @param {String} serviceName the service name
 */
logger.wrapFunctions = function (service, serviceName) {
    if (config.LOG_LEVEL !== 'debug') {
        return;
    }
    _.each(service, function (method, name) {
        service[name] = function () {
            var signature = serviceName + '#' + name;
            logger.debug('ENTER ' + signature);
            var args = Array.prototype.slice.call(arguments);
            var orgCallback = args.pop();
            if (!_.isFunction(orgCallback)) {
                throw new Error('Last argument must be a function');
            }
            logger.debug('input arguments');
            logger.debug(util.inspect(args));
            var newCallback = function () {
                var cbArgs = Array.prototype.slice.call(arguments);
                if (cbArgs[0]) {
                    logger.logFullError(cbArgs[0], name);
                }
                logger.debug('EXIT ' + signature);
                logger.debug('output arguments');
                logger.debug(util.inspect(cbArgs));
                orgCallback.apply(this, cbArgs);
            };
            args.push(newCallback);
            method.apply(this, args);
        };
    });
};

module.exports = logger;
