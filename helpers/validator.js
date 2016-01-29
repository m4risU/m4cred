/*
 * Copyright (C) 2015 TopCoder Inc., All Rights Reserved.
 */
/**
 * Contains validation functions
 *
 * Version 1.1
 *     - Added validate email
 *
 * @author TCDEVELOPER
 * @version 1.1
 */

var _ = require('underscore');
var config = require('config');
var validator = require('rox').validator;

/**
 * Define a global function used for validation.
 * @param {Object} input the object to validate
 * @param {Object} definition the definition object. Refer to rox module for more details.
 * @param {String} [prefix] the prefix for error message.
 * @throws {Error} error if validation failed
 */
function validate(input, definition, prefix) {
    var error = validator.validate(prefix || 'prefix-to-remove', input, definition);
    if (!error) {
        return null;
    }
    //remove prefix in error message
    error.message = error.message.replace('prefix-to-remove.', '');
    //if input is invalid then change the name to input
    error.message = error.message.replace('prefix-to-remove', 'input');
    error.httpStatus = 400;
    if (error) {
        throw error;
    }
}
validator.registerAlias('IntegerId', {type: 'Integer', min: 1, castString:true});
validator.registerAlias('Order', {'enum':['asc','desc']});
//Any literal object
validator.registerType({
    name: 'AnyObject',
    /**
     *
     * Validate if value is valid ObjectId
     * @param {String} name the property name
     * @param {*} value the value to check
     * @returns {Error|Null} null if value is valid or error if invalid
     */
    validate: function (name, value) {
        if (_.isObject(value)) {
            return null;
        }
        return new Error(name + ' must be an object');
    }
});

validator.registerType({
    name: 'Function',
    /**
     * Validate if value is function
     * @param {String} name the property name
     * @param {*} value the value to check
     * @returns {Error|Null} null if type is correct or error if incorrect
     */
    validate: function (name, value) {
        if (_.isFunction(value)) {
            return null;
        }
        return new Error(name + ' must be Function');
    }
});

function registerPagingValidator(validatorName, fields) {
    validator.registerType({
        name: validatorName,
        /**
         * Validate if value contains valid criteria
         * @param {String} name the property name
         * @param {*} value the value to check
         * @returns {Error|Null} null if type is correct or error if incorrect
         */
        validate: function (name, value) {
            var error = validator.validate(name, value, _.extend({
                'pageNum':'IntegerId',
                'pageSize':'IntegerId'
            }, fields));
            if (error) {
                return error;
            }
            return null;
        }
    });
}
registerPagingValidator('PageValidator',{});
registerPagingValidator('PageWithOrderValidator',{order:'order'});
registerPagingValidator('PageWithCriteriaValidator',{criteria:'String'});

validator.registerType({
    name: 'UserValidator',
    /**
     * Validate if value is valid user object
     * @param {String} name the property name
     * @param {*} value the value to check
     * @returns {Error|Null} null if type is correct or error if incorrect
     */
    validate: function (name, value) {
        if (_.isObject(value) && _.isString(value.id)) {
            return null;
        }
        return new Error(name + ' must be valid user object!');
    }
});

validator.registerType({
    name: 'Email',
    /**
     * Validate if value is valid email address
     * @param {String} name the property name
     * @param {*} value the value to check
     * @returns {Error|Null} null if type is correct or error if incorrect
     */
    validate: function (name, value) {
        var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if (_.isString(value) && re.test(value)) {
            return null;
        }
        return new Error(name + ' must be valid email address!');
    }
});
module.exports = {
    validate: validate
};
