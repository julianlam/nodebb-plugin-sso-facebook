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
				<ul>
					<li>
						You will need to enable <strong>"Client OAuth Login"</strong> and <strong>"Web OAuth Login"</strong>
					from the "Facebook Login" product
					</li>
					<li>
						You will need to paste <code>{baseUrl}/auth/facebook/callback</code> into the
						<strong>"Valid OAuth Redirect URIs"</strong> field.
					</li>
				</ul>
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
						<label for="autoconfirm" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input type="checkbox" class="mdl-switch__input" id="autoconfirm" name="autoconfirm" />
							<span class="mdl-switch__label">Skip email verification for people who register using SSO?</span>
						</label>
					</div>
					<div class="checkbox">
						<label for="disableRegistration" class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input type="checkbox" class="mdl-switch__input" id="disableRegistration" name="disableRegistration" />
							<span class="mdl-switch__label">Disable user registration via SSO</span>
						</label>
					</div>
					<p class="help-block">
						Restricting registration means that only registered users can associate their account with this SSO strategy.
						This restriction is useful if you have users bypassing registration controls by using social media accounts, or
						if you wish to use the NodeBB registration queue.
					</p>
				</form>
			</div>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>
