define('admin/plugins/sso-facebook', ['settings', 'alerts'], function (Settings, alerts) {
	'use strict';
	const ACP = {};

	ACP.init = function () {
		Settings.load('sso-facebook', $('.sso-facebook-settings'));

		$('#save').on('click', function () {
			Settings.save('sso-facebook', $('.sso-facebook-settings'), function () {
				alerts.alert({
					type: 'success',
					alert_id: 'sso-facebook-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function () {
						socket.emit('admin.reload');
					},
				});
			});
		});
	};

	return ACP;
});