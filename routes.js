/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */
/**
 * Contains all application routes.
 *
 * Version 1.1
 *     - Added Login route
 *     - Added logout routes
 *     - Added unlike route
 *     - Added badge share by mail route
 *     - Added app share mail route
 *
 * @author TCDEVELOPER
 * @version 1.1
 */
module.exports = {
    '/api/v1/stream': {
        get: {
            controller: 'BadgeController',
            method: 'stream'
        }
    },
    '/api/v1/badge/:id/detail': {
        get: {
            controller: 'BadgeController',
            method: 'getDetail',
            badgeAssertion: true
        }
    },
    '/api/v1/badge/:id/earners': {
        get: {
            controller: 'BadgeController',
            method: 'getEarners',
            badge: true
        }
    },
    '/api/v1/badge/:id/comments': {
        get: {
            controller: 'BadgeController',
            method: 'getComments',
            badgeAssertion: true
        }
    },
    '/api/v1/badge/:id/comment': {
        post: {
            controller: 'BadgeController',
            method: 'comment',
            checkExpiredBadgeAssertion: true,
            checkPublishedBadgeAssertion: true,
            badgeAssertion: true
        }
    },
    '/api/v1/comment/:id': {
        delete: {
            controller: 'BadgeController',
            method: 'deleteComment'
        }
    },

    '/api/v1/badge/:id/favor': {
        post: {
            controller: 'BadgeController',
            method: 'favor',
            badge: true
        }
    },
    '/api/v1/badge/:id/unfavor': {
        post: {
            controller: 'BadgeController',
            method: 'unfavor',
            badge: true
        }
    },
    '/api/v1/badge/:id/like': {
        post: {
            controller: 'BadgeController',
            method: 'like',
            badgeAssertion: true,
            checkExpiredBadgeAssertion: true,
            checkPublishedBadgeAssertion: true,
            checkDenySelfBadgeAssertion: true
        }
    },
    '/api/v1/badge/:id/unlike': {
        post: {
            controller: 'BadgeController',
            method: 'unlike',
            badgeAssertion: true,
            checkExpiredBadgeAssertion: true,
            checkPublishedBadgeAssertion: true,
            checkDenySelfBadgeAssertion: true
        }
    },
    '/api/v1/badge/:id/publish': {
        post: {
            controller: 'BadgeController',
            method: 'publish',
            badgeAssertion: true,
            checkExpiredBadgeAssertion: true,
            checkAllowSelfBadgeAssertion: true
        }
    },
    '/api/v1/badge/:id/unpublish': {
        post: {
            controller: 'BadgeController',
            method: 'unpublish',
            badgeAssertion: true,
            checkExpiredBadgeAssertion: true,
            checkAllowSelfBadgeAssertion: true
        }
    },
    '/api/v1/badge/share/mail': {
        post: {
            controller: 'BadgeController',
            method: 'badgeShareMail'
        }
    },
    '/api/v1/search': {
        post: {
            controller: 'BadgeController',
            method: 'search'
        }
    },
    '/api/v1/user/:id/badge/:uid': {
        get: {
            controller: 'BadgeController',
            method: 'getUserBadge',
            profile: true,
            badge: true
        }
    },
    '/api/v1/profile/:id/detail': {
        get: {
            controller: 'ProfileController',
            method: 'getDetail',
            profile: true
        }
    },
    '/api/v1/profile/:id/testimonials': {
        get: {
            controller: 'ProfileController',
            method: 'getTestimonials',
            profile: true
        }
    },
    '/api/v1/profile/:id/comments': {
        get: {
            controller: 'ProfileController',
            method: 'getComments',
            profile: true
        }
    },
    '/api/v1/profile/:id/badges': {
        get: {
            controller: 'ProfileController',
            method: 'getBadges',
            profile: true
        }
    },
    '/api/v1/profile/:id/favorite': {
        get: {
            controller: 'ProfileController',
            method: 'getFavoriteBadges',
            profile: true
        }
    },
    '/api/v1/profile/:id/notifications': {
        get: {
            controller: 'ProfileController',
            method: 'getNotifications',
            profile: true
        }
    },
    '/api/v1/feedback': {
        post: {
            controller: 'ProfileController',
            method: 'feedback',
            upload: true
        }
    },
    '/api/v1/app/share/mail': {
        post: {
            controller: 'ProfileController',
            method: 'appShareMail'
        }
    },
    '/api/v1/login': {
        post: {
            controller: 'UserController',
            method: 'login',
            anonymous: true
        }
    },
    '/api/v1/logout': {
        post: {
            controller: 'UserController',
            method: 'logout'
        }
    },
};
