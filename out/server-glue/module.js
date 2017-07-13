"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (!process.browser) {
    if (typeof nodeRequire === 'undefined' || nodeRequire == null) {
        global.nodeRequire = require;
    }
    var fs_1 = require('fs');
    nodeRequire.extensions['.sbvr'] = function (module, filename) {
        return module.exports = fs_1.readFileSync(filename, { encoding: 'utf8' });
    };
    nodeRequire('ometa-js');
}
var Promise = require("bluebird");
var dbModule = require('../database-layer/db');
var configLoader = require('../config-loader/config-loader');
var migrator = require('../migrator/migrator');
exports.sbvrUtils = require('../sbvr-api/sbvr-utils');
exports.SessionStore = require('../pinejs-session-store/pinejs-session-store');
var databaseOptions;
if (dbModule.websql != null) {
    databaseOptions = {
        engine: 'websql',
        params: 'rulemotion',
    };
}
else {
    var databaseURL = void 0;
    if (process.env.DATABASE_URL) {
        databaseURL = process.env.DATABASE_URL;
    }
    else if (dbModule.postgres != null) {
        databaseURL = 'postgres://postgres:.@localhost:5432/postgres';
    }
    else if (dbModule.mysql == null) {
        databaseURL = 'mysql://mysql:.@localhost:3306';
    }
    else {
        throw new Error('No supported database options available');
    }
    databaseOptions = {
        engine: databaseURL.slice(0, databaseURL.indexOf(':')),
        params: databaseURL,
    };
}
var db = dbModule.connect(databaseOptions);
exports.init = function (app, config) {
    return exports.sbvrUtils.setup(app, db)
        .then(function () {
        var cfgLoader = configLoader.setup(app);
        return cfgLoader.loadConfig(migrator.config)
            .return(cfgLoader);
    }).tap(function (cfgLoader) {
        var promises = [];
        if (process.env.SBVR_SERVER_ENABLED) {
            var sbvrServer = require('../data-server/SBVRServer');
            var transactions_1 = require('../http-transactions/transactions');
            promises.push(cfgLoader.loadConfig(sbvrServer.config));
            promises.push(cfgLoader.loadConfig(transactions_1.config)
                .then(function () { return transactions_1.addModelHooks('data'); }));
        }
        if (!process.env.CONFIG_LOADER_DISABLED) {
            promises.push(cfgLoader.loadApplicationConfig(config));
        }
        return Promise.all(promises);
    }).catch(function (err) {
        console.error('Error initialising server', err, err.stack);
        process.exit(1);
    });
};
//# sourceMappingURL=module.js.map