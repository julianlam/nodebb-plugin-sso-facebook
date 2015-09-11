<div class="row">
	<div class="col-xs-12">
		<div class="panel panel-default">
			<div class="panel-heading">Facebook Social Authentication</div>
			<div class="panel-body">
				<p>
					Create a <strong>Facebook Application</strong> via the
					<a href="https://developers.facebook.com/apps/">Facebook Developers Page</a> and
					then paste your application details here.
				</p>
				<form role="form" class="sso-facebook-settings">
					<div class="form-group">
						<label for="app_id">Application ID</label>
						<input type="text" id="app_id" name="app_id" title="Application ID" class="form-control" placeholder="Application ID"><br />
					</div>
					<div class="form-group">
						<label for="secret">Secret</label>
						<input type="text" id="secret" name="secret" title="Secret" class="form-control" placeholder="Secret">
					</div>
					<div class="checkbox">
						<label for="showSiteTitle" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input type="checkbox" class="mdl-switch__input" id="showSiteTitle" name="autoconfirm" />
							<span class="mdl-switch__label">Skip email verification for people who register using SSO?</span>
						</label>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>