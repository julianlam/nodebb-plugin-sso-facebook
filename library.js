
'use strict';

const passport = require.main.require('passport');
const passportFacebook = require('passport-facebook').Strategy;
const nconf = require.main.require('nconf');
const winston = require.main.require('winston');

const user = require.main.require('./src/user');
const meta = require.main.require('./src/meta');
const db = require.main.require('./src/database');

const constants = Object.freeze({
	'name': 'Facebook',
	'admin': {
		'route': '/plugins/sso-facebook',
		'icon': 'fa-facebook-square',
	},
});

const Facebook = {
	settings: undefined,
};

Facebook.init = async function (params) {
	const hostHelpers = require.main.require('./src/routes/helpers');

	hostHelpers.setupAdminPageRoute(params.router, '/admin/plugins/sso-facebook', function (req, res) {
		res.render('admin/plugins/sso-facebook', {
			title: constants.name,
			baseUrl: nconf.get('url'),
		});
	});

	hostHelpers.setupPageRoute(params.router, '/deauth/facebook', [params.middleware.requireUser], function (req, res) {
		res.render('plugins/sso-facebook/deauth', {
			service: constants.name,
		});
	});
	params.router.post('/deauth/facebook', [params.middleware.requireUser, params.middleware.applyCSRF], hostHelpers.tryRoute(async function (req, res) {
		await Facebook.deleteUserData({
			uid: req.user.uid,
		});
		res.redirect(nconf.get('relative_path') + '/me/edit');
	}));
};

Facebook.getSettings = async function () {
	if (Facebook.settings) {
		return;
	}

	Facebook.settings = await meta.settings.get('sso-facebook');
};

Facebook.getStrategy = async function (strategies) {
	if (!Facebook.settings) {
		await Facebook.getSettings();
		return Facebook.getStrategy(strategies);
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
		}, async function (req, accessToken, refreshToken, profile, done) {
			try {
				if (req.hasOwnProperty('user') && req.user.hasOwnProperty('uid') && req.user.uid > 0) {
					// User is already logged-in, associate fb account with uid if account does not have an existing association
					const fbid = await user.getUserField(req.user.uid, 'fbid');
					if (!fbid || profile.id === fbid) {
						await user.setUserField(req.user.uid, 'fbid', profile.id);
						await db.setObjectField('fbid:uid', profile.id, req.user.uid);
						done(null, req.user);
					} else {
						done(new Error('[[error:sso-multiple-association]]'));
					}
				} else {
					let email;
					if (profile._json.hasOwnProperty('email')) {
						email = profile._json.email;
					} else {
						email = (profile.username ? profile.username : profile.id) + '@facebook.com';
					}

					const { queued, uid, message } = await Facebook.login(req, profile.id, profile.displayName, email, 'https://graph.facebook.com/' + profile.id + '/picture?type=large', accessToken, refreshToken);

					if (queued) {
						return done(null, false, { message });
					}

					// Require collection of email
					if (email.endsWith('@facebook.com')) {
						req.session.registration = req.session.registration || {};
						req.session.registration.uid = user.uid;
						req.session.registration.fbid = profile.id;
					}

					done(null, { uid });
				}
			} catch (err) {
				done(err);
			}
		}));

		strategies.push({
			name: 'facebook',
			url: '/auth/facebook',
			callbackURL: '/auth/facebook/callback',
			icon: constants.admin.icon,
			icons: {
				normal: 'fa-brands fa-facebook',
				square: 'fa-brands fa-facebook-square',
			},
			labels: {
				login: '[[social:log-in-with-facebook]]',
				register: '[[social:continue-with-facebook]]',
			},
			color: '#5165b2',
			scope: 'public_profile, email',
		});
	}
};

Facebook.appendUserHashWhitelist = function (data) {
	data.whitelist.push('fbid');
	return data;
};

Facebook.getAssociation = async function (data) {
	const fbId = await user.getUserField(data.uid, 'fbid');
	if (fbId) {
		data.associations.push({
			associated: true,
			url: 'https://facebook.com/' + fbId,
			deauthUrl: nconf.get('url') + '/deauth/facebook',
			name: constants.name,
			icon: constants.admin.icon,
		});
	} else {
		data.associations.push({
			associated: false,
			url: nconf.get('url') + '/auth/facebook',
			name: constants.name,
			icon: constants.admin.icon,
		});
	}
	return data;
};

