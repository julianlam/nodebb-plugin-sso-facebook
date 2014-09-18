(function(module) {
	"use strict";

	var user = module.parent.require('./user'),
		meta = module.parent.require('./meta'),
		db = module.parent.require('../src/database'),
		passport = module.parent.require('passport'),
		passportFacebook = require('passport-facebook').Strategy,
		fs = module.parent.require('fs'),
		path = module.parent.require('path'),
		nconf = module.parent.require('nconf'),
		async = module.parent.require('async');

	var constants = Object.freeze({
		'name': "Facebook",
		'admin': {
			'route': '/plugins/sso-facebook',
			'icon': 'fa-facebook-square'
		}
	});

	var Facebook = {};

	Facebook.init = function(app, middleware, controllers, callback) {
		function render(req, res, next) {
			res.render('admin/plugins/sso-facebook', {});
		}

		app.get('/admin/plugins/sso-facebook', middleware.admin.buildHeader, render);
		app.get('/api/admin/plugins/sso-facebook', render);

		callback();
	};

	Facebook.getStrategy = function(strategies, callback) {
		if (meta.config['social:facebook:app_id'] && meta.config['social:facebook:secret']) {
			passport.use(new passportFacebook({
				clientID: meta.config['social:facebook:app_id'],
				clientSecret: meta.config['social:facebook:secret'],
				callbackURL: nconf.get('url') + '/auth/facebook/callback'
			}, function(accessToken, refreshToken, profile, done) {
				Facebook.login(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
					if (err) {
						return done(err);
					}
					done(null, user);
				});
			}));

			strategies.push({
				name: 'facebook',
				url: '/auth/facebook',
				callbackURL: '/auth/facebook/callback',
				icon: 'fa-facebook-square',
				scope: 'email'
			});
		}

		callback(null, strategies);
	};

	Facebook.login = function(fbid, name, email, callback) {
		Facebook.getUidByFbid(fbid, function(err, uid) {
			if(err) {
				return callback(err);
			}

			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				var success = function(uid) {
					// Save facebook-specific information to the user
					user.setUserField(uid, 'fbid', fbid);
					db.setObjectField('fbid:uid', fbid, uid);
					callback(null, {
						uid: uid
					});
				};

				user.getUidByEmail(email, function(err, uid) {
					if(err) {
						return callback(err);
					}

					if (!uid) {
						user.create({username: name, email: email}, function(err, uid) {
							if(err) {
								return callback(err);
							}

							success(uid);
						});
					} else {
						success(uid); // Existing account -- merge
					}
				});
			}
		});
	};

	Facebook.getUidByFbid = function(fbid, callback) {
		db.getObjectField('fbid:uid', fbid, function(err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	Facebook.addMenuItem = function(custom_header, callback) {
		custom_header.authentication.push({
			"route": constants.admin.route,
			"icon": constants.admin.icon,
			"name": constants.name
		});

		callback(null, custom_header);
	};

	Facebook.deleteUserData = function(uid, callback) {
		async.waterfall([
			async.apply(user.getUserField, uid, 'fbid'),
			function(oAuthIdToDelete, next) {
				db.deleteObjectField('fbid:uid', oAuthIdToDelete, next);
			}
		], function(err) {
			if (err) {
				winston.error('[sso-facebook] Could not remove OAuthId data for uid ' + uid + '. Error: ' + err);
				return callback(err);
			}
			callback(null, uid);
		});
	};

	module.exports = Facebook;
}(module));