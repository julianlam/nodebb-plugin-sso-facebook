'use strict';

$(window).on('action:script.load', function (ev, data) {
	data.scripts.push('sso-facebook/login');
});

define('sso-facebook/login', function () {
	var Login = {};

	Login.init = function () {
		var replaceEl = $('.alt-logins .facebook a i');
		var replacement = document.createElement('div');
		var image = document.createElement('img');
		image.src = config.relative_path + '/plugins/nodebb-plugin-sso-facebook/images/f-ogo_RGB_HEX-58.svg';
		replaceEl.replaceWith(replacement);
		replacement.appendChild(image);
		$('<span>Continue with Facebook</span>').appendTo(replacement);
	}

	return Login;
})
