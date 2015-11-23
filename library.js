(function(module) {
	'use strict';
	/* globals module, require */

	var user = module.parent.require('./user'),
		meta = module.parent.require('./meta'),
		db = module.parent.require('../src/database'),
		passport = module.parent.require('passport'),
		passportFacebook = require('passport-facebook').Strategy,
		nconf = module.parent.require('nconf'),
		async = module.parent.require('async'),
		winston = module.parent.require('winston'),
		path = module.parent.require('path'),
		fs = module.parent.require('fs'),
		request = module.parent.require('request');

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

	Facebook.init = function(params, callback) {
		function render(req, res) {
			res.render('admin/plugins/sso-facebook', {});
		}

		params.router.get('/admin/plugins/sso-facebook', params.middleware.admin.buildHeader, render);
		params.router.get('/api/admin/plugins/sso-facebook', render);

		callback();
	};

	Facebook.getSettings = function(callback) {
		if (Facebook.settings) {
			return callback();
		}

		meta.settings.get('sso-facebook', function(err, settings) {
			Facebook.settings = settings;
			callback();
		});
	}

	Facebook.getStrategy = function(strategies, callback) {
		if (!Facebook.settings) {
			return Facebook.getSettings(function() {
				Facebook.getStrategy(strategies, callback);
			});
		}

		if (Facebook.settings !== undefined && Facebook.settings.hasOwnProperty('app_id') && Facebook.settings.hasOwnProperty('secret')) {
			passport.use(new passportFacebook({
				clientID: Facebook.settings.app_id,
				clientSecret: Facebook.settings.secret,
				callbackURL: nconf.get('url') + '/auth/facebook/callback',
				passReqToCallback: true,
				profileFields: ['id', 'emails', 'name', 'displayName']
			}, function(req, accessToken, refreshToken, profile, done) {
				if (req.hasOwnProperty('user') && req.user.hasOwnProperty('uid') && req.user.uid > 0) {
					// Save facebook-specific information to the user
					user.setUserField(req.user.uid, 'fbid', profile.id);
					db.setObjectField('fbid:uid', profile.id, req.user.uid);
					return done(null, req.user);
				}

				var email;
				if (profile._json.hasOwnProperty('email')) {
					email = profile._json.email;
				} else {
					email = (profile.username ? profile.username : profile.id) + '@facebook.com';
				}

				Facebook.login(profile.id, profile.displayName, email, 'https://graph.facebook.com/me/picture?type=large&access_token='+accessToken, function(err, user) {
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
				icon: constants.admin.icon,
				scope: 'email'
			});
		}

		callback(null, strategies);
	};

	Facebook.getAssociation = function(data, callback) {
		user.getUserField(data.uid, 'fbid', function(err, fbId) {
			if (err) {
				return callback(err, data);
			}

			if (fbId) {
				data.associations.push({
					associated: true,
					url: 'https://facebook.com/' + fbId,
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
					user.setUserField(uid, 'fbid', fbid);
					db.setObjectField('fbid:uid', fbid, uid);
					var autoConfirm = Facebook.settings && Facebook.settings.autoconfirm === "on" ? 1: 0;
					user.setUserField(uid, 'email:confirmed', autoConfirm);

					// Download and Save their photo, if present
					if (picture) {
						var filename = uid + '-profileimg.jpg';
						var absolutePath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), 'profile', filename);
						
						var file = fs.createWriteStream(absolutePath);
						
						file.on('finish', function() {
							file.close(function() {
								var picPath = path.join('/uploads', 'profile', filename);
								user.setUserField(uid, 'uploadedpicture', picPath);
								user.setUserField(uid, 'picture', picPath);
								callback(null, {
									uid: uid
								});
							});	
						});						
						
						request.get({
							followAllRedirects: true,
							url: picture
						})
						.on('error', function(err) {
							fs.unlink(dest);
							callback(null, {
								uid: uid
							});
						})
						.pipe(file);
						
					} else {
						callback(null, {
							uid: uid
						});
					}
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
			'route': constants.admin.route,
			'icon': constants.admin.icon,
			'name': constants.name
		});

		callback(null, custom_header);
	};

	Facebook.deleteUserData = function(data, callback) {
		var uid = data.uid;

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
