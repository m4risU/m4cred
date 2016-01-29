/*
 * Copyright (C) 2015 TopCoder Inc., All Rights Reserved.
 */
/**
 * This module will create test data used in thia application.
 *
 * Version 1.1
 *     - Changed intranet ID to match given test credentials
 *     - Added photo property to mocked user
 *     - Changed badge image to match mock badge images
 *
 * @version 1.1
 * @author TCDEVELOPER
 */
process.env.NODE_ENV = 'development';
var _ = require('underscore');
var fs = require('fs');
var ms = require('ms');
var async = require('async');
var config = require('config');
var jwt = require('jsonwebtoken');
var logger = require('../helpers/logger');
var cloudant = require('../CloudantUtil').getCloudant();
var database = config.DATABASE;
var modeTypes = config.MODEL_TYPES;
var jwtSecret = config.JWT_OPTIONS.secretOrKey;
var jwtOptions = _.omit(config.JWT_OPTIONS, 'secretOrKey');

/**
 * Create database
 * @param callback the callback function.
 */
var reCreateDatabase = function (callback) {
    cloudant.db.destroy(database, function () {
        cloudant.db.create(database, function (err) {
            callback(err);
        });
    });
};
var generateId = config.GENERATE_ID;
var userTotal = config.USER_TOTAL;
var badgeTotal = config.BADGE_TOTAL;
var badgeAssertions;
var users;
var badges;
var badgeComments;
var badgeFavors;
var badgeLikes;
/**
 * Create user
 * @param callback the callback function.
 */
var createUser = function (callback) {
    var type = modeTypes.User;
    var db = cloudant.use(database);
    var docs = [];
    for (var i = 1; i <= userTotal; i++) {
        var doc = {
            type: type,
            intranetID: 'userTest' + i,
            name: i > 5 ? 'name' + i : 'user name' + i,
            photo: 'userTest' + i + '.jpg'
        };
        if (generateId) {
            doc._id = 'user' + i;
        }
        docs.push(doc);
    }
    async.waterfall([function (cb) {
        db.bulk({docs: docs}, function (err, data) {
            cb(err, data);
        });
    }, function (savedDocs, cb) {
        //sign saved doc and get JWT token.
        var newDocs = [];
        users = [];
        _.each(savedDocs, function (savedDoc, index) {
            var fullDoc = _.extend(docs[index], savedDoc);
            delete fullDoc._id;
            var token = jwt.sign(_.clone(fullDoc), jwtSecret, jwtOptions);
            fullDoc.token = token;
            var decoded = jwt.verify(token, jwtSecret, jwtOptions);
            fullDoc.tokeExpiresAt = decoded.exp * 1000;
            users.push(_.clone(fullDoc));
            //update with exist document
            fullDoc._id = fullDoc.id;
            fullDoc._rev = fullDoc.rev;
            delete fullDoc.id;
            delete fullDoc.rev;
            newDocs.push(fullDoc);
        });
        db.bulk({docs: newDocs}, function (err, data) {
            cb(err, data);
        });
    }], function (err) {
        callback(err);
    });
};

/**
 * Create badge
 * @param callback the callback function.
 */
var createBadge = function (callback) {
    var type = modeTypes.Badge;
    var db = cloudant.use(database);
    var docs = [];
    for (var i = 1; i <= badgeTotal; i++) {
        var doc = {
            type: type,
            origin: (i % 2 + 1),//1 for Mozilla Backpack, 2 for Pearson Acclaim
            uid: 'uid' + i,
            name: i > 5 ? 'name' + i : 'badge name' + i,
            description: 'desc ' + i,
            image: 'badgeImage' + i + '.png',
            criteria: 'criteria' + i,
            criteriaContent: 'criteriaContent' + i,
            issuer: 'issuer' + i,
            issuerName: 'issuerName' + i,
            tags: ['tag' + i, 'tag' + (i - 1), 'tag' + (i + 1)],
            skills: i % 2 === 0 ? ['cloud'] : ['social']
        };
        if (generateId) {
            doc._id = 'badge' + i;
        }
        docs.push(doc);
    }
    db.bulk({docs: docs}, function (err, data) {
        if (!err) {
            badges = data;
        }
        callback(err);
    });
};

/**
 * Create badge assertion
 * @param callback the callback function.
 */
