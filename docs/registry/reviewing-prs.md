---
sidebar_position: 2
title: Reviewing pull requests
---

# Reviewing registry pull requests

Until the **onchain registry** exists, the GitHub pull request review is the trust gate of the ERC-7730 registry: whatever gets merged is what wallets will show to users at signing time. A wrong or malicious descriptor can make a dangerous transaction look harmless, so review accordingly.

This page is the working checklist for reviewers and maintainers. It complements — not replaces — the automated [CI checks](./ci-checks.md).

A PR review is deliberately **short and basic**: the mechanical rules are enforced by CI, so what remains is a plausibility check of the things only a human can judge. It is *not* a security audit — source-level verification of descriptor accuracy is the job of [auditors](../auditors/what-audits-do.md), who attest descriptors after the merge. If you notice something deeper during review, leave a note for the auditors in the PR rather than blocking the merge on a full investigation.

## Review checklist

### 1. Are all CI checks green?

Nothing gets merged with failing checks. CI covers the mechanical review completely — [linting and schema validation](./ci-checks.md), [test presence and results](./ci-checks.md#clear-signing-tests-the-testing-workflow), [index collisions](./ci-checks.md#-validate-index) (no hijacking of another project's deployments), [file naming](./ci-checks.md#-validate-file-names), and [immutability of attested descriptors](./ci-checks.md#-validate-attested-descriptors). None of these needs a manual pass anymore.

The optional improvements (adding `interpolatedIntent`, dropping deprecated fields) are also suggested automatically by the advisory **recommendations comment** — nothing to do there either; whether the author applies them is their call.

### 2. Did the linter fetch the ABI?

Check the lint warnings for a **"Could not fetch ABI"** message. When the linter cannot fetch a reference ABI for a deployment, the whole [display field validation](./ci-checks.md#1-display-field-validation-validatedisplayfieldslinter) is silently skipped — the check is green, but the descriptor's field paths were never verified against the contract. In that case, ask the author to [verify the contract's source code on Sourcify](https://sourcify.dev) and re-run the checks.

### 3. Do intents and hidden fields pass a sanity read?

One quick human pass over `display.formats` — minutes of work that catches the most dangerous descriptor mistakes:

- The `intent` says what the function actually does, in user terms. An approval must read as an approval; vague or technical intents ("Execute", the bare function name) defeat the purpose of clear signing.
- Fields marked `visible: "never"` are plausibly irrelevant to the signer (a nonce, the signer's own address). Value-bearing parameters — amounts, spenders, recipients, deadlines — must never be hidden.

This is a plausibility read, not verification against the contract source — that remains the auditors' job.

### 4. One entity per PR

A PR should only touch files inside a single `registry/<entity_name>/` folder. Be suspicious of PRs that modify or delete files of a *different* entity than the one they claim to change — CI validates naming and index consistency, but not whose folder a PR touches.

## Deeper review and attestations

For attestation-grade review — verifying the descriptor against verified source code, checking intent mutability through proxies and mutable state, and publishing a signed EAS attestation — see [What audits do](../auditors/what-audits-do.md) and the [auditor guide](../auditors/auditor-guide.mdx). Regular PR review keeps the registry consistent; attestations add the cryptographic trust layer wallets can build policy on.
