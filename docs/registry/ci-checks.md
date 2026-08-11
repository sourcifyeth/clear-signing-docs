---
sidebar_position: 1
title: CI checks on pull requests
---

# CI checks on registry pull requests

Every pull request to the [ERC-7730 registry](https://github.com/ethereum/clear-signing-erc7730-registry) runs a set of automated checks. This page explains each check that matters when you add or change descriptors, what makes it pass or fail, and what happens after your PR is merged.

## The pipeline at a glance

```mermaid
flowchart TD
    PR([Pull request opened / updated])

    subgraph static ["Static checks"]
        direction TB
        LBL["🏷️ Pull request labels<br/><small>auto-label by changed paths,<br/>at least one label required</small>"]
        DESC["🔎 Validate descriptors<br/><small>erc7730 lint on changed files</small>"]
        SCHEMA["🔎 Validate JSON schemas<br/><small>check-jsonschema against<br/>erc7730-v2 / tests schemas</small>"]
        LBL ~~~ DESC ~~~ SCHEMA
    end

    subgraph tests ["Clear Signing Tests"]
        direction TB
        GATE{"Same-repo PR?<br/><small>fork PRs need the<br/><code>run-tests</code> label</small>"}
        GATE -- "no label yet" --> WAIT["💬 Comment: waiting for<br/>maintainer approval"]
        GATE -- "allowed" --> DETECT{"testsv2 files found<br/>for changed descriptors?"}
        DETECT -- "no" --> MISSING["❌ Comment + check fails:<br/>missing testsv2 file"]
        DETECT -- "yes" --> RUNTS["Sourcify TypeScript<br/>runner"]
        DETECT -- "yes" --> RUNRS["Rust runner"]
        RUNTS --> RESULTS["💬 Results table comment<br/><small>any non-pass fails the check</small>"]
        RUNRS --> RESULTS
    end

    PR --> LBL
    PR --> GATE
    RESULTS --> MERGE([All green + review → merge])
    SCHEMA ~~~ MERGE
    static --> MERGE
    MERGE --> POST["After merge on master:<br/><small>full registry lint · index regeneration ·<br/>weekly auto-format · spec sync</small>"]
```

## 🏷️ Pull request labels

*Workflow: `pull_request_labels.yml`*

Labels are applied automatically based on which paths the PR touches (`descriptors`, `specifications`, `documentation`, `ci`, `tools`), and the check requires **at least one** of these labels to be present. For a typical descriptor submission you don't need to do anything — changing files under `registry/` gets you the `descriptors` label automatically.

## 🔎 Validate JSON schemas

*Workflow: `pull_request.yml` → job `validate JSON schemas`*

Every changed JSON file under `registry/` and `ercs/` is validated with [`check-jsonschema`](https://check-jsonschema.readthedocs.io/) against the right schema:

| File | Schema |
|---|---|
| Descriptors and shared/common files | `specs/erc7730-v2.schema.json` (or the file's own relative `$schema` if it resolves) |
| `testsv2/*.tests.json` | `specs/erc7730-tests-v2.schema.json` |
| legacy `tests/*.tests.json` | `specs/erc7730-tests.schema.json` |
| `sigs/*` attestation files | skipped — no schema is defined for them yet |

This is a pure structural check — it catches missing required properties, wrong types, and typos in field names before the semantic linting even matters.

## 🔎 Validate descriptors (linting)

*Workflow: `pull_request.yml` → job `validate descriptors`*

Collects the changed descriptor files (`registry/**/eip712-*.json` and `registry/**/calldata-*.json`, excluding test fixtures and the attestation files under `sigs/` — those share the descriptor name prefix but are not descriptors) and runs the [`erc7730`](https://github.com/LedgerHQ/python-erc7730) linter on them:

```bash
erc7730 lint <changed files> --gha
```

The registry uses the **v2 descriptor format**, so the v2 lint pipeline applies (auto-detected from the descriptors' `$schema`). The linter emits findings at two severities: **errors fail the check**, while **warnings** are annotated on the PR but let it pass. Each check below states which one it produces.

### What the linter checks in detail

`erc7730 lint` ([python-erc7730](https://github.com/LedgerHQ/python-erc7730), v2 pipeline) processes every descriptor in four phases — parsing, resolution, then a series of semantic linters:

#### 0. Parsing and resolution

Before any linter runs, the file must **load into the v2 descriptor model** (structural validation, stricter than the JSON schema alone) and **resolve**: `$ref` includes and shared/common files are inlined, constants substituted, and display paths parsed. Findings here (invalid function signatures in format keys, unresolvable references, malformed paths) are **errors — they fail CI** immediately.

#### 1. Display field validation (`ValidateDisplayFieldsLinter`)

For **calldata (contract) descriptors**, the linter fetches the contract's reference ABI from **Sourcify** (or Etherscan as fallback) for the declared deployments, then cross-checks the descriptor against it. Only the first finding is an error; the rest are warnings:

- **Error (fails CI) — invalid display field:** a display field's `path` does not exist among the function's ABI parameters. This catches typos and stale descriptors.
- **Warning — missing display field:** an ABI parameter has no display field. Every parameter should either be displayed or consciously excluded.
- **Warning — unknown selector:** the descriptor formats a function that does not exist in the reference ABI.
- **Warning — missing display format:** a function exists in the ABI but the descriptor defines no format for it (selector exhaustiveness — wallets fall back to blind signing for uncovered selectors).

If the contract looks like a **proxy**, ABI-based validation is skipped (with an info message). If no ABI can be fetched for any deployment, the linter warns and skips this validation — which is why contracts should be [verified on Sourcify](https://sourcify.dev) before submitting.

For EIP-712 descriptors this linter is a no-op (there is no embedded schema to check against in v2 — the format keys themselves are validated by the next linter).

#### 2. EIP-712 key validation (`ValidateEIP712KeysLinter`)

For **EIP-712 descriptors**, the `display.formats` keys must be exact [`encodeType`](https://eips.ethereum.org/EIPS/eip-712#definition-of-encodetype) strings (e.g. `Permit(address spender,uint256 value,uint256 nonce,uint64 deadline)`). Wallets match descriptors by the keccak256 hash of this string, so **any deviation means the descriptor silently never applies**. The linter checks, purely syntactically:

- the key matches the `encodeType` grammar exactly — no stray whitespace, balanced parentheses, members written as `type name` with single spaces;
- no struct type or member is defined twice;
- every member type is a valid EIP-712 atomic type (`uint8`–`uint256`, `bytes1`–`bytes32`, `bool`, `address`, `string`, `bytes` — the `uint`/`int`/`byte` aliases are **not** valid) or a struct defined in the key;
- every struct defined in the key is actually referenced from the primary type;
- referenced struct definitions are appended to the primary type **sorted by name**.

All findings from this linter are **errors — they fail CI**: a malformed key is a descriptor that will never match anything.

#### 3. Transaction type classification (`ClassifyTransactionTypeLinter`)

A safety net for common risky transaction types. The linter classifies the descriptor — for EIP-712, a format key containing `permit` marks it as a **Permit**; for contracts, classification runs on the fetched ABI — and then checks that the fields users need to see are actually displayed. For a Permit it flags a missing **spender**, **amount**, or **expiration/deadline** field. All findings are **warnings** — they don't fail CI, but expect reviewers to ask about them.

#### 4. Display length limits (`ValidateMaxLengthLinter`)

Hardware wallet screens are small. This linter warns when strings may be truncated on Ledger devices:

| What | Checked against |
|---|---|
| `metadata.owner`, `info.legalName`, `info.url`, contract `id` | creator/contract name limits |
| `intent`, `interpolatedIntent`, format `$id` | operation type limit |
| field `label`s (including nested groups) | field name limit |
| enum entries | enum value limit |

All of these are warnings — they don't fail CI, but shorter is better.

### Running the linter locally

Don't wait for CI — validate before you push:

```bash
pip install erc7730          # requires Python 3.12+, or: uvx erc7730 ...
erc7730 lint registry/<entity>/calldata-MyContract.json
```

## Clear Signing Tests (the testing workflow)

*Workflow: `clear-signing-tests.yml`*

Each descriptor added or changed in a PR must come with a **test file** at `registry/<entity>/testsv2/<descriptor-name>.tests.json`, containing sample transactions/messages and the exact display output a correct implementation must render for them (see [Reference test cases](../descriptors/creating-a-descriptor.md#4-write-reference-test-cases)).

The workflow has three stages:

1. **Permission gate.** PRs from branches within the registry repo run tests automatically. PRs from **forks** are untrusted, so a maintainer must add the **`run-tests` label** to the PR first — until then, a bot comment explains that the tests are waiting for maintainer approval. The label triggers only when it is added: after you push new commits, a maintainer has to remove and re-add it to run the tests against the latest state.
2. **Test detection.** For every changed descriptor (attestation files under `sigs/` don't count), the workflow looks for the matching `testsv2/` file (and vice-versa: a changed test file maps back to its descriptor). If descriptors changed but **no test file exists, the check fails** and a comment asks you to add one.
3. **Execution against reference implementations.** Each (descriptor, test file) pair is run against two independent ERC-7730 implementations:
   - the **Sourcify TypeScript runner** ([`@ethereum-sourcify/clear-signing`](https://github.com/sourcifyeth/clear-signing)), and
   - the **Rust runner** ([`llbartekll/clear-signing`](https://github.com/llbartekll/clear-signing)).

   The rendered output of every test case is compared against the `expected` block of the test file. A results table is posted (and kept up to date) as a PR comment — one row per test case, one column per implementation. **Any case that does not pass on any runner fails the check**, with an expected-vs-got diff in the comment's details section.

:::note
A third set of runners — Ledger device tests producing device screenshots — exists in the workflow but is currently disabled because it depends on a private Ledger repository. The Sourcify and Rust runners cover clear-signing tests in the meantime.
:::

## After the merge

A few workflows run on `master` and keep the registry consistent — you don't need to do anything for these, but you'll see their automated PRs:

- **Full registry lint** (`master.yml`) — every push to `master` re-lints *all* descriptors in the registry.
- **Index file sync** (`sync-indexes.yml`) — regenerates `index.calldata.json` and `index.eip712.json` from the descriptors and opens an automated PR when they change. The index files are **generated — never edit them by hand** in your PR.
- **Auto-formatting** (`format.yml`) — weekly `erc7730 format` run over the registry, opening a PR if anything was reformatted.
- **Spec sync** (`sync-specs.yml`) — weekly sync of `specs/erc-7730.md` and the JSON schemas from the upstream [ethereum/ERCs](https://github.com/ethereum/ERCs) repository, so the registry's copy of the spec follows the ERC.
