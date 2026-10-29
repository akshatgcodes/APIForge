# Changelog

All notable changes to **APIForge** are documented here.

---

## [Unreleased]

---

## [0.1.0] — 2026-10-29

### ✨ Added
- Collections, folders and requests with autosave, reordering, moving and duplicating
- `{{variable}}` templates in URL, headers and body, nested variables and `$uuid`/`$timestamp`/`$isoTimestamp`/`$randomInt` built-ins
- Extract rules (JSON path, header, status) that write into the collection's variables, plus click-to-extract from the response tree
- Collection and folder runner with stop-on-failure
- Response viewer: JSON tree, raw, headers, timing, size, redirects
- Request proxy with SSRF protection on every redirect hop
- Import of APIForge exports and Postman v2.1 collections; JSON export; copy as cURL
- Built-in demo notes API and an example collection that chains login → token → notes
- Single-password login

### 🧪 Tests
- Proxy (SSRF, redirects, credential stripping, limits), collections API, Postman import and demo API with pytest
- Template engine, path parser, extraction, request preparation, runner and editor state with Vitest

---

[Unreleased]: https://github.com/akshatgcodes/APIForge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/akshatgcodes/APIForge/releases/tag/v0.1.0

---

<div align="center">

<h3>Akshat Gupta</h3>

<a href="https://akshatgcodes.in"><img src="https://img.shields.io/badge/Website-akshatgcodes.in-111111?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
<a href="https://linkedin.com/in/akshatgcodes"><img src="https://img.shields.io/badge/LinkedIn-akshatgcodes-0A66C2?style=flat-square" alt="LinkedIn"></a>
<a href="https://github.com/akshatgcodes"><img src="https://img.shields.io/badge/GitHub-akshatgcodes-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"></a>
<a href="mailto:akshatgcodes@gmail.com"><img src="https://img.shields.io/badge/Email-akshatgcodes%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white" alt="Email"></a>

</div>
