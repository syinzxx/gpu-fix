# WhatsApp Cloud API Setup Guide

This guide walks you through connecting GPU Fix Shop to the Meta WhatsApp Cloud API so real messages are delivered to customers — free of charge.

---

## 1. Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with your Facebook account.
2. Click **My Apps → Create App**.
3. Choose **Business** as the app type.
4. Fill in the app name (e.g. "GPU Fix Shop") and your business email, then click **Create App**.
5. On the app dashboard, scroll to the product list and click **Set Up** next to **WhatsApp**.

---

## 2. Get a Free Test Number (Immediate — No Business Verification Needed)

After adding the WhatsApp product:

1. In the left sidebar, go to **WhatsApp → API Setup**.
2. Meta provides a free test phone number automatically. Copy the **Phone number ID** — this is your `WHATSAPP_PHONE_NUMBER_ID`.
3. Generate a **temporary access token** (valid 24 h) — this is your `WHATSAPP_ACCESS_TOKEN` for development.
4. Add up to **5 verified recipient numbers**: scroll to "Send and receive messages", click **Add phone number**, and verify via OTP. These are the only numbers the test setup can message.

---

## 3. Set Environment Variables

Open the `.env` file in the project root and fill in:

```env
WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
WHATSAPP_ACCESS_TOKEN="your-temp-or-permanent-token"
WHATSAPP_VERIFY_TOKEN="gpu-fix-verify-2026"
NEXT_PUBLIC_APP_URL="https://your-public-domain.com"
```

Restart the dev server after changing `.env`.

---

## 4. Create the `ticket_update` Message Template

Business-initiated messages (sent outside a 24-hour window from the customer) must use an approved template.

1. Go to [business.facebook.com](https://business.facebook.com) → **WhatsApp Manager**.
2. Select your WhatsApp Business Account, then go to **Account tools → Message templates**.
3. Click **Create template** and fill in:

   | Field | Value |
   |-------|-------|
   | Category | **Utility** |
   | Name | `ticket_update` |
   | Language | English |

4. In the **Body** section, enter exactly:

   ```
   Hi {{1}}, ticket {{2}}: {{3}}. Track: {{4}}
   ```

   The four variables map to: `{{1}}` = customer name, `{{2}}` = ticket code, `{{3}}` = status sentence, `{{4}}` = tracking URL.

5. Submit for review. Utility templates are usually approved within minutes.

> **Note:** The test phone number can send templates immediately before approval. Use it for development.

---

## 5. Configure the Webhook

The webhook lets Meta notify the app when messages are delivered, read, or when a customer replies.

### For local development — use a cloudflared tunnel

```bash
# Install cloudflared (free, no account needed for temporary tunnels)
# Windows:
winget install Cloudflare.cloudflared

# Start a tunnel pointing at your dev server
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://xxxxx.trycloudflare.com` URL.

### In the Meta developer console

1. Go to **WhatsApp → Configuration** in your app dashboard.
2. Under **Webhook**, click **Edit**.
3. Set:
   - **Callback URL**: `https://xxxxx.trycloudflare.com/api/whatsapp/webhook`
   - **Verify token**: `gpu-fix-verify-2026` (matches `WHATSAPP_VERIFY_TOKEN` in `.env`)
4. Click **Verify and save**. The console sends a GET request; the app echoes the challenge — you should see **Verified**.
5. Under **Webhook fields**, subscribe to **messages**.

### For production

Use your public domain (e.g. `https://gpufix.example.com/api/whatsapp/webhook`) — see `docs/deploy.md`.

---

## 6. Get a Permanent Access Token (Production)

Temporary tokens expire after 24 hours. For production:

1. Go to [business.facebook.com](https://business.facebook.com) → **Settings → System users**.
2. Click **Add** → name it (e.g. "GPU Fix Bot") → role: **Admin**.
3. Click **Generate new token** → select your app → grant **whatsapp_business_messaging** and **whatsapp_business_management** permissions.
4. Copy the token — it never expires unless revoked. Set it as `WHATSAPP_ACCESS_TOKEN` in your production environment.

---

## 7. Register a Real Business Phone Number (Production)

1. In the Meta app, go to **WhatsApp → API Setup → Add phone number**.
2. The number must **not** be active on the WhatsApp mobile app. Use a dedicated SIM or a virtual number.
3. Verify via SMS/call OTP.
4. After verification, the new number's **Phone number ID** replaces the test number's ID in `WHATSAPP_PHONE_NUMBER_ID`.

---

## Cost Summary

| Item | Cost |
|------|------|
| Meta developer account | Free |
| Test phone number | Free |
| Utility template messages (business-initiated, outside 24h window) | ~$0.005–0.01 per message (Egypt tier) |
| Messages inside a 24-hour customer-opened window | Free |
| Inbound messages | Free |

Most repair shops send 1–3 messages per ticket. At 50 tickets/month, the cost is under $1.50/month.
