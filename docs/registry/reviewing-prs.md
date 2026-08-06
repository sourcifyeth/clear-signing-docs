---
sidebar_position: 2
title: Reviewing pull requests
---

# Reviewing registry pull requests

Until the **onchain registry** exists, the GitHub pull request review is the trust gate of the ERC-7730 registry: whatever gets merged is what wallets will show to users at signing time. A wrong or malicious descriptor can make a dangerous transaction look harmless, so review accordingly.

This page is the working checklist for reviewers and maintainers. It complements — not replaces — the automated [CI checks](./ci-checks.md).

## Review checklist

### 1. Is the PR author associated with the project?

Descriptors state who the protocol **owner** is (`metadata.owner`); the person submitting should plausibly act for that project.

- Check the author's GitHub profile: are they a member of the project's GitHub organization, or do their contributions link them to the project?
- Cross-check the descriptor's `metadata.info.url` against the project's real website, and the deployment addresses against the project's published contract addresses / docs.
- If the association is unclear, ask in the PR — e.g. for a link from an official channel (project docs, website, or a post from an official account) referencing the submission.
- Third-party submissions are not forbidden, but they deserve extra scrutiny of every displayed intent and field, since the submitter doesn't speak for the protocol.

### 2. Are all CI checks green?

Nothing gets merged with failing checks. In particular:

- **validate descriptors** and **validate JSON schemas** must pass — see [CI checks](./ci-checks.md) for what they cover.
- Also skim CI **warnings** (annotations on the PR): missing display fields, uncovered selectors, or truncation warnings don't fail CI but often point at real gaps a reviewer should question.

### 3. Are tests there, and did they run successfully?

Every added or changed descriptor must come with a `testsv2/<descriptor-name>.tests.json` file — the [Clear Signing Tests workflow](./ci-checks.md#clear-signing-tests-the-testing-workflow) fails without it.

- For PRs from forks the tests **only run once a maintainer adds the `run-tests` label**. Skim the changed files first (the label triggers workflows on the PR head), then add the label.
- Check the results comment: every test case must pass on all reference implementations (all ✅ in the table).
- Check the test cases themselves: do they cover each function/message the descriptor formats? Do the `expected` blocks actually describe what the transaction does? A test that expects a wrong rendering is worse than no test.

### 4. No descriptor or index entry of another project is overwritten

The generated index files map each `(chainId, address)` to a descriptor, so two descriptors claiming the same deployment collide — a malicious or careless PR could effectively hijack how another project's contract is displayed.

- Verify the PR only touches **one entity folder**, and that this entity actually owns the claimed deployments.
- Check whether any deployment address in the PR (`context.contract.deployments`) is already claimed by **another** entity's descriptor (search the address in `index.calldata.json` / `index.eip712.json` on `master`).
- Be suspicious of PRs that modify or delete files of a *different* entity than the one they claim to add.

:::note planned
A dedicated CI check that fails when a PR's descriptors would overwrite another descriptor's index entry is planned. Until it exists, this is a manual review step.
:::

### 5. Registry structure is kept

The [repository layout](https://github.com/ethereum/clear-signing-erc7730-registry#registry-structure) is directory-based, and PRs must follow it:

- One entity per PR, all files inside `registry/<entity_name>/`.
- Descriptors named `calldata-<ContractName>.json` / `eip712-<MessageName>.json`; shared definitions as `common-*.json` (never with a `calldata`/`eip712` prefix); tests under `testsv2/`.
- `index.calldata.json` and `index.eip712.json` are **generated** — a PR must not edit them by hand.

## Optional asks (nice-to-have, not blocking)

Where it makes sense, ask submitters for these improvements — they're optional and should not block an otherwise correct PR:

- **Add `interpolatedIntent`.** A templated one-sentence intent with the field values substituted (e.g. `Swap {amountIn} for {tokenOut}`) gives wallets the recommended single-sentence display form. Descriptors with only a static `intent` still work, but `interpolatedIntent` is the better user experience.
- **Remove deprecated fields.** Descriptors migrated from the v1 format sometimes still carry fields the v2 format no longer uses — most notably embedded **ABIs** (`context.contract.abi`) and embedded EIP-712 schemas: in v2, ABIs are fetched from Sourcify/Etherscan and EIP-712 format keys are the schema. Ask to drop such leftovers.

## Deeper review and attestations

For attestation-grade review — verifying the descriptor against verified source code, checking intent mutability through proxies and mutable state, and publishing a signed EAS attestation — see the registry's [auditor guide](https://github.com/ethereum/clear-signing-erc7730-registry/blob/master/auditors/README.md) and the [attestations section](../descriptors/creating-a-descriptor.md#attestations) of the descriptor tutorial. Regular PR review keeps the registry consistent; attestations add the cryptographic trust layer wallets can build policy on.
