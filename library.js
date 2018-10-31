(function (module) {
	'use strict';
	/* globals module, require */

	var user = require.main.require('./src/user'),
		meta = require.main.require('./src/meta'),
		db = require.main.require('./src/database'),
		passport = require.main.require('passport'),
		passportFacebook = require('passport-facebook').Strategy,
		nconf = require.main.require('nconf'),
		async = require.main.require('async'),
		winston = require.main.require('winston');

	var authenticationController = require.main.require('./src/controllers/authentication');

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

	Facebook.init = function (params, callback) {
		var hostHelpers = require.main.require('./src/routes/helpers');

		function render(req, res) {
			res.render('admin/plugins/sso-facebook', {});
		}

		params.router.get('/admin/plugins/sso-facebook', params.middleware.admin.buildHeader, render);
		params.router.get('/api/admin/plugins/sso-facebook', render);

		hostHelpers.setupPageRoute(params.router, '/deauth/facebook', params.middleware, [params.middleware.requireUser], function (req, res) {
			res.render('plugins/sso-facebook/deauth', {
				service: "Facebook",
			});
		});
		params.router.post('/deauth/facebook', [params.middleware.requireUser, params.middleware.applyCSRF], function (req, res, next) {
			Facebook.deleteUserData({
				uid: req.user.uid,
			}, function (err) {
				if (err) {
					return next(err);
				}

				res.redirect(nconf.get('relative_path') + '/me/edit');
			});
		});

		callback();
	};

	Facebook.getSettings = function (callback) {
		if (Facebook.settings) {
			return callback();
		}

		meta.settings.get('sso-facebook', function (err, settings) {
			Facebook.settings = settings;
			callback();
		});
	}

	Facebook.getStrategy = function (strategies, callback) {
		if (!Facebook.settings) {
			return Facebook.getSettings(function () {
				Facebook.getStrategy(strategies, callback);
			});
		}

		if (
			Facebook.settings !== undefined &&
			Facebook.settings.hasOwnProperty('app_id') && Facebook.settings.app_id &&
			Facebook.settings.hasOwnProperty('secret') && Facebook.settings.secret
		) {
			passport.use(new passportFacebook({
				clientID: Facebook.settings.app_id,
				clientSecret: Facebook.settings.secret,
				callbackURL: nconf.get('url') + '/auth/facebook/callback',
				passReqToCallback: true,
				profileFields: ['id', 'emails', 'name', 'displayName'],
				enableProof: true,
			}, function (req, accessToken, refreshToken, profile, done) {
				if (req.hasOwnProperty('user') && req.user.hasOwnProperty('uid') && req.user.uid > 0) {
					// User is already logged-in, associate fb account with uid if account does not have an existing association
					user.getUserField(req.user.uid, 'fbid', function (err, fbid) {
						if (err) {
							return done(err);
						}

						if (!fbid || profile.id === fbid) {
							user.setUserField(req.user.uid, 'fbid', profile.id);
							db.setObjectField('fbid:uid', profile.id, req.user.uid);
							done(null, req.user);
						} else {
							done(new Error('[[error:sso-multiple-association]]'));
						}
					});
				} else {
					var email;
					if (profile._json.hasOwnProperty('email')) {
						email = profile._json.email;
					} else {
						email = (profile.username ? profile.username : profile.id) + '@facebook.com';
					}

					Facebook.login(profile.id, profile.displayName, email, 'https://graph.facebook.com/' + profile.id + '/picture?type=large', accessToken, refreshToken, profile, function (err, user) {
						if (err) {
							return done(err);
						}

						// Require collection of email
						if (email.endsWith('@facebook.com')) {
							req.session.registration = req.session.registration || {};
							req.session.registration.uid = user.uid;
							req.session.registration.fbid = profile.id;
						}

						authenticationController.onSuccessfulLogin(req, user.uid, function (err) {
							done(err, !err ? user : null);
						});
					});
				}
			}));

			strategies.push({
				name: 'facebook',
				url: '/auth/facebook',
				callbackURL: '/auth/facebook/callback',
				icon: constants.admin.icon,
				scope: 'public_profile, email'
			});
		}

		callback(null, strategies);
	};

	Facebook.appendUserHashWhitelist = function (data, callback) {
		data.whitelist.push('fbid');
		return setImmediate(callback, null, data);
	};

	Facebook.getAssociation = function (data, callback) {
		user.getUserField(data.uid, 'fbid', function (err, fbId) {
			if (err) {
				return callback(err, data);
			}

			if (fbId) {
				data.associations.push({
					associated: true,
					url: 'https://facebook.com/' + fbId,
					deauthUrl: nconf.get('url') + '/deauth/facebook',
					name: constants.name,
					icon: constants.admin.icon
				});
			} else {
				data.associations.push({
					associated: false,
					url: nconf.get('url') + '/auth/facebook',
					name: constants.name,
					icon: constants.admin.icon
				});
			}

			callback(null, data);
		})
	};

	Facebook.prepareInterstitial = function (data, callback) {
		// Only execute if:
		//   - uid and fbid are set in session
		//   - email ends with "@facebook.com"
		if (data.userData.hasOwnProperty('uid') && data.userData.hasOwnProperty('fbid')) {
			user.getUserField(data.userData.uid, 'email', function (err, email) {
				if (email && email.endsWith('@facebook.com')) {
					data.interstitials.push({
						template: 'partials/sso-facebook/email.tpl',
						data: {},
						callback: Facebook.storeAdditionalData
					});
				}

				callback(null, data);
			});
		} else {
			callback(null, data);
		}
	};

	Facebook.storeAdditionalData = function (userData, data, callback) {
		async.waterfall([
			// Reset email confirm throttle
			async.apply(db.delete, 'uid:' + userData.uid + ':confirm:email:sent'),
			async.apply(user.getUserField, userData.uid, 'email'),
			function (email, next) {
				// Remove the old email from sorted set reference
				db.sortedSetRemove('email:uid', email, next);
			},
			async.apply(user.setUserField, userData.uid, 'email', data.email),
			async.apply(user.email.sendValidationEmail, userData.uid, data.email)
		], callback);
	};

	Facebook.storeTokens = function (uid, accessToken, refreshToken) {
		//JG: Actually save the useful stuff
		winston.verbose("Storing received fb access information for uid(" + uid + ") accessToken(" + accessToken + ") refreshToken(" + refreshToken + ")");
		user.setUserField(uid, 'fbaccesstoken', accessToken);
		user.setUserField(uid, 'fbrefreshtoken', refreshToken);
	};

	Facebook.login = function (fbid, name, email, picture, accessToken, refreshToken, profile, callback) {
		winston.verbose("Facebook.login fbid, name, email, picture: " + fbid + ", " + name + ", " + email + ", " + picture);

		Facebook.getUidByFbid(fbid, function (err, uid) {
			if (err) {
				return callback(err);
			}

			if (uid !== null) {
				// Existing User
				Facebook.storeTokens(uid, accessToken, refreshToken);

				callback(null, {
					uid: uid
				});
			} else {
				// New User
				var success = function (uid) {
					// Save facebook-specific information to the user
					user.setUserField(uid, 'fbid', fbid);
					db.setObjectField('fbid:uid', fbid, uid);
					var autoConfirm = Facebook.settings && Facebook.settings.autoconfirm === "on" ? 1 : 0;
					user.setUserField(uid, 'email:confirmed', autoConfirm);

					if (autoConfirm) {
						db.sortedSetRemove('users:notvalidated', uid);
					}

					// Save their photo, if present
					if (picture) {
						user.setUserField(uid, 'uploadedpicture', picture);
						user.setUserField(uid, 'picture', picture);
					}

					Facebook.storeTokens(uid, accessToken, refreshToken);

					callback(null, {
						uid: uid
					});
				};

				user.getUidByEmail(email, function (err, uid) {
					if (err) {
						return callback(err);
					}

					if (!uid) {
						// Abort user creation if registration via SSO is restricted
						if (Facebook.settings.disableRegistration === 'on') {
							return callback(new Error('[[error:sso-registration-disabled, Facebook]]'));
						}

						user.create({ username: name, email: email }, function (err, uid) {
							if (err) {
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

	Facebook.getUidByFbid = function (fbid, callback) {
		db.getObjectField('fbid:uid', fbid, function (err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	Facebook.addMenuItem = function (custom_header, callback) {
		custom_header.authentication.push({
			'route': constants.admin.route,
			'icon': constants.admin.icon,
			'name': constants.name
		});

		callback(null, custom_header);
	};

	Facebook.deleteUserData = function (data, callback) {
		var uid = data.uid;

		async.waterfall([
			async.apply(user.getUserField, uid, 'fbid'),
			function (oAuthIdToDelete, next) {
				db.deleteObjectField('fbid:uid', oAuthIdToDelete, next);
			},
			function (next) {
				db.deleteObjectField('user:' + uid, 'fbid', next);
			},
		], function (err) {
			if (err) {
				winston.error('[sso-facebook] Could not remove OAuthId data for uid ' + uid + '. Error: ' + err);
				return callback(err);
			}
			callback(null, uid);
		});
	};

	module.exports = Facebook;
}(module));
