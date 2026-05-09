# Security Policy

## Reporting a vulnerability

Please report security issues privately to **tomkooy@beeflow.nl**. Do not
open a public GitHub issue.

We aim to acknowledge reports within 2 business days, share a remediation
plan within 7 days, and ship a fix within 30 days for high-severity issues.

## Scope

This repository contains the Bee Flow **frontend** SPA. In-scope concerns
include:

- XSS / DOM-based vulnerabilities in the React tree
- Supply-chain risks (compromised npm dependencies)
- Leakage of secrets through client-side code (env-vars, hardcoded tokens)
- Auth-token handling, session-cookie behaviour
- Open redirect issues, clickjacking, CSRF on state-changing client code

The companion server (`bee-flow-server`) has its own security policy.

## Out of scope

- Misconfigurations of self-hosted instances by their operators
- Issues in third-party services Bee Flow integrates with (Nextcloud, OAuth
  providers, model APIs) — please report to the respective vendors
- Theoretical vulnerabilities without a concrete exploitation path
- Findings on demo / staging instances that don't reproduce against the
  released code in `main`

## Disclosure

We follow a **coordinated disclosure** model: once a fix is shipped and
deployed to our managed instances, we publish a security advisory on the
[GitHub Security Advisories](https://github.com/Bee-Flow/hive/security/advisories)
page crediting the reporter (unless they ask for anonymity).

## Bounty

We don't currently run a paid bounty program. We do acknowledge reporters
publicly (with permission) and are happy to send Bee Flow swag for
valuable findings.

## Versions covered

Only the latest minor release on the `main` branch is supported. Older
versions may receive backported fixes for critical issues at our discretion.

## Encryption

If you'd like to encrypt your report, please request our PGP key by mail to
**tomkooy@beeflow.nl** — we'll respond with the public key.
