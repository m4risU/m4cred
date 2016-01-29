/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * This service provides method to retrieve information from BluePages through IntranetID (IBM ID) .
 *
 * Version 1.1
 *     - Changed photo to match mocked user profile picture
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var logger = require('../helpers/logger');

/**
 * Query user information from bluepage
 * @param {String} intranetID the intranetID
 * @param {Function} callback the callback function
 */
function queryProfile(intranetID, callback) {
    callback(null, {
        photo: intranetID + '.jpg',
        name: 'name for ' + intranetID,
        jobName: 'jobName for ' + intranetID,
        jobLocation: 'jobLocation for ' + intranetID
    });
}

module.exports = {
    queryProfile:queryProfile
};
logger.wrapFunctions(module.exports,'BluePagesService');
