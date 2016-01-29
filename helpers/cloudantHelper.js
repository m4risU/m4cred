/**
 * Copyright (C) 2015 TopCoder Inc., All Rights Reserved.
 */

/**
 * This module represents cloudant help methods.
 *
 * Version 1.1
 *     - Added : Return if user already liked badge or not in getBadgeAssertionDetail
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var _ = require('underscore');
var config = require('config');
var userModel = config.USER_MODEL;
var userNotExistCode = config.USER_NOT_EXIST_CODE;
var errorCodes = config.ERROR_CODES;
var badgeAssertionDesignName = config.BADGEASSERTION_DESIGN_NAME;
var badgeAssertionIndexName = config.BADGEASSERTION_INDEX_NAME;
var modeTypes = config.MODEL_TYPES;
var badgeAssertionType = modeTypes.BadgeAssertion;
var badgeLikeType = modeTypes.BadgeLike;
var badgeCommentType = modeTypes.BadgeComment;
var badgeFavorType = modeTypes.BadgeFavor;
var userType = modeTypes.User;
var NotFoundError = require('./errors').NotFoundError;
var async = require('async');

var cloudantHelper = {};
var bluePagesService = require('../services/BluePagesService');
var omitFields = ['rev', 'ok'];
/**
 * Transform result from cloudant.
 * @param result the result from cloudant.
 * @returns The transformed result with id and no unrelated fields.
 */
cloudantHelper.transform = function (result) {
    if (_.isArray(result)) {
        var clean = [];
        _.each(result, function (item) {
            if (_.isUndefined(item.id)) {
                item.id = item._id;
            }
            clean.push(_.omit(item, omitFields));
        });
        result = clean;
    } else if (_.isObject(result)) {
        if (_.isUndefined(result.id)) {
            result.id = result._id;
        }
        result = _.omit(result, omitFields);
    }
    return result;
};

/**
 * Get paging selector with skip and limit.
 * @param options the paging options
 * @param selector the extra selector.
 * @returns {Object} the selector with paging options.
 */
cloudantHelper.getPagingSelector = function (options, selector) {
    var pageSize = options.pageSize;
    var pageNum = options.pageNum;
    var params = {};
    if (pageSize && pageNum) {
        var size = Number(pageSize);
        var start = Number(pageNum);
        params.skip = (start - 1) * size;
        params.limit = size;
    }
    return _.extend(params, selector);
};

/**
 * Get model result by id from cloudant, it will set errorCode and errorMsg if not found.
 * @param db the database.
 * @param id the id.
 * @param model the model name.
 * @param code the not exist error code.
 * @param clean the flag to clean result from cloudant.
 * @param callback the callback function
 */
cloudantHelper.get = function (db, id, model, code, clean, callback) {
    db.get(id, function (err, doc) {
        if (err && err.statusCode === config.NOT_FOUND_STATUS_CODE) {
            var error = new NotFoundError('Not found ' + model + ' with id ' + id);
            error.errorCode = code;
            error.errorMsg = errorCodes[model][code];
            callback(error);
        } else if (err) {
            callback(err);
        } else {

            callback(null, clean ? cloudantHelper.transform(doc) : doc);
        }
    });
};

/**
 * Find single model with search criteria from cloudant, it will set errorCode and errorMsg if not found.
 * @param db the database.
 * @param params the search params.
 * @param model the model name.
 * @param code the not exist error code.
 * @param callback the callback function
 */
cloudantHelper.findSingle = function (db, params, model, code, callback) {
    db.find(_.extend(params, {'limit': 1}), function (err, result) {
        if (err) {
            callback(err);
        } else {
            if (!result.docs.length) {
                var error = new NotFoundError('Not found ' + model + ' with match ' + JSON.stringify(_.omit(params.selector, 'type')));
                error.errorCode = code;
                error.errorMsg = errorCodes[model][code];
                return callback(error);
            }
            callback(null, result.docs[0]);
        }
    });
};
/**
 * Get badge number.
 * @param db the database.
 * @param userId the user id.
 * @param callback the callback function
 */
cloudantHelper.getBadgeNum = function (db, userId, callback) {
    cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: 'userId:' + userId + ' AND type:' + badgeAssertionType}, callback);
};

/**
 * Get badge assertion details.
 * @param db the database
 * @param userId the user id.
 * @param assertionId the assertion id.
 * @param badgeId the badge id.
 * @param needLikeNum the flag to get like number
 * @param needCommentNum the flag to get comment number
 * @param needfavoriteNum the flag to get favorite number
 * @param needUserLike the flag to get user like state
 * @param callback the callback function
 */
