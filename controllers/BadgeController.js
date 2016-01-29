/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This controller exposes REST actions to manage Badge.
 *
 * Version 1.1
 *     - Added unlike route
 *     - Edited : Return comment object on add comment
 *     - Added badgeShareMail method
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var config = require('config');
var service = require('../services/BadgeAssertionService');
var helper = require('../helpers/helper');

module.exports = {
    stream:helper.respondWithData(service, 'stream',['user','query']),
    getDetail:helper.respondWithData(service, 'getDetail',['*']),
    getEarners:helper.respondWithData(service, 'getEarners',['user','params.id','query']),
    getComments:helper.respondWithData(service, 'getComments',['params.id','query']),
    comment: helper.respondWithData(service, 'comment',['user','params.id','body']),
    deleteComment: helper.respondWithOKStatus(service, 'deleteComment',['params.id']),
    favor:helper.respondWithOKStatus(service, 'favor',['user','params.id']),
    unfavor:helper.respondWithOKStatus(service, 'unfavor',['user','params.id']),
    like: helper.respondWithOKStatus(service, 'like',['badgeAssertion','user','params.id']),
    unlike: helper.respondWithOKStatus(service, 'unlike',['badgeAssertion','user','params.id']),
    publish: helper.respondWithOKStatus(service, 'publish',['*']),
    unpublish: helper.respondWithOKStatus(service, 'unpublish',['*']),
    search:helper.respondWithData(service, 'search',['user','query', 'body']),
    getUserBadge:helper.respondWithData(service, 'getUserBadge',['*']),
    badgeShareMail: helper.respondWithOKStatus(service, 'badgeShareMail',['user', 'body'])
};
