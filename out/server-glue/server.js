"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Pinejs = require("./module");
var Promise = require("bluebird");
var passportPinejs = require("../passport-pinejs/passport-pinejs");
exports.sbvrUtils = require('../sbvr-api/sbvr-utils');
exports.PinejsSessionStore = require('../pinejs-session-store/pinejs-session-store');
var express = require("express");
var app = express();
switch (app.get('env')) {
    case 'production':
        console.log = function () { };
        break;
    case 'development':
        Promise.longStackTraces();
}
if (!process.browser) {
    var passport = require('passport');
    var path = require('path');
    var compression = require('compression');
    var serveStatic = require('serve-static');
    var cookieParser = require('cookie-parser');
    var bodyParser = require('body-parser');
    var multer = require('multer');
    var methodOverride = require('method-override');
    var expressSession = require('express-session');
    app.use(compression());
    var root = process.argv[2] || __dirname;
    app.use('/', serveStatic(path.join(root, 'static')));
    app.use(cookieParser());
    app.use(bodyParser());
    app.use(multer().any());
    app.use(methodOverride());
    app.use(expressSession({
        secret: 'A pink cat jumped over a rainbow',
        store: new exports.PinejsSessionStore(),
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(function (req, res, next) {
        var origin = req.get('Origin') || '*';
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, PATCH, DELETE, OPTIONS, HEAD');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Application-Record-Count, MaxDataServiceVersion, X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');
        next();
    });
    app.use(function (req, _res, next) {
        console.log('%s %s', req.method, req.url);
        next();
    });
}
exports.initialised = Pinejs.init(app)
    .then(function (configLoader) {
    return Promise.all([
        configLoader.loadConfig(passportPinejs.config),
        configLoader.loadConfig(exports.PinejsSessionStore.config),
    ]);
}).then(function () {
    if (typeof process === 'undefined' || process == null || !process.env.DISABLE_DEFAULT_AUTH) {
        app.post('/login', passportPinejs.login(function (err, user, req, res) {
            if (err) {
                console.error('Error logging in', err, err.stack);
                res.sendStatus(500);
            }
            else if (user === false) {
                if (req.xhr === true) {
                    res.sendStatus(401);
                }
                else {
                    res.redirect('/login.html');
                }
            }
            else {
                if (req.xhr === true) {
                    res.sendStatus(200);
                }
                else {
                    res.redirect('/');
                }
            }
        }));
        app.get('/logout', passportPinejs.logout, function (_req, res) {
            res.redirect('/');
        });
    }
}).then(function () {
    app.listen(process.env.PORT || 1337, function () {
        console.info('Server started');
    });
}).catch(function (err) {
    console.error('Error initialising server', err, err.stack);
    process.exit(1);
});
//# sourceMappingURL=server.js.map