Facebook.prepareInterstitial = async function (data) {
	// Only execute if:
	//   - uid and fbid are set in session
	//   - email ends with "@facebook.com"
	if (data.userData.hasOwnProperty('uid') && data.userData.hasOwnProperty('fbid')) {
		const email = await user.getUserField(data.userData.uid, 'email');
		if (email && email.endsWith('@facebook.com')) {
			data.interstitials.push({
				template: 'partials/sso-facebook/email.tpl',
				data: {},
				callback: Facebook.storeAdditionalData,
			});
		}
	}
	return data;
};

Facebook.storeAdditionalData = async function (userData, data) {
	await db.delete(`uid:${userData.uid}:confirm:email:sent`);
	const email = await user.getUserField(userData.uid, 'email');
	await db.sortedSetRemove('email:uid', email);
	await user.setUserField(userData.uid, 'email', data.email);
	await user.email.sendValidationEmail(userData.uid, data.email);
};

Facebook.storeTokens = async function (uid, accessToken, refreshToken) {
	//JG: Actually save the useful stuff
	winston.verbose(`Storing received fb access information for uid(${uid}) accessToken(${accessToken}) refreshToken(${refreshToken})`);
	await user.setUserFields(uid, {
		fbaccesstoken: accessToken,
		fbrefreshtoken: refreshToken,
	});
};

Facebook.login = async function (req, fbid, name, email, picture, accessToken, refreshToken) {
	winston.verbose(`Facebook.login fbid, name, email, picture: ${fbid}, ${name}, ${email}, ${picture}`);
	const autoConfirm = Facebook.settings && Facebook.settings.autoconfirm === 'on' ? 1 : 0;

	let uid = await Facebook.getUidByFbid(fbid);

	if (uid) {
		// Existing User
		await Facebook.storeTokens(uid, accessToken, refreshToken);
		return { uid: uid };
	}

	const success = async (uid) => {
		// Save facebook-specific information to the user
		await Promise.all([
			user.setUserField(uid, 'fbid', fbid),
			db.setObjectField('fbid:uid', fbid, uid),
		]);

		// Save their photo, if present
		if (picture) {
			await user.setUserFields(uid, {
				uploadedpicture: picture,
				picture: picture,
			});
		}

		await Facebook.storeTokens(uid, accessToken, refreshToken);
	};

	uid = await user.getUidByEmail(email);
	if (uid) {
		await success(uid);
		return { uid };
	}

	// Abort user creation if registration via SSO is restricted
	if (Facebook.settings.disableRegistration === 'on') {
		throw new Error('[[error:sso-registration-disabled, Facebook]]');
	}

	return await user.createOrQueue(req, {
		fbid,
		picture,
		username: name,
		email,
	}, {
		emailVerification: autoConfirm ? 'verify' : 'send',
	});
};

Facebook.addToApprovalQueue = async (hookData) => {
	await saveFacebookSpecificData(hookData.data, hookData.userData);
	return hookData;
};

Facebook.filterUserCreate = async (hookData) => {
	await saveFacebookSpecificData(hookData.user, hookData.data);
	return hookData;
};

async function saveFacebookSpecificData(targetObj, sourceObj) {
	const { fbid, picture } = sourceObj;
	if (fbid) {
		const uid = await Facebook.getUidByFbid(fbid);
		if (uid) {
			throw new Error('[[error:sso-account-exists, Facebook]]');
		}
		targetObj.fbid = fbid;
		if (picture) {
			targetObj.picture = picture;
			targetObj.uploadedpicture = picture;
		}
	}
}

Facebook.actionUserCreate = async (hookData) => {
	const { uid } = hookData.user;
	const fbid = await user.getUserField(uid, 'fbid');
	if (fbid) {
		await db.setObjectField('fbid:uid', fbid, uid);
	}
};

Facebook.filterUserGetRegistrationQueue = async (hookData) => {
	const { users } = hookData;
	users.forEach((user) => {
		if (user?.fbid) {
			user.sso = {
				icon: 'fa-brands fa-facebook',
				name: constants.name,
			};
		}
	});
	return hookData;
};

Facebook.getUidByFbid = async function (fbid) {
	const uid = await db.getObjectField('fbid:uid', fbid);
	return uid;
};

Facebook.addMenuItem = function (custom_header) {
	custom_header.authentication.push({
		'route': constants.admin.route,
		'icon': constants.admin.icon,
		'name': constants.name,
	});
	return custom_header;
};

Facebook.deleteUserData = async function (data) {
	const { uid } = data;
	const fbid = await user.getUserField(uid, 'fbid');
	if (fbid) {
		await Promise.all([
			db.deleteObjectField('fbid:uid', fbid),
			db.deleteObjectField(`user:${uid}`, 'fbid'),
		]);
	}
};

module.exports = Facebook;

