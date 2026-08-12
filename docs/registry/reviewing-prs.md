---
sidebar_position: 2
title: Reviewing pull requests
---

# Reviewing registry pull requests

Until the **onchain registry** exists, the GitHub pull request review is the trust gate of the ERC-7730 registry: whatever gets merged is what wallets will show to users at signing time. A wrong or malicious descriptor can make a dangerous transaction look harmless, so review accordingly.

This page is the working checklist for reviewers and maintainers. It complements — not replaces — the automated [CI checks](./ci-checks.md).

A PR review is deliberately **short and basic**: a plausibility and consistency check of who is submitting, whether structure, CI, and tests are in order, and whether anything looks off. It is *not* a security audit — source-level verification of descriptor accuracy is the job of [auditors](../auditors/what-audits-do.md), who attest descriptors after the merge. If you notice something deeper during review, leave a note for the auditors in the PR rather than blocking the merge on a full investigation.

## Review checklist

### 1. Is the PR author associated with the project?

Descriptors state who the protocol **owner** is (`metadata.owner`); the person submitting should plausibly act for that project.

- Check the author's GitHub profile: are they a member of the project's GitHub organization, or do their contributions link them to the project?
- Cross-check the descriptor's `metadata.info.url` against the project's real website, and the deployment addresses against the project's published contract addresses / docs.
- If the association is unclear, ask in the PR — e.g. for a link from an official channel (project docs, website, or a post from an official account) referencing the submission.
- Third-party submissions are not forbidden, but they deserve extra scrutiny of every displayed intent and field, since the submitter doesn't speak for the protocol.

### 2. Are all CI checks green?

Nothing gets merged with failing checks. In particular, **validate descriptors** and **validate JSON schemas** must pass — see [CI checks](./ci-checks.md) for what they cover.

### 3. Do the linter warnings look fine?

[Warnings don't fail CI](./ci-checks.md#what-the-linter-checks-in-detail), but they are part of the review: open the lint annotations on the PR and check whether any of them looks problematic rather than intentional.

- **Missing display field / missing display format** — fine when a parameter or function is consciously excluded, problematic when it leaves a value-bearing parameter or a common user-facing function blind-signed.
- **Unknown selector** — may indicate a stale descriptor or a wrong deployment address.
- **Truncation warnings** — labels or intents that will be cut off on hardware wallet screens.

Ask the submitter about any warning that looks unintentional.

### 4. Are tests there, and did they run successfully?

Every added or changed descriptor must come with a `testsv2/<descriptor-name>.tests.json` file — the [Clear Signing Tests workflow](./ci-checks.md#clear-signing-tests-the-testing-workflow) fails without it.

- For PRs from forks the tests **only run once a maintainer adds the `run-tests` label**. Skim the changed files first (the label triggers workflows on the PR head), then add the label.
- The label only triggers when it is **added** — a later push by the author does **not** re-run the tests. After new commits, **remove and re-add the `run-tests` label** to trigger them again; before merging, make sure the test results are from the **latest commit**.
- Check the results comment: every test case must pass on all reference implementations (all ✅ in the table).
- Check the test cases themselves: do they cover each function/message the descriptor formats? Do the `expected` blocks actually describe what the transaction does? A test that expects a wrong rendering is worse than no test.

### 5. Do intents and hidden fields pass a sanity read?

One quick human pass over `display.formats` — minutes of work that catches the most dangerous descriptor mistakes:

- The `intent` says what the function actually does, in user terms. An approval must read as an approval; vague or technical intents ("Execute", the bare function name) defeat the purpose of clear signing.
- Fields marked `visible: "never"` are plausibly irrelevant to the signer (a nonce, the signer's own address). Value-bearing parameters — amounts, spenders, recipients, deadlines — must never be hidden.

This is a plausibility read, not verification against the contract source — that remains the auditors' job.

### 6. Attested descriptors are not modified

[Attestations](../descriptors/creating-a-descriptor.md#attestations) bind to the exact content of a descriptor — any change to the file invalidates them. If a descriptor already has attestations (files under `registry/<entity_name>/sigs/`), **do not accept changes to it**. Ask the submitter to add a **new descriptor file** instead (the filename carries the version): the existing attestations stay valid for the old descriptor, and the new one can be attested later.

This applies **transitively to shared files**: `common-*.json` files and the `ercs/` templates are inlined into descriptors via `includes`, so editing them silently changes every descriptor that includes them — attested ones too, and no CI check catches it. Reject shared-file edits that would alter an attested descriptor; here as well, the change belongs in a new shared file (or a new descriptor version) instead.

### 7. The index files are not touched

`index.calldata.json` and `index.eip712.json` are **generated** — CI regenerates them from the descriptors after the merge, so a descriptor PR should not modify them at all. Question any index diff you see.

The one exception: when a **new descriptor version replaces an attested descriptor** (see [item 6](#6-attested-descriptors-are-not-modified)), the index entry for the affected deployments has to switch from the old file to the new one — changing those specific entries is safe and expected.

A CI check that validates the index on every PR and fails when two descriptors claim the same deployment is landing with [#2884](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2884) — index hijacking of another project's contract is then caught automatically.

### 8. Registry structure is kept

The [repository layout](https://github.com/ethereum/clear-signing-erc7730-registry#registry-structure) is directory-based, and PRs must follow it:

- One entity per PR, all files inside `registry/<entity_name>/`.
- Descriptors named `calldata-<ContractName>.json` / `eip712-<MessageName>.json`; shared definitions as `common-*.json` (never with a `calldata`/`eip712` prefix); tests under `testsv2/`.

### 9. Ask for optional improvements

Check for these and ask the submitter where they apply. They are not blocking: if the author decides against them, merge the PR anyway.

- **Add `interpolatedIntent`.** A templated one-sentence intent with the field values substituted (e.g. `Swap {amountIn} for {tokenOut}`) gives wallets the recommended single-sentence display form. Descriptors with only a static `intent` still work, but `interpolatedIntent` is the better user experience.
- **Remove deprecated fields.** Descriptors migrated from the v1 format sometimes still carry fields the v2 format no longer uses — most notably embedded **ABIs** (`context.contract.abi`) and embedded EIP-712 schemas: in v2, ABIs are fetched from Sourcify/Etherscan and EIP-712 format keys are the schema. Ask to drop such leftovers.

## Deeper review and attestations

For attestation-grade review — verifying the descriptor against verified source code, checking intent mutability through proxies and mutable state, and publishing a signed EAS attestation — see [What audits do](../auditors/what-audits-do.md) and the [auditor guide](../auditors/auditor-guide.mdx). Regular PR review keeps the registry consistent; attestations add the cryptographic trust layer wallets can build policy on.
