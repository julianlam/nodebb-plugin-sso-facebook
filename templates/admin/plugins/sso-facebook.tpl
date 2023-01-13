<div class="row">
	<div class="col-12">
		<div class="card">
			<div class="card-header">Facebook Social Authentication</div>
			<div class="card-body">
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
					<div class="mb-3">
						<label for="app_id">Application ID</label>
						<input type="text" id="app_id" name="app_id" title="Application ID" class="form-control" placeholder="Application ID"><br />
					</div>
					<div class="mb-3">
						<label for="secret">Secret</label>
						<input type="text" id="secret" name="secret" title="Secret" class="form-control" placeholder="Secret">
					</div>
					<div class="form-check">
						<input type="checkbox" class="form-check-input" id="autoconfirm" name="autoconfirm" />
						<label for="autoconfirm" class="form-check-label">
							Skip email verification for people who register using SSO?
						</label>
					</div>
					<div class="form-check">
						<input type="checkbox" class="form-check-input" id="disableRegistration" name="disableRegistration" />
						<label for="disableRegistration" class="form-check-label">
							Disable user registration via SSO
						</label>
					</div>
					<p class="form-text">
						Restricting registration means that only registered users can associate their account with this SSO strategy.
						This restriction is useful if you have users bypassing registration controls by using social media accounts, or
						if you wish to use the NodeBB registration queue.
					</p>
				</form>
			</div>
		</div>
	</div>
</div>

<!-- IMPORT admin/partials/save_button.tpl -->