cloudantHelper.getBadgeAssertionDetail = function (db, userId, assertionId, badgeId, needLikeNum, needCommentNum, needfavoriteNum, needUserLike, callback) {
    var subQuery = 'assertionId:' + assertionId;
    async.auto({
        likeNum: function (ck) {
            if (!needLikeNum|| !assertionId) {
                return ck(null);
            }
            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: subQuery + ' AND type:' + badgeLikeType}, ck);
        },
        commentNum: function (ck) {
            if (!needCommentNum|| !assertionId) {
                return ck(null);
            }
            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: subQuery + ' AND type:' + badgeCommentType}, ck);
        },
        liked: function (ck) {
            if (!needUserLike || !badgeId) {
                return ck(null);
            }
            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: 'assertionId:' + assertionId + ' AND userId:' + userId + ' AND type:' + badgeLikeType}, ck.wrap(function (count) {
                ck(null, count > 0);
            }));
        },
        favorite: function (ck) {
            if (!needfavoriteNum || !badgeId) {
                return ck(null);
            }
            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: 'badgeId:' + badgeId + ' AND userId:' + userId + ' AND type:' + badgeFavorType}, ck.wrap(function (count) {
                ck(null, count > 0);
            }));
        },
        favoriteNum: function (ck) {
            if (!needfavoriteNum || !badgeId) {
                return ck(null);
            }
            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: subQuery + ' AND type:' + badgeFavorType}, ck);
        },
        earnerNum: function (ck) {
            if (!badgeId) {
                return ck(null);
            }
            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: 'badgeId:' + badgeId + ' AND type:' + badgeAssertionType}, ck);
        }
    }, callback);
};

/**
 * Get details of users.
 * @param db the databse.
 * @param userIds the ids of user.
 * @param callback the callback function
 */
cloudantHelper.getUsersDetail = function (db, userIds, callback) {
    async.map(userIds, function (userId, cp) {
        cloudantHelper.findSingle(db, {
            'selector':{
                'type':userType,
                '_id':userId
            }
        }, userModel, userNotExistCode, cp.wrap(function (foundUser) {
            foundUser = cloudantHelper.transform(foundUser);
            bluePagesService.queryProfile(foundUser.intranetID, cp.wrap(function (profile) {
                cp(null, _.extend(foundUser, _.extend({
                    'userId': userId
                }, profile)));
            }));
        }));
    }, callback);
};

/**
 * Insert document
 * @param {Object} db the database.
 * @param {Object}doc the document.
 * @param {Function} callback the callback function.
 */
cloudantHelper.insert = function (db, doc, callback) {
    db.insert(doc, callback.wrap(function (result) {
        callback(null, cloudantHelper.transform(_.extend(result, doc)));
    }));
};

/**
 * Find and insert document if not exist
 * @param {Object} db the database.
 * @param {Object}doc the document.
 * @param {Object}params the search params.
 * @param {Function} callback the callback function.
 */
cloudantHelper.findAndInsert = function (db, doc, params, callback) {
    async.waterfall([function (cb) {
        db.find(params, cb);
    }, function (result, headers, cb) {
        if (result.docs.length) {
            cb(null, true);
        } else {
            cloudantHelper.insert(db, doc, callback.wrap(function () {
                callback(null, false);
            }));
        }
    }], callback);
};

/**
 * Find and delete document if exist
 * @param {Object} db the database.
 * @param {Object}params the search params.
 * @param {Function} callback the callback function.
 */
cloudantHelper.findAndDelete = function (db, params, callback) {
    db.find(params, callback.wrap(function (result) {
        if (result.docs.length) {
            var doc = result.docs[0];
            db.destroy(doc._id, doc._rev, function (err) {
                callback(err);
            });
        } else {
            callback(null);
        }
    }));
};

/**
 * Find documents
 * @param {Object} db the database.
 * @param {Object}params the search params.
 * @param {Function} callback the callback function.
 */
cloudantHelper.find = function (db, params, callback) {
    db.find(params, callback.wrap(function (result) {
        callback(null, cloudantHelper.transform(result.docs));
    }));
};

/**
 * Get count of match search criteria
 * @param {Object} db the database.
 * @param {String} designDocumentName the design document name.
 * @param {String} indexName the index name.
 * @param {Object}query the search query
 * @param {Function} callback the callback function.
 */
cloudantHelper.count = function (db, designDocumentName, indexName, query, callback) {
    db.search(designDocumentName, indexName, _.extend(query, {limit: 0}), callback.wrap(function (body) {
        callback(null, body.total_rows);
    }));
};

/**
 * Delete document by id, it will set errorCode and errorMsg if not found.
 * @param {Object} db the database.
 * @param {String}id the id.
 * @param {String}model the model name.
 * @param {String}code the not exist code.
 * @param {Function} callback the callback function.
 */
cloudantHelper.delete = function (db, id, model, code, callback) {
    cloudantHelper.get(db, id, model, code, false, callback.wrap(function (doc) {
        db.destroy(doc._id, doc._rev, callback.errorOnly());
    }));
};

module.exports = cloudantHelper;
