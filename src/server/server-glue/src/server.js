// Generated by CoffeeScript 1.3.3
(function() {
  var app, databaseOptions, express, passport, requirejs, rootPath, setupCallback;

  if (typeof process !== "undefined" && process !== null) {
    databaseOptions = {
      engine: 'mysql',
      params: {
        host: 'localhost',
        user: 'root',
        password: '.',
        database: 'rulemotion'
      }
    };
  } else {
    databaseOptions = {
      engine: 'websql',
      params: 'rulemotion'
    };
  }

  setupCallback = function(requirejs, app) {
    requirejs(['server-glue/sbvr-utils'], function(sbvrUtils) {
      sbvrUtils.setup(app, requirejs, databaseOptions);
      requirejs(['data-server/SBVRServer'], function(sbvrServer) {
        return sbvrServer.setup(app, requirejs, sbvrUtils, databaseOptions);
      });
      return requirejs(['editorServer'], function(editorServer) {
        return editorServer.setup(app, requirejs, sbvrUtils, databaseOptions);
      });
    });
    if (typeof process !== "undefined" && process !== null) {
      return app.listen(process.env.PORT || 1337, function() {
        return console.log('Server started');
      });
    }
  };

  if (typeof process !== "undefined" && process !== null) {
    requirejs = require('requirejs');
    rootPath = process.cwd() + '/../../../';
    requirejs.config({
      paths: {
        'jquery': rootPath + 'external/jquery-1.7.1.min',
        'jquery-ui': rootPath + 'external/jquery-ui/js/jquery-ui-1.8.17.custom.min',
        'jquery-custom-file-input': rootPath + 'external/jquery-custom-file-input',
        'jquery.hotkeys': rootPath + 'external/jquery.hotkeys',
        'ometa-core': rootPath + 'external/ometa-js/lib/ometajs/core',
        'ometa-compiler': rootPath + 'external/ometa-js/lib/ometajs/ometa/parsers',
        'codemirror': rootPath + 'external/CodeMirror2/lib/codemirror',
        'codemirror-util': rootPath + 'external/CodeMirror2/lib/util',
        'codemirror-keymap': rootPath + 'external/CodeMirror2/keymap',
        'codemirror-modes': rootPath + 'external/CodeMirror2/mode',
        'js-beautify': rootPath + 'external/beautify/beautify',
        'qunit': rootPath + 'external/qunit/qunit',
        'underscore': rootPath + 'external/underscore-1.2.1.min',
        'inflection': rootPath + 'external/inflection/inflection',
        'json2': rootPath + 'external/json2',
        'downloadify': rootPath + 'external/downloadify',
        'ejs': rootPath + 'external/ejs/ejs.min',
        'sbvr-parser': rootPath + 'common/sbvr-parser/src/',
        'utils': rootPath + 'common/utils/src/',
        'sbvr-frame': rootPath + 'client/sbvr-frame/src',
        'data-frame': rootPath + 'client/data-frame/src',
        'Prettify': rootPath + 'client/prettify-ometa/src/Prettify',
        'codemirror-ometa-bridge': rootPath + 'client/codemirror-ometa-bridge/src',
        'sbvr-compiler': rootPath + 'server/sbvr-compiler/src/',
        'server-glue': rootPath + 'server/server-glue/src/',
        'express-emulator': rootPath + 'server/express-emulator/src/express',
        'data-server': rootPath + 'server/data-server/src',
        'editorServer': rootPath + 'server/editor-server/src/editorServer',
        'database-layer': rootPath + 'server/database-layer/src/',
        'passportBCrypt': rootPath + 'server/passport-bcrypt/src/passportBCrypt',
        'frame-glue/main': rootPath + 'client/frame-glue/src/main',
        'frame-glue/script': rootPath + 'client/frame-glue/src/script'
      },
      nodeRequire: require,
      baseUrl: 'js'
    });
    express = require('express');
    app = express.createServer();
    passport = require('passport');
    app.configure(function() {
      app.use(express.cookieParser());
      app.use(express.bodyParser());
      app.use(express.session({
        secret: "A pink cat jumped over a rainbow"
      }));
      app.use(passport.initialize());
      app.use(passport.session());
      return app.use(express["static"](rootPath));
    });
    requirejs(['database-layer/db'], function(dbModule) {
      var db;
      db = dbModule.connect(databaseOptions);
      return requirejs('passportBCrypt').init(passport, db);
    });
    app.post('/login', passport.authenticate('local', {
      failureRedirect: '/login.html'
    }), function(req, res, next) {
      return res.redirect('/');
    });
    setupCallback(requirejs, app);
  } else {
    requirejs = window.requirejs;
    requirejs(['express-emulator'], function(express) {
      if (typeof window !== "undefined" && window !== null) {
        window.remoteServerRequest = express.app.process;
      }
      return setupCallback(requirejs, express.app);
    });
  }

}).call(this);
