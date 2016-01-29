/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This utility provides method to get Cloudant instance and database.
 *
 * @author TCDEVELOPER
 * @version 1.0
 */

var config = require('config');
var Cloudant = require('cloudant');

/**
 * Get cloudant instance
 * @return the cloudant instance
 */
function getCloudant() {
    var url = process.env.URL;

    var services = process.env.VCAP_SERVICES;
    if (typeof services !== 'undefined') {
        services = JSON.parse(services);
        url = services.cloudantNoSQLDB[0].credentials.url;
    }
    if (!url) {
        throw new Error('Please define url of cloudant rightly!');
    }
    return Cloudant(url);
}

/**
 * Get Cloudant database instance.
 * @param database the database name
 * @return the database instance
 */
function getCloudantDatabase(database) {
    // Represents the Cloudant DB.
    var cloudantDB;
    var cloudant = getCloudant();
    cloudantDB = cloudant.use(database);
    return cloudantDB;
}

module.exports = {
    getCloudant: getCloudant,
    getCloudantDatabase: getCloudantDatabase
};