var createBadgeAssertion = function (callback) {
    var type = modeTypes.BadgeAssertion;
    var db = cloudant.use(database);
    var docs = [];
    for (var i = 0; i < userTotal; i++) {
        for (var j = 0; j < badgeTotal; j++) {
            var index = i * badgeTotal + j;
            var doc = {
                type: type,
                userId: users[i].id,
                badgeId: badges[j].id,
                published: index % 3 === 0,
                issuedOn: new Date().valueOf() - (i + j) * ms('1d'),
                like: index % 2 === 0 ? userTotal - 1 : 0,
                expires: new Date().valueOf() + (i + j) * ms('100 days'),
                createdOn: new Date().valueOf()
            };
            if (generateId) {
                doc._id = 'badgeAssertion' + index;
            }
            docs.push(doc);
        }
    }
    //force expire
    docs[docs.length - 1].expires = new Date().valueOf() - ms('30 days');
    db.bulk({docs: docs}, function (err, data) {
        if (!err) {
            badgeAssertions = data;
        }
        callback(err);
    });
};

/**
 * Create badge comment
 * @param callback the callback function.
 */
var createBadgeComment = function (callback) {
    var type = modeTypes.BadgeComment;
    var db = cloudant.use(database);
    var docs = [];
    for (var i = 0; i < userTotal; i++) {
        for (var j = 0; j < badgeAssertions.length; j++) {
            var doc = {
                type: type,
                userId: users[i].id,
                assertionId: badgeAssertions[j].id,
                time: new Date().valueOf() - (i + j) * (j < 5 ? ms('1h') : ms('1d')),
                comment: 'comment by user ' + (i + 1) + ' for badge assertion ' + (j + 1)
            };
            if (generateId) {
                doc._id = 'badgeComment' + (i * badgeAssertions.length + j);
            }
            docs.push(doc);
        }
    }
    db.bulk({docs: docs}, function (err, data) {
        if (!err) {
            badgeComments = data;
        }
        callback(err);
    });
};

/**
 * Create badge favor
 * @param callback the callback function.
 */
var createBadgeFavor = function (callback) {
    var type = modeTypes.BadgeFavor;
    var db = cloudant.use(database);
    var docs = [];
    for (var i = 0; i < userTotal; i++) {
        for (var j = 0; j < badgeTotal; j += 2) {
            var doc = {
                type: type,
                userId: users[i].id,
                badgeId: badges[j].id,
                time: new Date().valueOf() - (i + j) * ms('1d')
            };
            if (generateId) {
                doc._id = 'badgeFavor' + (i * badgeTotal / 2 + j);
            }
            docs.push(doc);
        }
    }
    db.bulk({docs: docs}, function (err, data) {
        if (!err) {
            badgeFavors = data;
        }
        callback(err);
    });
};

/**
 * Create badge like
 * @param callback the callback function.
 */
var createBadgeLike = function (callback) {
    var type = modeTypes.BadgeLike;
    var db = cloudant.use(database);
    var docs = [];
    for (var i = 0; i < userTotal; i++) {
        for (var j = 0; j < badgeAssertions.length; j += 2) {
            //can not perform action on self created badge assertion
            if (j >= i * badgeTotal && j < i * badgeTotal + badgeTotal) {
                continue;
            }
            var doc = {
                type: type,
                userId: users[i].id,
                assertionId: badgeAssertions[j].id,
                time: new Date().valueOf() - (i + j) * ms('1d')
            };
            if (generateId) {
                doc._id = 'badgeLike' + (i * badgeAssertions.length + j);
            }
            docs.push(doc);
        }
    }
    db.bulk({docs: docs}, function (err, data) {
        if (!err) {
            badgeLikes = data;
        }
        callback(err);
    });
};
async.waterfall([function (cb) {
    reCreateDatabase(cb);
}, function (cb) {
    logger.debug('Succeed to recreate database ' + database);
    logger.debug('Start to create user');
    createUser(cb);
}, function (cb) {
    logger.debug('Succeed to create user with total ' + users.length);
    logger.debug('Start to create badge');
    createBadge(cb);
}, function (cb) {
    logger.debug('Succeed to create badge with total ' + badges.length);
    logger.debug('Start to create badge assertion');
    createBadgeAssertion(cb);
}, function (cb) {
    logger.debug('Succeed to create assertion with total ' + badgeAssertions.length);
    logger.debug('Start to create badge comment');
    createBadgeComment(cb);
}, function (cb) {
    logger.debug('Succeed to create comment with total ' + badgeComments.length);
    logger.debug('Start to create badge favor');
    createBadgeFavor(cb);
}, function (cb) {
    logger.debug('Succeed to create favor with total ' + badgeFavors.length);
    logger.debug('Start to create badge like');
    createBadgeLike(cb);
}], function (err) {
    if (err) {
        logger.error(err);
    } else {
        logger.debug('Succeed to create like with total ' + badgeLikes.length);
        logger.info('Create test data successfully!');
        fs.writeFile('user.json', JSON.stringify(users, null, 3));
    }
});
