/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * This service provides methods for managing .
 *
 * Version 1.1
 *     - Added : Return if user liked badge or not in getStream and getBadgeDetail
 *     - Added : Support for unlike badge
 *     - Added : Return published state on stream request
 *     - Added : Return the userId associated with comments
 *     - Edited : Search function use 'like' selector
 *     - Added : shareBadgeMail method
 *     - Added : Return badge assertion user id and image in getDetail
 *     - Added : Return intranetId in getEarners
 *     - Edited : Multiple criteria support for search
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var _ = require('underscore');
var async = require('async');
var config = require('config');
var mail = require('../helpers/mail');
var logger = require('../helpers/logger');
var validate = require('../helpers/validator').validate;
var cloudantHelper = require('../helpers/cloudantHelper');
var db = require('../CloudantUtil').getCloudantDatabase(config.DATABASE);
var modeTypes = config.MODEL_TYPES;
var userType = modeTypes.User;
var badgeType = modeTypes.Badge;
var badgeAssertionType = modeTypes.BadgeAssertion;
var badgeLikeType = modeTypes.BadgeLike;
var badgeCommentType = modeTypes.BadgeComment;
var badgeFavorType = modeTypes.BadgeFavor;
var bluePagesService = require('./BluePagesService');
var badgeAssertionDesignName = config.BADGEASSERTION_DESIGN_NAME;
var badgeAssertionIndexName = config.BADGEASSERTION_INDEX_NAME;
var badgeModel = config.BADGE_MODEL;
var badgeNotExistCode = config.BADGE_NOT_EXIST_CODE;
var badgeAssertionModel = config.BADGE_ASSERTION_MODEL;
var badgeAssertionNotExistCode = config.BADGE_ASSERTION_NOT_EXIST_CODE;
var badgeCommentModel = config.BADGE_COMMENT_MODEL;
var badgeCommentNotExistCode = config.BADGE_COMMENT_NOT_EXIST_CODE;

/**
 * Get stream for user.
 * @param {Object}user the user.
 * @param {Object}query the query
 * @param {Function}callback the callback function
 */
function stream(user, query, callback) {
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
    var now = new Date().valueOf();
    var params = cloudantHelper.getPagingSelector(query, {
        'selector': {
            '$or': [{
                'type': badgeAssertionType,
                'userId': userId,
                'expires': {
                    '$gt': now
                }
            }, {
                'type': badgeAssertionType,
                'published': true,
                'expires': {
                    '$gt': now
                },
                'userId': {
                    '$ne': userId
                }
            }]
        },
        'sort': [
            {
                'issuedOn:number': 'desc'
            }
        ]
    });
    cloudantHelper.find(db, params, callback.wrap(function (docs) {
        if (!docs.length) {
            return callback(null, docs);
        }
        var users = {};
        var badges = {};
        var userIds = _.uniq(_.pluck(docs, 'userId'));
        var badgeIds = _.uniq(_.pluck(docs, 'badgeId'));
        async.parallel([
            function (cb) {
                cloudantHelper.getUsersDetail(db, userIds, cb.wrap(function (foundUsers) {
                    users = _.indexBy(foundUsers, 'id');
                    cb(null);
                }));
            },
            function (cb) {
                async.each(badgeIds, function (badgeId, cp) {
                    cloudantHelper.get(db, badgeId, badgeModel, badgeNotExistCode, true, cp.wrap(function (foundBadge) {
                        badges[badgeId] = _.extend({
                            'badgeId': badgeId
                        }, _.pick(foundBadge, ['name', 'origin', 'image']));
                        cp(null);
                    }));
                }, cb);
            }
        ], callback.wrap(function () {
            async.map(docs, function (doc, cb) {
                cloudantHelper.getBadgeAssertionDetail(db, userId, doc.id, doc.badgeId, true, true, true, true, callback.wrap(function (results) {
                    cb(null, {
                        user: _.pick(users[doc.userId], ['userId', 'photo', 'name', 'intranetID']),
                        badge: _.extend({
                            'assertionId': doc.id,
                            'issuedOn': doc.issuedOn,
                            'likeNum': results.likeNum,
                            'commentNum': results.commentNum,
                            'favorite': results.favorite,
                            'liked': results.liked,
                            'published': doc.published
                        }, badges[doc.badgeId])
                    });
                }));
            }, callback.wrap(function (result) {
                callback(null, {
                    'pageNum': Number(query.pageNum),
                    'pageSize': Number(query.pageSize),
                    'badges': result
                });
            }));
        }));
    }));
}

