# Email magic-link authentication

Google login and passwordless email login are available on the homepage and invitation page. Users enter an email, receive Firebase's sign-in email, open it, and confirm the address on `/auth/finish`. Firebase verifies email ownership. A new address creates an account; returning users sign in to their existing Firebase identity.

## Security and account behavior

- Email is remembered in local storage only as a convenience. It is never copied into a return URL. On another device, users enter the original address.
- Confirmation requires an explicit click, avoiding automatic account switches and duplicate consumption under React Strict Mode.
- Firebase validates expiry, matching email, and single use. The UI offers a fresh link for invalid/expired/consumed links.
- Only `/boards` and validated invitation destinations are accepted as return paths.
- Backend accepts verified Google and Firebase email-provider tokens (Firebase uses the provider ID `password` for email-link sessions). All board membership/role checks remain enforced.
- Firebase email configuration uses `enabled: true`, `passwordRequired: false`. The app has no password signup or password login flow.
- Callback URLs and action-code requests bypass the service-worker cache. After successful sign-in the callback code is removed from browser history.
- Existing Google users should use the same email address to retain their account. No manual merging of separate UIDs is performed.

## Firebase configuration

Both `taskboard-prod-260908` and `taskboard-dev-260908` have Email Link sign-in enabled with a field-masked update that preserves Google and existing authorized domains:

```sh
node scripts/cloud.mjs taskboard-prod-260908 enable-email-link
node scripts/cloud.mjs taskboard-dev-260908 enable-email-link
node scripts/cloud.mjs taskboard-prod-260908 inspect
```

REST omits the false `passwordRequired` field in responses. The production domain `taskboard.waqasobeidy.com` is authorized. Links return to the origin where requested, so preview/local hostnames must also be authorized in the corresponding project. Firebase delivers the email using its configured sender; no additional mail provider or secret is required. Firebase applies project email quotas; the form also provides a 60-second resend cooldown.

## Verification

```sh
npm test
firebase emulators:exec --project demo-taskboard --only auth 'npm test'
npm run typecheck
npm run lint
npm run build
```

Unit checks cover return-path allowlisting and verified-provider policy. The Auth emulator integration checks sending a link, wrong-email rejection, cross-device confirmation without saved browser state, replay rejection, and stable UID on repeat sign-in. Real inbox delivery and email-client redirects need a real inbox check; emulator delivery does not prove spam placement or production email delivery.

Reference: https://firebase.google.com/docs/auth/web/email-link-auth
