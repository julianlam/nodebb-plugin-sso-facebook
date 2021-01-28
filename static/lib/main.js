'use strict';

require(['hooks'], (hooks) => {
	hooks.on('action:ajaxify.end', ({ tpl_url }) => {
		if (tpl_url === 'login') {
			var replaceEl = $('.alt-logins .facebook a i');
			var replacement = document.createElement('div');
			var image = document.createElement('img');
			image.src = config.relative_path + '/plugins/nodebb-plugin-sso-facebook/images/f-ogo_RGB_HEX-58.svg';
			replaceEl.replaceWith(replacement);
			replacement.appendChild(image);
			$('<span>Continue with Facebook</span>').appendTo(replacement);
		}
	});
});