/**
 * Get details of badge assertion.
 * @param {Object}req the request.
 * @param {Function}callback the callback function
 */
function getDetail(req, callback) {
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
    var badgeAssertion = req.badgeAssertion;
    var badgeId = badgeAssertion.badgeId;
    cloudantHelper.get(db, badgeId, badgeModel, badgeNotExistCode, true, callback.wrap(function (badge) {
        var userId = req.user.id;
        var id = req.params.id;
        cloudantHelper.getBadgeAssertionDetail(db, userId, id, badgeId, true, true, true, true, callback.wrap(function (results) {
            callback(null,
                _.extend({
                    'assertionId': id,
                    'issuedOn': badgeAssertion.issuedOn,
                    'likeNum': results.likeNum,
                    'commentNum': results.commentNum,
                    'liked': results.liked,
                    'earnerNum': results.earnerNum,
                    'favorite': results.favorite,
                    'published': badgeAssertion.published,
                    'userId': badgeAssertion.userId,
                    'expires': badgeAssertion.expires
                }, _.pick(badge, ['name', 'origin', 'criteria', 'contentCriteria', 'image', 'id'])));
        }));
    }));
}

/**
 * Get earners for badge assertion.
 * @param {Object}user the user.
 * @param {String}id the id.
 * @param {Object}query the query
 * @param {Function}callback the callback function
 */
