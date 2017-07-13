"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Promise = require("bluebird");
var permissions = require('../sbvr-api/permissions');
exports.checkPassword = function (username, password, done) {
    return permissions.checkPassword(username, password)
        .catchReturn(false)
        .asCallback(done);
};
var setup = function (app) {
    if (!process.browser) {
        var passport_1 = require('passport');
        app.use(passport_1.initialize());
        app.use(passport_1.session());
        var LocalStrategy = require('passport-local').Strategy;
        passport_1.serializeUser(function (user, done) {
            done(null, user);
        });
        passport_1.deserializeUser(function (user, done) {
            done(null, user);
        });
        passport_1.use(new LocalStrategy(exports.checkPassword));
        exports.login = function (fn) {
            return function (req, res, next) {
                return passport_1.authenticate('local', function (err, user) {
                    if (err || user == null) {
                        fn(err, user, req, res, next);
                        return;
                    }
                    req.login(user, function (err) {
                        fn(err, user, req, res, next);
                    });
                })(req, res, next);
            };
        };
        exports.logout = function (req, _res, next) {
            req.logout();
            next();
        };
    }
    else {
        var loggedIn_1 = false;
        var loggedInUser_1 = null;
        app.use(function (req, _res, next) {
            if (loggedIn_1 === false) {
                req.user = loggedInUser_1;
            }
            next();
        });
        exports.login = function (fn) {
            return function (req, res, next) {
                return exports.checkPassword(req.body.username, req.body.password, function (err, user) {
                    if (user) {
                        loggedIn_1 = true;
                        loggedInUser_1 = user;
                    }
                    fn(err, user, req, res, next);
                });
            };
        };
        exports.logout = function (req, _res, next) {
            req.user = null;
            loggedIn_1 = false;
            loggedInUser_1 = null;
            next();
        };
    }
    return Promise.resolve();
};
exports.config = {
    models: [{
            customServerCode: { setup: setup },
        }],
};
//# sourceMappingURL=passport-pinejs.js.map