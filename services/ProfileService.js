/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * This service provides method to manage user profile.
 *
 * Version 1.1
 *     - Added getFullUserByIntranetID Method
 *     - Added shareAppMail method
 *     - Edited feedback message is retrieved from req.query
 *     - Added expires property for getBadges
 *     - Added intranetID in getTestimonials
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var fs = require('fs');
var ejs = require('ejs');
var readFileSync = fs.readFileSync;
var join = require('path').join;
var appinfoTemplate = readFileSync(join(__dirname, '../template/appinfoTemplate.ejs'), 'utf8');
var _ = require('underscore');
var async = require('async');
var config = require('config');
var path = require('path');
var mail  = require('../helpers/mail');
var logger = require('../helpers/logger');
var validate = require('../helpers/validator').validate;
var cloudantHelper = require('../helpers/cloudantHelper');
var db = require('../CloudantUtil').getCloudantDatabase(config.DATABASE);
var badgeAssertionDesignName = config.BADGEASSERTION_DESIGN_NAME;
var badgeAssertionIndexName = config.BADGEASSERTION_INDEX_NAME;
var modeTypes = config.MODEL_TYPES;
var userType = modeTypes.User;
var badgeAssertionType = modeTypes.BadgeAssertion;
var badgeCommentType = modeTypes.BadgeComment;
var badgeFavorType = modeTypes.BadgeFavor;
var feedbackType = modeTypes.Feedback;
var bluePagesService = require('./BluePagesService');

var userModel = config.USER_MODEL;
var userNotExistCode = config.USER_NOT_EXIST_CODE;
var badgeModel = config.BADGE_MODEL;
var badgeNotExistCode = config.BADGE_NOT_EXIST_CODE;
var badgeAssertionModel = config.BADGE_ASSERTION_MODEL;
var badgeAssertionNotExistCode = config.BADGE_ASSERTION_NOT_EXIST_CODE;
var BadRequestError = require('../helpers/errors').BadRequestError;

/**
 * Find user with match intranetID.
 * @param {String} intranetID the intranetID
 * @param {Function} callback the callback function
 */
