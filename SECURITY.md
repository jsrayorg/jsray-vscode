# Security Policy

## Reporting a vulnerability

If you find a security vulnerability, **do not** open a public issue. Please report it privately:

- Email: **support@jsray.org**
- Official site: https://jsray.org

We aim to acknowledge reports within 72 hours.

## Scope

This extension contributes color themes and runs the bundled Core inside the built-in Markdown preview webview:

- The preview adapter re-renders fenced code with Core's escaping intact. Markdown content that produces unescaped HTML in the preview is a **high-severity** vulnerability.
- Color themes are generated data files; they cannot execute code.
- The extension declares no network access and reads no workspace files beyond what the preview already renders.

Vulnerabilities in the bundled JSRay Core snapshot belong to
[JSRay Core](https://github.com/JSRayCore/JSRay) — report them the same way, and
fixes reach this project through the next Core sync.

Out of scope:
- Issues that only reproduce with a renderer other than JSRay Core swapped in through the adapter hooks.
- Known catastrophic backtracking in grammar rules — please report it as an issue, not as a vulnerability.

## Supported versions

| Version | Security updates |
|---|---|
| 0.0.1-beta | ✅ Current public beta |
| 0.0.1-internal.∗ | ❌ Superseded by the public beta |
| Stable | Not yet released |
