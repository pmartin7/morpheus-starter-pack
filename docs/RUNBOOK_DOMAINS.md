# RUNBOOK_DOMAINS.md

Custom domain setup on Vercel, written for an agent operator. The
`init-project` skill links here; this runbook owns the DNS/TLS details.

Core rule: DNS propagation takes minutes to hours. Act only on explicit API
errors — not on dashboard warnings that appear before nameserver verification.

## 1) Switch Nameservers at the Registrar

Point the domain's nameservers to Vercel DNS:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

This is done at the registrar (Namecheap, Cloudflare Registrar, etc.), not in
Vercel. Then add the domain to the Vercel project.

## 2) Check Propagation and Verification State

```bash
# Has the nameserver switch propagated?
dig NS <domain>

# Does Vercel DNS answer for the domain?
dig A <domain> @ns1.vercel-dns.com
```

Authoritative state lives in the Vercel API:

```
GET /v5/domains/<domain>
```

Two fields matter:

| Field | Meaning |
|-------|---------|
| `nsVerifiedAt` | non-null once Vercel has verified the nameservers |
| `zone` | the DNS zone Vercel is serving for the domain |

Until `nsVerifiedAt` is set, nothing downstream (zone, certs) will work — and
that is normal, not an error.

## 3) Confusing-but-Normal Intermediate States

- **"DNS zone not enabled" / "cannot solve dns-01 challenge"** in the
  dashboard *before* nameserver verification: expected. Do nothing; wait for
  `nsVerifiedAt`.
- **Apex + `www` certificates** auto-issue within minutes *after*
  `nsVerifiedAt`. No action needed.

## 4) The Straggler: Subdomain Certificates

Subdomain certs (e.g. `staging.<domain>`) may **not** auto-issue even after
apex and `www` are green. Force issuance:

```
POST /v7/certs
{"cns": ["staging.<domain>"]}
```

## 5) When to Wait vs. Act

| Signal | Response |
|--------|----------|
| Dashboard warning, `nsVerifiedAt` still null | wait (propagation) |
| `nsVerifiedAt` set, apex/www certs pending a few minutes | wait |
| `nsVerifiedAt` set, subdomain cert still missing | act — force via `/v7/certs` |
| Explicit API error on a cert or domain call | act on that error |

## 6) Redirect Domains (e.g. www → apex)

Add the redirecting domain to the project with a redirect target:

```
POST /v10/projects/{id}/domains
{
  "name": "www.<domain>",
  "redirect": "<domain>",
  "redirectStatusCode": 308
}
```

## 7) Firebase Authorized Domains

Every custom domain (including `staging.<domain>`) must be added to Firebase
Auth → Settings → **Authorized domains**, or sign-in on that domain breaks
with an unauthorized-domain error.
