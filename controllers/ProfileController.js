/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This controller exposes REST actions to manage User Profile.
 *
 * Version 1.1
 *     - Added app share mail function
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
var service = require('../services/ProfileService');
var helper = require('../helpers/helper');

module.exports = {
    getDetail:helper.respondWithData(service, 'getDetail',['params.id','profile']),
    getTestimonials: helper.respondWithData(service, 'getTestimonials',['profile','query']),
    getComments:helper.respondWithData(service, 'getComments',['profile','query']),
    getBadges:helper.respondWithData(service, 'getBadges',['user','profile','query']),
    getFavoriteBadges:helper.respondWithData(service, 'getFavoriteBadges',['profile','query']),
    getNotifications: helper.respondWithData(service, 'getNotifications',['profile','query']),
    feedback: helper.respondWithOKStatus(service, 'feedback',['*']),
    appShareMail: helper.respondWithOKStatus(service, 'appShareMail',['user', 'body'])
};
