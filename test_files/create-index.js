/*
 * Copyright (C) 2015 TopCoder Inc., All Rights Reserved.
 */
/**
 * This module will create indexes used in thia application.
 *
 * @version 1.0
 * @author TCDEVELOPER
 */
process.env.NODE_ENV = 'development';
var _ = require('underscore');
var async = require('async');
var config = require('config');
var logger = require('../helpers/logger');
var db = require('../CloudantUtil').getCloudantDatabase(config.DATABASE);
var badgeAssertionDesignName = config.BADGEASSERTION_DESIGN_NAME;
var badgeAssertionIndexName = config.BADGEASSERTION_INDEX_NAME;
/**
 * Create index for badge assertion.
 * @param doc The document
 */
var badgeAssertionIndexer = function (doc) {
    if (doc.userId) {
        index('userId', doc.userId, {'store': true});
    }
    if (doc.assertionId) {
        index('assertionId', doc.assertionId, {'store': true});
    }
    if (doc.type) {
        index('type', doc.type, {'store': true});
    }
    if (doc.badgeId) {
        index('badgeId', doc.badgeId, {'store': true});
    }
    if (doc.time) {
        index('time', doc.time, {'store': true});
    }
    if (doc.issuedOn) {
        index('issuedOn', doc.issuedOn, {'store': true});
    }
};
async.waterfall([function (cb) {
    //get all indexes
    db.index(function (err, result) {
        cb(err, result);
    });
}, function (result, cb) {
    //skip if exsit text type index
    if (_.contains(_.pluck(result.indexes, 'type'), 'text')) {
        logger.debug('Exist text index!');
        return cb(null);
    }
    logger.debug('Create text index!');
    db.index({
        'type': 'text',
        'index': {}
    }, function (err) {
        cb(err);
    });
}, function (cb) {
    var id = '_design/' + badgeAssertionDesignName;
    var ddoc = {
        _id: id,
        indexes: {}
    };
    ddoc.indexes[badgeAssertionIndexName] = {
        analyzer: {name: 'standard'},
        index: badgeAssertionIndexer
    };
    db.get(id, function (err) {
        if (err && err.statusCode === config.NOT_FOUND_STATUS_CODE) {
            logger.debug('Create badge assertion index!');
            db.insert(ddoc, function (error) {
                cb(error);
            });
        } else if (err) {
            cb(err);
        } else {
            logger.debug('Exist badge assertion index!');
            cb(null);
        }
    });
}], function (err) {
    if (err) {
        logger.error(err);
    } else {
        logger.info('Succeed to create indexes!');
    }
});
