# Security Policy

## Supported versions

Only the latest version on `main` receives security fixes. There is no public deployment yet.

| Version | Supported |
|---|---|
| Latest (`main`) | ✅ |
| Older releases | ❌ |

---

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report privately through either channel:

1. **GitHub:** go to the [Security tab → Report a vulnerability](../../security/advisories/new) (preferred)
2. **Email:** [akshatgcodes@gmail.com](mailto:akshatgcodes@gmail.com) with the subject `Security: APIForge`

Please include:

- What the issue is and where it lives (URL, endpoint, file)
- Steps to reproduce, or a minimal proof of concept
- The impact you think it has
- Any suggested fix (optional)

---

## What to expect

| Step | Timeline |
|---|---|
| Acknowledgement of your report | within **72 hours** |
| Initial assessment and severity | within **7 days** |
| Fix released for confirmed issues | as soon as possible, based on severity |

You'll be kept updated throughout, and credited in the release notes once it's fixed (unless you'd rather stay anonymous).

---

## Scope

**In scope**

- This repository's source code
- Login and session cookies (`backend/app/auth.py`)
- The request proxy (`backend/app/proxy.py`): reaching private or link-local addresses while `ALLOW_PRIVATE_TARGETS=false`, including through redirects; leaking `Authorization` or `Cookie` headers to a different host on redirect
- Reading or changing collections without the session
- The demo API (`backend/app/demo.py`): forging tokens or reading another user's notes

**Out of scope**

- Vulnerabilities in third-party services (e.g. hosting providers). Report those to the vendor.
- Denial-of-service, spam or volumetric attacks
- DNS rebinding between the proxy's address check and its connection (a known limitation, see [docs/DECISIONS.md](docs/DECISIONS.md))
- Social engineering
- Findings from automated scanners with no demonstrated impact

Please act in good faith: don't access or modify other users' data, and don't degrade the service while testing.

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
