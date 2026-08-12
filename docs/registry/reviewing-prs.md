---
sidebar_position: 2
title: Reviewing pull requests
---

# Reviewing registry pull requests

Until the **onchain registry** exists, the GitHub pull request review is the trust gate of the ERC-7730 registry: whatever gets merged is what wallets will show to users at signing time. A wrong or malicious descriptor can make a dangerous transaction look harmless, so review accordingly.

This page is the working checklist for reviewers and maintainers. It complements — not replaces — the automated [CI checks](./ci-checks.md).

A PR review is deliberately **short and basic**: a plausibility and consistency check of whether structure, CI, and tests are in order, and whether anything looks off. It is *not* a security audit — source-level verification of descriptor accuracy is the job of [auditors](../auditors/what-audits-do.md), who attest descriptors after the merge. If you notice something deeper during review, leave a note for the auditors in the PR rather than blocking the merge on a full investigation.

## Review checklist

### 1. Are all CI checks green?

Nothing gets merged with failing checks. In particular, **validate descriptors** and **validate JSON schemas** must pass — see [CI checks](./ci-checks.md) for what they cover.

### 2. Did the linter fetch the ABI?

Check the lint warnings for a **"Could not fetch ABI"** message. When the linter cannot fetch a reference ABI for a deployment, the whole [display field validation](./ci-checks.md#1-display-field-validation-validatedisplayfieldslinter) is silently skipped — the check is green, but the descriptor's field paths were never verified against the contract. In that case, ask the author to [verify the contract's source code on Sourcify](https://sourcify.dev) and re-run the checks.

### 3. Are tests there, and did they run successfully?

Every added or changed descriptor must come with a `testsv2/<descriptor-name>.tests.json` file — the [Clear Signing Tests workflow](./ci-checks.md#clear-signing-tests-the-testing-workflow) fails without it.

- For PRs from forks the tests **only run once a maintainer adds the `run-tests` label**. Skim the changed files first (the label triggers workflows on the PR head), then add the label.
- The label only triggers when it is **added** — a later push by the author does **not** re-run the tests. After new commits, **remove and re-add the `run-tests` label** to trigger them again; before merging, make sure the test results are from the **latest commit**.
- Check the results comment: every test case must pass on all reference implementations (all ✅ in the table).

### 4. Do intents and hidden fields pass a sanity read?

One quick human pass over `display.formats` — minutes of work that catches the most dangerous descriptor mistakes:

- The `intent` says what the function actually does, in user terms. An approval must read as an approval; vague or technical intents ("Execute", the bare function name) defeat the purpose of clear signing.
- Fields marked `visible: "never"` are plausibly irrelevant to the signer (a nonce, the signer's own address). Value-bearing parameters — amounts, spenders, recipients, deadlines — must never be hidden.

This is a plausibility read, not verification against the contract source — that remains the auditors' job.

### 5. Attested descriptors are not modified

[Attestations](../descriptors/creating-a-descriptor.md#attestations) bind to the exact content of a descriptor — any change to the file invalidates them. If a descriptor already has attestations (files under `registry/<entity_name>/sigs/`), **do not accept changes to it**. Ask the submitter to add a **new descriptor file** instead (the filename carries the version): the existing attestations stay valid for the old descriptor, and the new one can be attested later.

This applies **transitively to shared files**: `common-*.json` files and the `ercs/` templates are inlined into descriptors via `includes`, so editing them silently changes every descriptor that includes them — attested ones too, and no CI check catches it. Reject shared-file edits that would alter an attested descriptor; here as well, the change belongs in a new shared file (or a new descriptor version) instead.

### 6. The index files are not touched

`index.calldata.json` and `index.eip712.json` are **generated** — CI regenerates them from the descriptors after the merge, so a descriptor PR should not modify them at all. Question any index diff you see.

The one exception: when a **new descriptor version replaces an attested descriptor** (see [item 5](#5-attested-descriptors-are-not-modified)), the index entry for the affected deployments has to switch from the old file to the new one — changing those specific entries is safe and expected.

A CI check that validates the index on every PR and fails when two descriptors claim the same deployment is landing with [#2884](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2884) — index hijacking of another project's contract is then caught automatically.

### 7. Registry structure is kept

The [repository layout](https://github.com/ethereum/clear-signing-erc7730-registry#registry-structure) is directory-based, and PRs must follow it:

- One entity per PR, all files inside `registry/<entity_name>/`.
- Descriptors named `calldata-<ContractName>.json` / `eip712-<MessageName>.json`; shared definitions as `common-*.json` (never with a `calldata`/`eip712` prefix); tests under `testsv2/`.

### 8. Ask for optional improvements

Check for these and ask the submitter where they apply. They are not blocking: if the author decides against them, merge the PR anyway.

- **Add `interpolatedIntent`.** A templated one-sentence intent with the field values substituted (e.g. `Swap {amountIn} for {tokenOut}`) gives wallets the recommended single-sentence display form. Descriptors with only a static `intent` still work, but `interpolatedIntent` is the better user experience.
- **Remove deprecated fields.** Descriptors migrated from the v1 format sometimes still carry fields the v2 format no longer uses — most notably embedded **ABIs** (`context.contract.abi`) and embedded EIP-712 schemas: in v2, ABIs are fetched from Sourcify/Etherscan and EIP-712 format keys are the schema. Ask to drop such leftovers.

## Deeper review and attestations

For attestation-grade review — verifying the descriptor against verified source code, checking intent mutability through proxies and mutable state, and publishing a signed EAS attestation — see [What audits do](../auditors/what-audits-do.md) and the [auditor guide](../auditors/auditor-guide.mdx). Regular PR review keeps the registry consistent; attestations add the cryptographic trust layer wallets can build policy on.
