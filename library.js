(function(module) {
	"use strict";

	var user = module.parent.require('./user'),
		db = module.parent.require('../src/database'),
		passport = module.parent.require('passport'),
  		passportFacebook = require('passport-facebook').Strategy,
  		fs = module.parent.require('fs'),
  		path = module.parent.require('path'),
  		nconf = module.parent.require('nconf');

	var constants = Object.freeze({
		'name': "Facebook",
		'admin': {
			'route': '/facebook',
			'icon': 'fa-facebook-square'
		}
	});

	var Facebook = {};

	Facebook.getStrategy = function(strategies) {
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
				icon: 'facebook',
				scope: 'email'
			});
		}

		return strategies;
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
	}

	Facebook.getUidByFbid = function(fbid, callback) {
		db.getObjectField('fbid:uid', fbid, function(err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	Facebook.addMenuItem = function(custom_header) {
		custom_header.authentication.push({
			"route": constants.admin.route,
			"icon": constants.admin.icon,
			"name": constants.name
		});

		return custom_header;
	}

	Facebook.addAdminRoute = function(custom_routes, callback) {
		fs.readFile(path.resolve(__dirname, './static/admin.tpl'), function (err, template) {
			custom_routes.routes.push({
				"route": constants.admin.route,
				"method": "get",
				"options": function(req, res, callback) {
					callback({
						req: req,
						res: res,
						route: constants.admin.route,
						name: constants.name,
						content: template
					});
				}
			});

			callback(null, custom_routes);
		});
	};

	module.exports = Facebook;
}(module));