/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * This file defines application errors.
 *
 * @author TCDEVELOPER
 * @version 1.0
 */

var util = require('util');
var config = require('config');

/**
 * Helper function to create generic error object with http status code
 * @param {String} name the error name
 * @param {String} defaultMessage the default message
 * @param {Number} statusCode the http status code
 * @returns {Function} the error constructor
 * @private
 */
function _createError(name, defaultMessage, statusCode) {
    /**
     * The error constructor
     * @param {String} message the error message
     * @param {String} [cause] the error cause
     * @constructor
     */
    function ErrorCtor(message, cause) {
        Error.call(this);
        Error.captureStackTrace(this);
        this.message = message || defaultMessage;
        this.cause = cause;
        this.statusCode = statusCode;
    }

    util.inherits(ErrorCtor, Error);
    ErrorCtor.prototype.name = name;
    return ErrorCtor;
}

module.exports = {
    BadRequestError: _createError('BadRequestError', 'Bad request', config.BAD_REQUEST_STATUS_CODE),
    NotAuthenticatedError: _createError('NotAuthenticatedError', 'Not authenticated (need re-login)', config.NOT_AUTHENTICATED_STATUS_CODE),
    ForbiddenError: _createError('ForbiddenError', 'Not have permission to perform the requested operation',config.FORBIDDEN_STATUS_CODE),
    NotFoundError: _createError('NotFoundError', 'Resource not found', config.NOT_FOUND_STATUS_CODE),
    MethodNotSupportedError: _createError('MethodNotSupportedError', 'Method not supported', config.METHOD_NOT_SUPPORT_STATUS_CODE),
    InternalServerError: _createError('InternalServerError', 'Internal server error', config.INTERNAL_SERVER_STATUS_CODE)
};
