# Mail setup for driftzo.com

Get verification and transactional emails sending from **noreply@driftzo.com** (or a subdomain) using Resend.

---

## 1. Add the domain in Resend

1. Go to **[resend.com/domains](https://resend.com/domains)** and sign in.
2. Click **Add Domain**.
3. Enter **driftzo.com** (or a subdomain like **send.driftzo.com** if you prefer).
4. Click **Add** – Resend will show the DNS records you need.

---

## 2. Add DNS records at your registrar

Where you bought driftzo.com (Namecheap, Cloudflare, GoDaddy, etc.) open **DNS settings** for driftzo.com and add the records Resend shows.

You’ll get:

- **SPF (TXT)** – e.g. name: `@` or `driftzo.com`, value: something like `v=spf1 include:resend.com ~all`
- **DKIM (TXT)** – e.g. name: `resend._domainkey` (or similar), value: long string Resend gives you
- Sometimes an **MX** record for bounce handling (Resend will show the exact host and value)

Add each record **exactly** as Resend shows (name, type, value).  
Resend has guides per provider: **[resend.com/docs/knowledge-base](https://resend.com/docs/knowledge-base)** (e.g. Namecheap, Cloudflare, GoDaddy).

---

## 3. Verify in Resend

1. After saving DNS, back in Resend click **Verify** (or “Verify DNS records”).
2. Wait a few minutes (up to 72 hours in rare cases). Status should change to **Verified**.

If it stays **Pending** or **Failed**, double‑check:
- No typos in DNS names/values.
- You’re editing DNS for **driftzo.com** (or the exact subdomain you added).
- You’ve waited at least 5–10 minutes and refreshed the Resend page.

---

## 4. Set the sender in your app

Once the domain is **Verified** in Resend:

**Local (.env)**

```env
RESEND_FROM=Driftzo <noreply@driftzo.com>
```

If you used a subdomain (e.g. send.driftzo.com), use that instead:

```env
RESEND_FROM=Driftzo <noreply@send.driftzo.com>
```

**Render**

1. Open your Driftzo backend service → **Environment**.
2. Set **RESEND_FROM** = `Driftzo <noreply@driftzo.com>` (or your subdomain address).
3. Save so the service redeploys.

No code changes are needed; the app already uses `RESEND_FROM` for the “From” address.

---

## 5. Test

- Trigger a verification email (e.g. register with a new email).
- Check inbox (and spam); it should be from **Driftzo \<noreply@driftzo.com\>**.

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | Resend → Domains → Add **driftzo.com** (or send.driftzo.com) |
| 2 | At your domain registrar, add **SPF** and **DKIM** (and any MX) as Resend shows |
| 3 | Resend → **Verify** → wait until status is **Verified** |
| 4 | Set **RESEND_FROM** = `Driftzo <noreply@driftzo.com>` in .env and on Render |
| 5 | Redeploy backend and send a test verification email |

After this, mailing from driftzo.com is set up.
