(function(module) {
	'use strict';
	/* globals module, require */

	var User = module.parent.require('./user'),
		meta = module.parent.require('./meta'),
		db = module.parent.require('../src/database'),
		passport = module.parent.require('passport'),
		passportFacebook = require('passport-facebook').Strategy,
		nconf = module.parent.require('nconf'),
		async = module.parent.require('async');

	var constants = Object.freeze({
		'name': 'Facebook',
		'admin': {
			'route': '/plugins/sso-facebook',
			'icon': 'fa-facebook-square'
		}
	});

	var Facebook = {
		settings: undefined
	};

	Facebook.preinit = function(data, callback) {
		// Settings
		meta.settings.get('sso-facebook', function(err, settings) {
			Facebook.settings = settings;
			callback(null, data);
		});
	};

	Facebook.init = function(data, callback) {
		function render(req, res, next) {
			res.render('admin/plugins/sso-facebook', {});
		}

		data.router.get('/admin/plugins/sso-facebook', data.middleware.admin.buildHeader, render);
		data.router.get('/api/admin/plugins/sso-facebook', render);
		
		callback();
	};

	Facebook.getStrategy = function(strategies, callback) {
		meta.settings.get('sso-facebook', function(err, settings) {
			if (!err && settings.app_id && settings.secret) {
				passport.use(new passportFacebook({
					clientID: settings.app_id,
					clientSecret: settings.secret,
					callbackURL: nconf.get('url') + '/auth/facebook/callback'
				}, function(accessToken, refreshToken, profile, done) {
					var email;
					if (profile._json.hasOwnProperty('email')) {
						email = profile._json.email;
					} else {
						email = (profile.username || profile.id) + '@facebook.com';
					}
					Facebook.login(profile.id, profile.displayName, email, 'https://graph.facebook.com/' + profile.id + '/picture?type=large', function(err, user) {
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
		});
	};

	Facebook.login = function(fbid, name, email, picture, callback) {
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
					User.setUserField(uid, 'fbid', fbid);
					db.setObjectField('fbid:uid', fbid, uid);
					var autoConfirm = Facebook.settings && Facebook.settings.autoconfirm === "on" ? 1: 0;
					User.setUserField(uid, 'email:confirmed', autoConfirm);

					// Save their photo, if present
					if (picture) {
						User.setUserField(uid, 'uploadedpicture', picture);
						User.setUserField(uid, 'picture', picture);
					}

					callback(null, {
						uid: uid
					});
				};

				User.getUidByEmail(email, function(err, uid) {
					if(err) {
						return callback(err);
					}

					if (!uid) {
						User.create({username: name, email: email}, function(err, uid) {
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
			'route': constants.admin.route,
			'icon': constants.admin.icon,
			'name': constants.name
		});

		callback(null, custom_header);
	};

	Facebook.deleteUserData = function(uid, callback) {
		async.waterfall([
			async.apply(User.getUserField, uid, 'fbid'),
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
