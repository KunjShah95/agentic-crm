# WhatsApp: getting real credentials

Everything the app needs comes from two places: **developers.facebook.com** (the app)
and **business.facebook.com** (the business portfolio). WhatsApp is the only
messaging channel in this build.

## 0. Before anything else

Apply the schema the two-way rail needs (adds `Activity.externalId`,
`Activity.status`, `SocialConnection.metadata`):

```bash
npm run db:migrate      # prisma migrate dev
```

Then generate the two secrets this app needs that Meta does *not* give you:

```powershell
# Token vault key — encrypts access tokens at rest. Set BEFORE linking anything.
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Webhook verify token — any random string; you paste this same value into Meta.
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Cron protection for /api/cron/whatsapp-drain
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 1. Create the app

1. https://developers.facebook.com → **My Apps → Create App**.
2. Choose **Business** as the app type (Other → Business if the flow differs).
3. On the dashboard, **Add products → WhatsApp → Set up**.
4. Connect (or create) a **Business portfolio** and accept the WhatsApp terms.

Meta instantly provisions a **test number** and a **Test WhatsApp Business
Account**. You can build the whole integration on that for free.

## 2. Collect the IDs (WhatsApp → API Setup)

This page is the source for three of the values:

| On screen | Env var | Notes |
| --- | --- | --- |
| **Phone number ID** | `WHATSAPP_PHONE_NUMBER_ID` | Numeric ID, *not* the phone number itself |
| **WhatsApp Business Account ID** | `WHATSAPP_WABA_ID` | The WABA, used for account listing |
| **Temporary access token** | — | **Do not use this.** See §3 |

## 3. Get a token that does not expire in 24 hours

The token on API Setup is a *temporary user* token and dies within a day. It is
the single most common reason "it worked yesterday" shows up in a bug report, so
create a **System User access token** instead — those can be made non-expiring.

1. https://business.facebook.com → **Settings (⚙) → Users → System users → Add**.
2. Name it (e.g. `estate360-api`), set role **Admin**, **Create System User**.
3. Select the new system user → **Assign assets**:
   - **Apps** tab → your app → toggle **Manage app** / Full control.
   - **WhatsApp Accounts** tab → your WABA → **Full control**.
   - Confirm with **Assign assets**.
4. **Generate new token** on that user:
   - Select the app → Next.
   - **Token expiry: Never** (or 60 days if "Never" is unavailable pre-verification).
   - Grant `whatsapp_business_messaging` **and** `whatsapp_business_management`.
5. Copy it — **it is shown exactly once**. This is `WHATSAPP_TOKEN`.

If "Never" is not offered, your portfolio needs business verification
(Business Settings → **Permissions → Security center** / Business info).

## 4. App ID and App Secret (App settings → Basic)

- **App ID** → `WHATSAPP_APP_ID` (needed for OAuth linking + webhook subscription)
- **App Secret** → `WHATSAPP_APP_SECRET`

The app secret is what the code uses to validate Meta's
`X-Hub-Signature-256` header. Without it, **inbound messages are rejected** —
the webhook fails closed rather than trusting unauthenticated writes.

## 5. Give the app a public URL

Meta can only POST to a publicly reachable HTTPS endpoint. It cannot see
`localhost`.

```powershell
# Dev tunnel (keep it running)
ngrok http 3000
```

Put the https tunnel host into `APP_URL` so the settings page displays the right
callback URL, e.g. `APP_URL="https://your-tunnel.ngrok-free.app"`. In production
this is just your Vercel domain.

## 6. Register the webhook in Meta

1. App dashboard → **WhatsApp → Configuration** → **Webhook → Edit**.
2. **Callback URL**: the value shown on **Settings → WhatsApp** in your app
   (`https://<host>/api/whatsapp/webhook`).
3. **Verify token**: paste the string you generated in §0. Set the identical
   value as `WHATSAPP_VERIFY_TOKEN`.
4. Click **Verify and save**. Meta sends a `GET`; our handler answers the
   `hub.challenge` only if the token matches.
5. Scroll to **Webhook fields** → **Message notifications** (`messages`) →
   **Subscribe**. Do the same for *Message template status update* if you add
   templates later.

You can also let the app subscribe programmatically — **Settings → WhatsApp →
Re-subscribe webhooks** calls `POST /{app-id}/subscriptions`. That path needs
`WHATSAPP_APP_ID`.

## 7. Fill in `.env`

```dotenv
DATABASE_URL="..."
AUTH_SECRET="..."
AUTH_TRUST_HOST=true
APP_URL="http://localhost:3000"        # or your ngrok/Vercel https URL

# Token vault — set this BEFORE the first connection, or rotating AUTH_SECRET
# later will silently destroy every stored token.
SOCIAL_TOKEN_KEY="<from §0>"

# Send
WHATSAPP_TOKEN="<system user token from §3>"
WHATSAPP_PHONE_NUMBER_ID="<from §2>"
WHATSAPP_WABA_ID="<from §2>"

# Receive
WHATSAPP_APP_SECRET="<from §4>"
WHATSAPP_VERIFY_TOKEN="<from §0, must match Meta>"

# Linking + subscriptions
WHATSAPP_APP_ID="<from §4>"

# Cron endpoint
CRON_SECRET="<from §0>"

# Dev convenience only — never set in production
# WHATSAPP_ALLOW_MOCK=true            # visibly-labelled fake sends
# WHATSAPP_ENFORCE_REPLY_WINDOW=false # bypass the 24h rule while testing
```

Restart `next dev` so the new env is picked up.

## 8. Prove it works

**a) Does the token reach Meta?**

```powershell
curl "https://graph.facebook.com/v23.0/WHATSAPP_PHONE_NUMBER_ID?fields=display_phone_number,verified_name,quality_rating&access_token=WHATSAPP_TOKEN"
```

A JSON body with your number = credentials are good. Error `190` = bad/expired
token; error `100` with "unrecognized object" = wrong ID (you used the phone
number instead of the number ID).

**b) Can you send?** Use the Meta **API Setup** test send, or in the app: open a
contact with a phone number and reply. Note: a free-form reply is only allowed
inside 24h of that contact messaging you first.

**c) Can you receive?** On the test number you may only message **up to five
verified recipient numbers** — register yours at WhatsApp → API Setup →
"To" → Manage number list. Then send from your phone to the test number and
watch the inbox; it should appear within a couple of seconds.

**d) Did Meta accept the handshake?** In the app, **Settings → WhatsApp → Test
connection**. That reads live from Graph and will flip the connection to
`needs reauth` if the token is dead.

## Where each value lands in code

`modules/whatsapp/config.ts` (env names + readiness),
`modules/whatsapp/cloud.ts` (Graph calls),
`modules/social/providers/whatsapp.ts` (verify / parse / send),
`modules/social/ingest.ts` (tenant routing + idempotent writes),
`app/api/whatsapp/webhook/route.ts` (the only inbound rail).

## Gotchas

- **24h temp token** — use the §3 system-user token, or you will be back here tomorrow.
- **Test-mode recipient limit** — 5 registered numbers only; unregistered recipients get nothing.
- **History is not available** — Meta delivers messages from the moment you
  subscribe onward. There is no endpoint to backfill past conversations.
- **Localhost webhooks will never fire** — tunnel, or deploy.
- **`Activity.status` is outbound-only**; inbound rows leave it null.
- **Rotation** — changing `SOCIAL_TOKEN_KEY` makes existing encrypted tokens
  undecryptable. Re-link after rotating.