function getEarners(user, id, query, callback) {
    var error = validate({
        user: user,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        query: {order: 'order'},
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var userId = user.id;
    var now = new Date().valueOf();
    var params = {
        'selector': {
            '$or': [{
                'type': badgeAssertionType,
                'badgeId': id,
                'userId': userId,
                'expires': {
                    '$gt': now
                }
            }, {
                'type': badgeAssertionType,
                'badgeId': id,
                'published': true,
                'userId': {
                    '$ne': userId
                },
                'expires': {
                    '$gt': now
                }
            }]
        },
        'sort': [
            {
                'issuedOn:number': query.order
            }
        ]
    };
    cloudantHelper.find(db, params, callback.wrap(function (docs) {
        var userIds = _.uniq(_.pluck(docs, 'userId'));
        cloudantHelper.getUsersDetail(db, userIds, callback.wrap(function (foundUsers) {
            async.map(userIds, function (id, cb) {
                cloudantHelper.getBadgeNum(db, id, cb);
            }, callback.wrap(function (results) {
                var result = [];
                _.each(userIds, function (foundId, index) {
                    result.push(_.extend(_.pick(foundUsers[index], ['name', 'photo', 'intranetID']), {
                        badgeNum: results[index]
                    }));
                });
                callback(null, result);
            }));
        }));
    }));
}

/**
 * Get comments.
 * @param {Object}id the id.
 * @param {Object}query the query
 * @param {Function}callback the callback function
 */
function getComments(id, query, callback) {
    var error = validate({
        id: id,
        query: query,
        callback: callback
    }, {
        id: 'String',
        query: 'PageWithOrderValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var params = cloudantHelper.getPagingSelector(query, {
        'selector': {
            'type': badgeCommentType,
            'assertionId': id
        },
        'sort': [
            {
                'time:number': query.order
            }
        ]
    });
    cloudantHelper.find(db, params, callback.wrap(function (docs) {
        if (!docs.length) {
            return callback(null, docs);
        }
        var userIds = _.uniq(_.pluck(docs, 'userId'));
        cloudantHelper.getUsersDetail(db, userIds, callback.wrap(function (foundUsers) {
            var users = _.indexBy(foundUsers, 'id');
            var result = [];
            _.each(docs, function (doc) {
                result.push(_.extend(_.pick(users[doc.userId], ['name', 'photo']), {
                    id: doc.id,
                    content: doc.comment,
                    time: doc.time,
                    userId: doc.userId
                }));
            });
            callback(null, {
                'pageNum': Number(query.pageNum),
                'pageSize': Number(query.pageSize),
                'comments': result
            });
        }));
    }));
}

/**
 * Send comment.
 * @param {Object}user the user.
 * @param {String}id the id
 * @param {Object}doc the doc with comment content
 * @param {Function}callback the callback function
 */
function comment(user, id, doc, callback) {
    var error = validate({
        user: user,
        id: id,
        doc: doc,
        callback: callback
    }, {
        user: 'UserValidator',
        id: 'String',
        doc: {'content': 'String'},
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    doc.comment = doc.content;
    delete doc.content;
    doc.type = badgeCommentType;
    doc.time = new Date().valueOf();
    doc.assertionId = id;
    doc.userId = user.id;
    cloudantHelper.insert(db, doc, callback);
}

/**
 * Delete comment.
 * @param {Object}id the id.
 * @param {Function}callback the callback function
 */
function deleteComment(id, callback) {
    var error = validate({
        id: id,
        callback: callback
    }, {
        id: 'String',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.delete(db, id, badgeCommentModel, badgeCommentNotExistCode, callback);
}

/**
 * Favor for badge.
 * @param {Object}user the user.
 * @param {String}id the id
 * @param {Function}callback the callback function
 */
function favor(user, id, callback) {
    var error = validate({
        user: user,
        id: id,
        callback: callback
    }, {
        user: 'UserValidator',
        id: 'String',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findAndInsert(db, {
        type: badgeFavorType,
        userId: user.id,
        badgeId: id,
        time: new Date().valueOf()
    }, {
        selector: {
            type: badgeFavorType,
            userId: user.id,
            badgeId: id
        }
    }, callback.errorOnly());
}

/**
 * Unfavor for badge.
 * @param {Object}user the user.
 * @param {String}id the id
 * @param {Function}callback the callback function
 */
function unfavor(user, id, callback) {
    var error = validate({
        user: user,
        id: id,
        callback: callback
    }, {
        user: 'UserValidator',
        id: 'String',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findAndDelete(db, {
        selector: {
            type: badgeFavorType,
            userId: user.id,
            badgeId: id
        }
    }, callback.errorOnly());
}

/**
 * Like for badge assertion.
 * @param {Object}badgeAssertion the badge assertion.
 * @param {Object}user the user.
 * @param {String}id the id
 * @param {Function}callback the callback function
 */
function like(badgeAssertion, user, id, callback) {
    var error = validate({
        badgeAssertion: badgeAssertion,
        user: user,
        id: id,
        callback: callback
    }, {
        badgeAssertion: 'AnyObject',
        user: 'UserValidator',
        id: 'String',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findAndInsert(db, {
        type: badgeLikeType,
        userId: user.id,
        assertionId: id,
        time: new Date().valueOf()
    }, {
        selector: {
            type: badgeLikeType,
            userId: user.id,
            assertionId: id
        }
    }, callback.wrap(function (found) {
        if (found) {
            logger.debug('Found badge like for user %s and assertionId %s.', user.id, id, {});
            return callback(null);
        }
        logger.debug('Create badge like for user %s and assertionId %s.', user.id, id, {});
        badgeAssertion.like = badgeAssertion.like + 1;
        cloudantHelper.insert(db, badgeAssertion, callback.errorOnly());
    }));
}

/**
 * UnLike for badge assertion.
 * @param {Object}badgeAssertion the badge assertion.
 * @param {Object}user the user.
 * @param {String}id the id
 * @param {Function}callback the callback function
 */
function unlike(badgeAssertion, user, id, callback) {
    var error = validate({
        badgeAssertion: badgeAssertion,
        user: user,
        id: id,
        callback: callback
    }, {
        badgeAssertion: 'AnyObject',
        user: 'UserValidator',
        id: 'String',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.findAndDelete(db, {
        selector: {
            type: badgeLikeType,
            userId: user.id,
            assertionId: id
        }
    }, callback.wrap(function (found) {
        if (found) {
            logger.debug('Deleted badge like for user %s and assertionId %s.', user.id, id, {});
            badgeAssertion.like = badgeAssertion.like - 1;
            cloudantHelper.insert(db, badgeAssertion, callback.errorOnly());
        } else {
            return callback(null);
        }
    }));
}

/**
 * Publish for badge assertion.
 * @param {Object}req  the request.
 * @param {Function}callback the callback function
 */
function publish(req, callback) {
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
    var doc = req.badgeAssertion;
    if (doc.published) {
        callback(null);
    } else {
        doc.published = true;
        cloudantHelper.insert(db, doc, callback.errorOnly());
    }
}

/**
 * UnPublish for badge assertion.
 * @param {Object}req  the request.
 * @param {Function}callback the callback function
 */
function unpublish(req, callback) {
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
    var doc = req.badgeAssertion;
    if (!doc.published) {
        callback(null);
    } else {
        doc.published = false;
        cloudantHelper.insert(db, doc, callback.errorOnly());
    }
}

/**
 * Get badge assertion by id.
 * @param {String}id the id.
 * @param {Function}callback the callback function
 */
function getById(id, callback) {
    var error = validate({
        id: id,
        callback: callback
    }, {
        id: 'String',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    cloudantHelper.get(db, id, badgeAssertionModel, badgeAssertionNotExistCode, false, callback);
}

/**
 * Search badge or user with name criteria.
 * @param {Object}user the user.
 * @param {Object}query the query
 * @param {Object}body the body
 * @param {Function}callback the callback function
 */
function search(user, query, body, callback) {
    var error = validate({
        user: user,
        query: query,
        callback: callback
    }, {
        user: 'UserValidator',
        query: 'PageWithCriteriaValidator',
        callback: 'Function'
    });
    if (error) {
        return callback(error);
    }
    var userId = user.id;
    var name = query.criteria;
    var badgeSelector = {
        'type': badgeType,
        'name': {
            '$regex': '.*' + name + '.*'
        }
    };
    var selector =  {
        'selector': {
            '$or': []
        }
    };
    var excludedBadgeIds = [];

    if (body.searchUsers) {
        selector.selector.$or.push({
            'type': userType,
            'name': {
                '$regex': '.*' + name + '.*'
            }
        });
    }

    async.waterfall([
        function(callbackWaterfall) {
            if (body.excludeFavoriteBadges) {
                var badgeFavorTypeSelector = {
                    'selector': {
                        'userId': userId,
                        'type': badgeFavorType
                    }
                };
                cloudantHelper.find(db, badgeFavorTypeSelector, callback.wrap(function (badgeFavors) {
                    excludedBadgeIds.concat(_.pick(badgeFavors, 'badgeId'));
                    callbackWaterfall(null, true);
                }));
            } else {
                callbackWaterfall(null, false);
            }
        },
        function(excludeFavorite, callbackWaterfall) {
            if (body.excludeEarnedBadges) {
                var badgeEarnedTypeSelector = {
                    'selector': {
                        'userId': userId,
                        'type': badgeAssertionType
                    }
                };
                cloudantHelper.find(db, badgeEarnedTypeSelector, callback.wrap(function (badgesEarned) {
                    excludedBadgeIds.concat(_.pick(badgesEarned, 'badgeId'));
                    callbackWaterfall(null, true);
                }));
            } else {
                callbackWaterfall(null, false);
            }
        },
        function(arg1, callbackWaterfall) {
            if (excludedBadgeIds.length > 0) {
                badgeSelector['_id'] = {};
                badgeSelector['_id'].$nin = excludedBadgeIds;
            }
            if (body.skills) {
                badgeSelector['skills'] = {};
                badgeSelector['skills'].$in = body.skills;
            }
            selector.selector.$or.push(badgeSelector);
            var params = cloudantHelper.getPagingSelector(query, selector);
            cloudantHelper.find(db, params, callback.wrap(function (docs) {
                if (!docs.length) {
                    return callback(null, docs);
                }
                var users = [];
                var badges = [];
                async.each(docs, function (doc, cb) {
                    var id = doc.id;
                    var isBadgeType = doc.type === badgeType;
                    async.auto({
                        profile: function (ck) {
                            if (isBadgeType) {
                                return ck(null);
                            }
                            bluePagesService.queryProfile(doc.intranetID, ck);
                        },
                        earnerNum: function (ck) {
                            if (!isBadgeType) {
                                return ck(null);
                            }
                            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: 'badgeId:' + id + 'AND type:' + badgeAssertionType}, ck);
                        },
                        favorite: function (ck) {
                            if (isBadgeType) {
                                return ck(null);
                            }
                            cloudantHelper.count(db, badgeAssertionDesignName, badgeAssertionIndexName, {q: 'badgeId:' + id + ' AND userId:' + userId + ' AND type:' + badgeFavorType}, ck.wrap(function (count) {
                                ck(null, count > 0);
                            }));
                        },
                        badgeNum: function (ck) {
                            if (isBadgeType) {
                                return ck(null);
                            }
                            cloudantHelper.getBadgeNum(db, id, ck);
                        },
                        favoriteTime: function (ck) {
                            if (!isBadgeType) {
                                return ck(null);
                            }
                            cloudantHelper.find(db, {
                                'selector': {
                                    'type': badgeFavorType,
                                    'userId': userId,
                                    'badgeId': docs[0].id
                                }
                            }, ck.wrap(function (favors) {
                                if (!favors.length) {
                                    return ck(null);
                                }
                                ck(null, favors[0].time);
                            }));
                        }
                    }, cb.wrap(function (results) {
                        if (isBadgeType) {
                            badges.push(_.extend({
                                badgeId: id,
                                earnerNum: results.earnerNum,
                                favoriteTime: results.favoriteTime
                            }, _.pick(doc, 'name', 'origin', 'image')));
                        } else {
                            users.push(_.extend({
                                intranetID: doc.intranetID,
                                badgeNum: results.badgeNum
                            }, _.pick(results.profile, ['name', 'photo'])));
                        }
                        cb(null);
                    }));
                }, callback.wrap(function () {
                    callback(null, {
                        'pageNum': Number(query.pageNum),
                        'pageSize': Number(query.pageSize),
                        'users': users,
                        'badges': badges
                    });
                }));
            }));
        }
    ]);
}

/**
 * Get user badge.
 * @param {Object}req the request.
 * @param {Function}callback the callback function
 */
function getUserBadge(req, callback) {
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
    var profile = req.profile;
    var badge = req.badge;
    cloudantHelper.findSingle(db, {
        'selector': {
            'type': badgeAssertionType,
            'userId': profile.id,
            'badge': badge.id
        }
    }, badgeAssertionModel, badgeAssertionNotExistCode, callback.wrap(function (badgeAssertion) {
        callback(null, _.extend(_.pick(badgeAssertion, ['issuedOn', 'expires']),
         _.pick(badge, ['origin', 'uid', 'name', 'description', 'image', 'criteria', 'tags', 'issuer'])));
    }));
}

/**
 * Badge share by mail
 * @param  {Object}   user
 * @param  {Object}   mail     {email:..., message:...}
 * @param  {Function} callback
 * @since  1.1
 */
function badgeShareMail(user, mail, callback) {
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

    mail.sendMail(locals, 'share-badge', callback.errorOnly());
}

module.exports = {
    getById: getById,
    stream: stream,
    getDetail: getDetail,
    getEarners: getEarners,
    getComments: getComments,
    comment: comment,
    deleteComment: deleteComment,
    favor: favor,
    unfavor: unfavor,
    like: like,
    unlike: unlike,
    publish: publish,
    unpublish: unpublish,
    search: search,
    getUserBadge: getUserBadge,
    badgeShareMail: badgeShareMail
};
logger.wrapFunctions(module.exports, 'BadgeAssertionService');

