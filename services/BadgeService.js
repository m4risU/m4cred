/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * This service provides methods for managing Badge.
 *
 * @author TCDEVELOPER
 * @version 1.0
 */
var _ = require('underscore');
var config = require('config');
var logger = require('../helpers/logger');
var validate = require('../helpers/validator').validate;
var cloudantHelper = require('../helpers/cloudantHelper');
var db = require('../CloudantUtil').getCloudantDatabase(config.DATABASE);
var modeTypes = config.MODEL_TYPES;
var badgeType = modeTypes.Badge;
var badgeModel = config.BADGE_MODEL;
var badgeNotExistCode = config.BADGE_NOT_EXIST_CODE;

/**
 * Get badge by id.
 * @param {String} id the id
 * @param {Function} callback the callback function.
 */
function getById(id, callback) {
    var error = validate({
        id: id,
        callback:callback
    }, {
        id:'String',
        callback:'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findSingle(db, {
        'selector':{
            'type':badgeType,
            '_id':id
        }
    }, badgeModel, badgeNotExistCode, callback);
}

/**
 * Get badge by uid.
 * @param {String} uid the uid
 * @param {Function} callback the callback function.
 */
function getByUid(uid, callback) {
    var error = validate({
        'uid': uid,
        'callback':callback
    }, {
        'uid':'String',
        'callback':'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findSingle(db, {
        'selector':{
            'type':badgeType,
            'uid':uid
        }
    }, badgeModel, badgeNotExistCode, callback);
}

module.exports = {
    getById:getById,
    getByUid: getByUid
};
logger.wrapFunctions(module.exports,'BadgeService');

