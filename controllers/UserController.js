/*
 * Copyright (c) 2015 TopCoder, Inc. All rights reserved.
 */

/**
 * This controller exposes REST actions for managing user.
 *
 * @version 1.0
 */
'use strict';

var service = require('../services/UserService');
var helper = require('../helpers/helper');

module.exports = {
    login: helper.respondWithData(service, 'login', ['*']),
    logout: helper.respondWithData(service, 'logout', ['user']),
};