function getByIntranetID(intranetID, callback) {
    var error = validate({
        'intranetID': intranetID,
        'callback': callback
    }, {
        'intranetID': 'String',
        'callback': 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findSingle(db, {
        'selector': {
            'type': userType,
            'intranetID': intranetID
        },
        fields:['_id','intranetID']
    }, userModel, userNotExistCode, callback);
}

/**
 * Retrive full user with match intranetID.
 * @param {String} intranetID the intranetID
 * @param {Function} callback the callback function
 */
function getFullUserByIntranetID(intranetID, callback) {
    var error = validate({
        'intranetID': intranetID,
        'callback': callback
    }, {
        'intranetID': 'String',
        'callback': 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findSingle(db, {
        'selector': {
            'type': userType,
            'intranetID': intranetID
        },
        fields:['_id','intranetID','_rev','name','token','type','tokeExpiresAt','photo']
    }, userModel, userNotExistCode, callback);
}

/**
 * Find user detail with match intranetID.
 * @param {String} intranetID the intranetID
 * @param {Object} user the user
 * @param {Function} callback the callback function
 */
function getDetail(intranetID, user, callback) {
    var error = validate({
        'intranetID': intranetID,
        'user': user,
        'callback': callback
    }, {
        'intranetID': 'String',
        'user': 'UserValidator',
        'callback': 'Function'
    });
    if (error) {
        return callback(error);
    }
    async.auto({
        profile: function (ck) {
            bluePagesService.queryProfile(intranetID, ck);
        },
        badgeNum: function (ck) {
            cloudantHelper.getBadgeNum(db, user.id, ck);
        }
    }, callback.wrap(function (results) {
        var profile = results.profile;
        callback(null, {
            name: profile.name,
            photo: profile.photo,
            badgeNum: results.badgeNum,
            jobName: profile.jobName,
            locName: profile.jobLocation
        });
    }));
}

/**
 * Get testimonials for user
 * @param {Object} user the user
 * @param {Object} query the query
 * @param {Function} callback the callback function.
 */
function getTestimonials(user, query, callback) {
    var error = validate({
        user: user,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        query: 'PageWithOrderValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var userId = user.id;
    cloudantHelper.find(db, {
        'selector': {
            'userId': userId,
            'type': badgeAssertionType
        }, 'fields': ['badgeId', '_id']
    }, callback.wrap(function (badgeAssertions) {
        var assertionIds = _.pluck(badgeAssertions, 'id');
        var badgeAssertionMap = _.indexBy(badgeAssertions, 'id');
        var params = cloudantHelper.getPagingSelector(query, {
            'selector': {
                'type': badgeCommentType,
                'userId': {
                    '$ne': userId
                },
                'assertionId': {
                    '$in': assertionIds
                }
            },
            'sort': [
                {
                    'time:number': query.order
                }
            ]
        });
        cloudantHelper.find(db, params, callback.wrap(function (docs) {
            if (docs.length === 0) {
                return callback(null, docs);
            }
            var userIds = _.uniq(_.pluck(docs, 'userId'));
            var foundAssertionIds = _.pluck(docs, 'assertionId');
            var foundBadgeIds = _.uniq(_.pluck(_.filter(badgeAssertions, function (item) {
                return _.contains(foundAssertionIds, item.id);
            }), 'badgeId'));
            async.auto({
                users: function (ck) {
                    cloudantHelper.getUsersDetail(db, userIds, ck);
                },
                badges: function (ck) {
                    async.map(foundBadgeIds, function (badgeId, cb) {
                        cloudantHelper.get(db, badgeId, badgeModel, badgeNotExistCode, true, cb);
                    }, ck);
                }
            }, callback.wrap(function (results) {
                var assertionUsers = _.indexBy(results.users, 'userId');
                var assertionBadges = _.indexBy(results.badges, 'id');
                var result = [];
                _.each(docs, function (doc) {
                    result.push({
                        assertionId: doc.assertionId,
                        image: assertionBadges[badgeAssertionMap[doc.assertionId].badgeId].image,
                        comment: {
                            id: doc.id,
                            photo: assertionUsers[doc.userId].photo,
                            name: assertionUsers[doc.userId].name,
                            content: doc.comment,
                            time: doc.time,
                            userId: doc.userId,
                            intranetID: assertionUsers[doc.userId].intranetID
                        }
                    });
                });
                callback(null, {
                    'pageNum': Number(query.pageNum),
                    'pageSize': Number(query.pageSize),
                    'comments': result
                });
            }));
        }));
    }));
}

/**
 * Get comments for user
 * @param {Object} user the user
 * @param {Object} query the query
 * @param {Function} callback the callback function.
 */
function getComments(user, query, callback) {
    var error = validate({
        user: user,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        query: 'PageValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var userId = user.id;
    cloudantHelper.find(db, {
        'selector': {
            'userId': userId,
            'type': badgeAssertionType
        }, 'fields': ['badgeId', '_id']
    }, callback.wrap(function (badgeAssertions) {
        var assertionIds = _.pluck(badgeAssertions, 'id');
        var params = cloudantHelper.getPagingSelector(query, {
            'selector': {
                'type': badgeCommentType,
                'userId': userId,
                'assertionId': {
                    '$not': {
                        '$in': assertionIds
                    }
                }
            }
        });
        cloudantHelper.find(db, params, callback.wrap(function (docs) {
            if (docs.length === 0) {
                return callback(null, docs);
            }
            var userIds = _.uniq(_.pluck(docs, 'userId'));
            var foundAssertionIds = _.uniq(_.pluck(docs, 'assertionId'));
            var foundBadgeIds = _.uniq(_.pluck(_.filter(badgeAssertions, function (item) {
                return _.contains(foundAssertionIds, item.id);
            }), 'badgeId'));
            async.auto({
                users: function (ck) {
                    cloudantHelper.getUsersDetail(db, userIds, ck);
                },
                assertions: function (ck) {
                    async.map(foundAssertionIds, function (assertId, cb) {
                        cloudantHelper.get(db, assertId, badgeAssertionModel, badgeAssertionNotExistCode, true, cb);
                    }, ck);
                },
                badges: ['assertions', function (ck, results) {
                    async.map(results.assertions, function (assertion, cb) {
                        cloudantHelper.get(db, assertion.badgeId, badgeModel, badgeNotExistCode, true, cb);
                    }, ck);
                }]
            }, callback.wrap(function (results) {
                var assertionUsers = _.indexBy(results.users, 'userId');
                var assertionBadges = _.indexBy(results.badges, 'id');
                var assertions = _.indexBy(results.assertions, 'id');
                var result = [];
                _.each(docs, function (doc) {
                    var assertion = assertions[doc.assertionId];
                    var badgeId = assertion.badgeId;
                    result.push(_.extend(_.pick(assertionBadges[badgeId], 'name', 'image', 'origin'), {
                        assertionId: doc.assertionId,
                        badgeId: badgeId,
                        issuedOn: assertion.issuedOn,
                        comment: {
                            id: doc.id,
                            photo: assertionUsers[doc.userId].photo,
                            name: assertionUsers[doc.userId].name,
                            content: doc.comment,
                            time: doc.time
                        }
                    }));
                });
                callback(null, {
                    'pageNum': Number(query.pageNum),
                    'pageSize': Number(query.pageSize),
                    'comments': result
                });
            }));
        }));
    }));
}

/**
 * Get badges for user
 * @param {Object} user the user
 * @param {Object} profile the profile
 * @param {Object} query the query
 * @param {Function} callback the callback function.
 */
function getBadges(user,profile, query, callback) {
    var error = validate({
        user: user,
        profile:profile,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        profile: 'UserValidator',
        query: 'PageValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var profileId = profile.id;
    var userId = user.id;
    var searchParams = {
        'type': badgeAssertionType,
        'userId': profileId
    };
    if (userId !== profileId) {
        searchParams.published = true;
    }
    var params = cloudantHelper.getPagingSelector(query, {
        'selector': searchParams, 'fields': ['badgeId', '_id', 'issuedOn', 'expires']
    });
    cloudantHelper.find(db, params, callback.wrap(function (badgeAssertions) {
        async.map(badgeAssertions, function (badgeAssertion, cb) {
            var badgeId = badgeAssertion.badgeId;
            var assertionId = badgeAssertion.id;
            async.auto({
                badge: function (ck) {
                    cloudantHelper.get(db, badgeId, badgeModel, badgeNotExistCode, true, ck);
                },
                details: function (ck) {
                    cloudantHelper.getBadgeAssertionDetail(db, profileId, assertionId, null, true, true, false, true, ck);
                }
            }, cb.wrap(function (results) {
                cb(null, _.extend(_.pick(results.badge, ['name', 'origin', 'image']), {
                    assertionId: assertionId,
                    badgeId: badgeId,
                    issuedOn: badgeAssertion.issuedOn,
                    expires: badgeAssertion.expires,
                    likeNum: results.details.likeNum,
                    commentNum: results.details.commentNum
                }));
            }));
        }, callback.wrap(function (badges) {
            callback(null, {
                'pageNum': Number(query.pageNum),
                'pageSize': Number(query.pageSize),
                'badges': badges
            });
        }));
    }));
}

/**
 * Get favorite badges for user
 * @param {Object} user the user
 * @param {Object} query the query
 * @param {Function} callback the callback function.
 */
function getFavoriteBadges(user, query, callback) {
    var error = validate({
        user: user,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        query: 'PageValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var userId = user.id;
    var params = cloudantHelper.getPagingSelector(query, {
        'selector': {
            'userId': userId,
            'type': badgeFavorType
        }
    });
    cloudantHelper.find(db, params, callback.wrap(function (badgeFavors) {
        async.map(badgeFavors, function (badgeFavor, cb) {
            var badgeId = badgeFavor.badgeId;
            async.auto({
                badge: function (ck) {
                    cloudantHelper.get(db, badgeId, badgeModel, badgeNotExistCode, true, ck);
                },
                details: function (ck) {
                    cloudantHelper.getBadgeAssertionDetail(db, userId, null, badgeId, false, false, true, false, ck);
                }
            }, cb.wrap(function (results) {
                cb(null, _.extend(_.pick(results.badge, ['name', 'origin', 'image']), {
                    badgeId: badgeId,
                    time: badgeFavor.time,
                    favoriteNum: results.details.favoriteNum,
                    earnerNum: results.details.earnerNum
                }));
            }));
        }, callback.wrap(function (badges) {
            callback(null, {
                'pageNum': Number(query.pageNum),
                'pageSize': Number(query.pageSize),
                'badges': badges
            });
        }));
    }));
}

/**
 * Get notifications for user
 * @param {Object} user the user
 * @param {Object} query the query
 * @param {Function} callback the callback function.
 */
function getNotifications(user, query, callback) {
    var error = validate({
        user: user,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        query: 'PageValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var userId = user.id;
    cloudantHelper.find(db, {
        'selector': {
            'userId': userId,
            'type': badgeAssertionType
        }, 'fields': ['badgeId', '_id', 'issuedOn']
    }, callback.wrap(function (badgeAssertions) {
        var assertionIds = _.pluck(badgeAssertions, 'id');
        var assertionBadgeMap = _.indexBy(badgeAssertions, 'id');
        var userId = user.id;
        var criteria = [];
        criteria.push('(userId:' + userId + ' AND  ' + 'type:' + badgeAssertionType + ')');
        criteria.push('(NOT(userId:' + userId + ') AND  assertionId:(' + assertionIds.join(' OR ') + ') AND type:' + badgeCommentType + ')');
        db.search(badgeAssertionDesignName, badgeAssertionIndexName,
            cloudantHelper.getPagingSelector(query, {
                q: criteria.join(' OR '),
                sort: ['-time', '-issuedOn']
            }), callback.wrap(function (result) {
                async.map(result.rows, function (row, cb) {
                    var fields = row.fields;
                    async.auto({
                        badge: function (ck) {
                            var badgeId;
                            if (fields.type === badgeAssertionType) {
                                badgeId = fields.badgeId;
                            } else {
                                badgeId = assertionBadgeMap[fields.assertionId].badgeId;
                            }
                            cloudantHelper.get(db, badgeId, badgeModel, badgeNotExistCode, true, ck);
                        },
                        userDetail: function (ck) {
                            if (fields.type !== badgeCommentType) {
                                return ck(null);
                            }
                            cloudantHelper.getUsersDetail(db, [fields.userId], ck.wrap(function (details) {
                                ck(null, details[0]);
                            }));
                        }
                    }, cb.wrap(function (results) {
                        var notification = _.extend({
                            badgeId: results.badge.id
                        }, _.pick(results.badge, ['name', 'origin', 'image']));
                        if (fields.type === badgeAssertionType) {
                            cb(null, _.extend(notification, {
                                assertionId: row.id,
                                issuedOn: fields.issuedOn
                            }));
                        } else {
                            cb(null, _.extend(notification, {
                                assertionId: fields.assertionId,
                                issuedOn: assertionBadgeMap[fields.assertionId].issuedOn,
                                intranetID: results.userDetail.intranetID,
                                username: results.userDetail.name,
                                time: fields.time
                            }));
                        }
                    }));
                }, callback.wrap(function (notifications) {
                    callback(null, {
                        'pageNum': Number(query.pageNum),
                        'pageSize': Number(query.pageSize),
                        'notifications': notifications
                    });
                }));
            }));
    }));
}

/**
 * Send feedback
 * @param {Object} req the request
 * @param {Function} callback the callback function.
 */
function feedback(req, callback) {
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
    if (!_.isUndefined(req.files) && !_.isArray(req.files)) {
        return callback(new BadRequestError('Files must be array if exist!'));
    }

    var content = ejs.compile(appinfoTemplate)({
        body: req.query,
        user: req.user
    });
    var comment = {
        type: feedbackType,
        message: req.query.message,
        appinfo: content
    };
    if (!_.isUndefined(req.files)) {
        //store meta data of files
        comment.screenshots = [];
        _.each(req.files, function (file) {
            comment.screenshots.push(_.pick(file, 'filename', 'originalname', 'size', 'mimetype'));
        });
    }
    async.waterfall([function (cb) {
        db.insert(comment, cb.wrap(function (doc) {
            cb(null, doc);
        }));
    }, function (doc, cb) {
        if (_.isUndefined(req.files)) {
            return cb(null);
        }
        async.eachSeries(req.files, function (file, ck) {
            //use filename to avoid same name issue
            fs.createReadStream(file.path).pipe(db.attachment.insert(doc.id, file.filename, null, file.mimetype, {rev: doc.rev}, ck.wrap(function (uploadedDoc) {
                doc = uploadedDoc;
                ck(null);
            })));
        }, cb);
    }], callback.errorOnly());
}

/**
 * Share app mail
 * @param  {Object}   user     user
 * @param  {Object}   mail     {email:..., message:...}
 * @param  {Function} callback
 * @since  1.1
 */
function appShareMail(user, mail, callback) {
    var error = validate({
        user: user,
        mail: mail,
        callback: callback
    }, {
        user: 'UserValidator',
        mail: {'email': 'Email', 'message': 'String'},
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }

    var locals = {
        email: mail.email,
        message: mail.message,
        userName: user.name
    };

    mail.sendMail(locals, 'share-app', callback.errorOnly());
}

module.exports = {
    getByIntranetID: getByIntranetID,
    getFullUserByIntranetID: getFullUserByIntranetID,
    getDetail: getDetail,
    getTestimonials: getTestimonials,
    getComments: getComments,
    getBadges: getBadges,
    getFavoriteBadges: getFavoriteBadges,
    getNotifications: getNotifications,
    feedback: feedback,
    appShareMail: appShareMail
};
logger.wrapFunctions(module.exports, 'ProfileService');
