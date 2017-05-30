///<reference path='../server-glue/global-ext.d.ts' />
import * as _express from 'express'
import * as _passportLocal from 'passport-local'
import * as _passport from 'passport'
import * as _configLoader from '../config-loader/config-loader'

import * as Promise from 'bluebird'
const permissions = require('../sbvr-api/permissions')

// Takes a fn with signature (req, res, next, err, user) - a standard express signature with the addition of the err/user entries.
// And returns a middleware that will handle logging in using `username` and `password` body properties
export let login: (fn: (err: any, user: {} | undefined, req: _express.Request, res: _express.Response, next: _express.NextFunction) => void) => _express.RequestHandler

// Returns a middleware that logs the user out and then calls next()
export let logout: _express.RequestHandler

export const checkPassword: _passportLocal.VerifyFunction = (username, password, done: (error: undefined, user?: false | any) => void) =>
	permissions.checkPassword(username, password)
	.catchReturn(false)
	.asCallback(done)

const setup: _configLoader.SetupFunction = (app, sbvrUtils) => {
	if (!process.browser) {
		const passport: typeof _passport = require('passport')
		app.use(passport.initialize())
		app.use(passport.session())

		const { Strategy: LocalStrategy }: typeof _passportLocal = require('passport-local')

		passport.serializeUser((user, done) => {
			done(null, user)
		})

		passport.deserializeUser((user, done) => {
			done(null, user)
		})

		passport.use(new LocalStrategy(checkPassword))

		login = (fn) =>
			(req, res, next) =>
				passport.authenticate('local', (err: any, user?: {}) => {
					if (err || user == null) {
						fn(err, user, req, res, next)
						return
					}
					req.login(user, (err) =>
						fn(err, user, req, res, next)
					)
				})(req, res, next)

		logout = (req, res, next) => {
			req.logout()
			next()
		}
	} else {
		let _user: false | any = false
		app.use((req, res, next) => {
			if (_user !== false)
				req.user = _user
			next()
		})

		login = (fn) =>
			(req, res, next) =>
				checkPassword(req.body.username, req.body.password, (err, user) => {
					if (user) {
						_user = user
					}
					fn(err, user, req, res, next)
				})

		logout = (req, res, next) => {
			req.user = null
			_user = false
			next()
		}
	}
	return Promise.resolve()
}

export const config: _configLoader.Config = {
	models: [{
		customServerCode: { setup }
	}]
}
