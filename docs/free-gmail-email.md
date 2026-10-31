# Free email with Gmail API

This alternative sends verification, reset and notification emails through a Gmail
account over HTTPS. It needs no purchased domain and works around free Render's
blocked SMTP ports. Resend remains available when `EMAIL_PROVIDER=resend`.

The Gmail account owner must explicitly authorize sending. Do not share the client
secret, refresh token or Google password in chat. The provider uses only the
`https://www.googleapis.com/auth/gmail.send` scope, not access to read the inbox.

## One-time Google setup

1. Open Google Cloud Console, select/create your project and enable **Gmail API**.
2. Set up the OAuth consent screen. For an external app in **Testing**, add the
   Gmail account that will send emails as a test user.
3. Create an OAuth client of type **Web application**. Add
   `https://developers.google.com/oauthplayground` as an authorized redirect URI.
   Use a separate client from normal Google login if possible.
4. Open <https://developers.google.com/oauthplayground/>. In the gear settings,
   enable **Use your own OAuth credentials**, then enter that client's ID and secret.
5. In Step 1 enter `https://www.googleapis.com/auth/gmail.send`, click
   **Authorize APIs**, sign in with the sending Gmail account and grant permission.
6. In Step 2 click **Exchange authorization code for tokens**. Copy the refresh
   token directly to backend env/Render. Do not paste it into chat or source control.
7. Set these values on Render and in the desired backend env profile:

```env
EMAIL_PROVIDER=gmail
EMAIL_FROM=your-sending-address@gmail.com
GMAIL_CLIENT_ID=your-oauth-client-id
GMAIL_CLIENT_SECRET=your-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
```

Use the Gmail account that authorized the app as `EMAIL_FROM`. Restart/redeploy
the API. Your previous Resend values can remain stored for switching back, but
never put these Gmail credentials in frontend `NEXT_PUBLIC_` variables.

The Gmail API uses Gmail's account sending limits. Google says external OAuth apps
in Testing usually receive refresh tokens that expire after seven days for this
scope; repeat authorization when expired, or address Google's production OAuth
verification requirements. API acceptance does not guarantee inbox delivery.
Because Gmail's send endpoint has no idempotency key, a retry after an ambiguous
network failure can occasionally duplicate an email.

- <https://developers.google.com/workspace/gmail/api/guides/sending>
- <https://developers.google.com/identity/protocols/oauth2>
- <https://render.com/docs/free>
