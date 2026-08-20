---
sidebar_position: 1
title: Creating a descriptor
---

# Create a descriptor and add it to the registry

This guide walks you through writing an ERC-7730 clear signing descriptor for your protocol, testing it, and submitting it to the [registry](https://github.com/ethereum/clear-signing-erc7730-registry). It follows the same flow as the [ethereum.org tutorial](https://ethereum.org/developers/tutorials/clear-signing/), condensed and updated for the v2 format used by the registry.

:::tip
Describing an ERC-20 token or its permit? There's a [dedicated page](./erc20-tokens-and-permits.md) for that — including when a token doesn't need a descriptor at all.
:::

## Before you start

- **Verify your contracts on [Sourcify](https://sourcify.dev)** (or Etherscan). The registry CI fetches your reference ABI from there to validate the descriptor — an unverified contract means weaker validation and a harder review.
- Install the tooling (Python 3.12+):

```bash
pip install erc7730      # or run ad-hoc without installing: uvx erc7730 ...
```

## 1. Generate a starting point

Fork and clone the [registry](https://github.com/ethereum/clear-signing-erc7730-registry), create your entity folder `registry/<entity_name>/`, and bootstrap a descriptor from the verified ABI:

```bash
erc7730 generate --address 0xYourContract --chain-id 1 \
  --owner "Your Protocol" --url "https://yourprotocol.xyz"
```

Descriptor files are named `calldata-<ContractName>.json` for smart contracts and `eip712-<MessageName>.json` for EIP-712 messages. Shared definitions used by several descriptors go into `common-*.json` files (no `calldata`/`eip712` prefix).

## 2. Understand the descriptor structure

A descriptor has three sections — `context`, `metadata`, and `display`:

```json
{
  "$schema": "../../specs/erc7730-v2.schema.json",
  "context": {
    "contract": {
      "deployments": [
        { "chainId": 1, "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
        { "chainId": 8453, "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }
      ]
    }
  },
  "metadata": {
    "owner": "Your Protocol",
    "info": { "url": "https://yourprotocol.xyz" }
  },
  "display": {
    "formats": {
      "approve(address spender, uint256 amount)": {
        "intent": "Approve",
        "interpolatedIntent": "Approve {amount} for {spender}",
        "fields": [
          {
            "path": "spender",
            "label": "Spender",
            "format": "addressName",
            "params": { "types": ["eoa", "contract"] },
            "visible": "always"
          },
          {
            "path": "amount",
            "label": "Amount",
            "format": "tokenAmount",
            "params": { "tokenPath": "@.to" },
            "visible": "always"
          }
        ]
      }
    }
  }
}
```

- **`context`** binds the descriptor to deployments: the chains and addresses it applies to. In the v2 format you do **not** embed the ABI — CI fetches the reference ABI from Sourcify/Etherscan instead.
- **`metadata`** carries the owner (displayed to users), project info, and optional `constants` you can reference from fields.
- **`display.formats`** is the heart of the descriptor: one entry per function (keyed by its signature or selector) or per EIP-712 type (keyed by its exact `encodeType` string). Each entry defines:
  - `intent` — a short action label, e.g. `"Approve"`;
  - `interpolatedIntent` *(recommended)* — a full sentence template with field values substituted, e.g. `"Approve {amount} for {spender}"`;
  - `fields` — the ordered list of parameters to display, each with a `label` and a `format` (`tokenAmount`, `addressName`, `date`, `raw`, `calldata` for nested calls, …) plus format-specific `params`.

Aim to cover **every user-facing function** of the contract — wallets fall back to blind signing for selectors without a format — and to display every parameter that affects what the user agrees to.

## 3. Validate locally

```bash
erc7730 lint registry/<entity_name>/calldata-YourContract.json
```

This runs the same linter as the registry CI: schema and reference resolution, display fields cross-checked against the fetched ABI, EIP-712 key syntax, transaction type heuristics (e.g. a Permit must display spender/amount/expiration), and device display length limits. See [CI checks](../registry/ci-checks.md#what-the-linter-checks-in-detail) for the full breakdown.

## 4. Write reference test cases

Each descriptor must come with a test file at `registry/<entity_name>/testsv2/<descriptor-name>.tests.json`. It contains real sample transactions (or EIP-712 payloads) plus the exact display output an implementation must render — reference implementations run these in CI, and wallet developers use them to verify their integrations:

```json
{
  "$schema": "../../../specs/erc7730-tests-v2.schema.json",
  "descriptor": "../calldata-YourContract.json",
  "dataProvider": {
    "tokens": {
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { "symbol": "USDC", "decimals": 6, "name": "USD Coin" }
    }
  },
  "tests": [
    {
      "description": "Approve 100 USDC",
      "rawTx": "0x02f8b0...",
      "expected": {
        "intent": "Approve",
        "interpolatedIntent": "Approve 100 USDC for Uniswap V3",
        "owner": "Your Protocol",
        "fields": [
          { "label": "Spender", "value": "Uniswap V3" },
          { "label": "Amount", "value": "100 USDC" }
        ]
      }
    }
  ]
}
```

Guidelines: at least one test per function/message type, prefer real transactions (`rawTx` is the raw **unsigned** transaction), give every case a unique `description`, and cover edge cases (max values, zero values, special addresses). The `dataProvider` block supplies mock token metadata and address names so tests run without network access. Full field reference: [registry README](https://github.com/ethereum/clear-signing-erc7730-registry#reference-test-cases).

## 5. Submit the pull request

Open a PR against the registry. Requirements:

- One entity per PR — only files under your `registry/<entity_name>/` folder.
- Descriptors validate against `specs/erc7730-v2.schema.json`.
- Every added/changed descriptor has its `testsv2/` file.
- Don't touch the generated `index.calldata.json` / `index.eip712.json` — CI regenerates them after merge.

CI will [lint your descriptors, validate schemas and file names, check the registry index for collisions, verify no attested descriptor is modified, and run your tests against reference implementations](../registry/ci-checks.md) — fork PRs included (only a first-time contributor's runs need a maintainer's approval, per GitHub's standard rule). Reviewers then check the PR against the [review guidelines](../registry/reviewing-prs.md).

## Attestations

Getting your descriptor merged is not the end of the trust chain: **wallets must only use attested descriptors**. An attestation is a cryptographic statement by an independent auditor that they reviewed the exact descriptor version — a merged but unattested descriptor should not be rendered to users.

Auditors follow a five-step review before signing (see [What audits do](../auditors/what-audits-do.md)):

1. **Project check** — the protocol's purpose is confirmed and the submitter is plausibly affiliated with it.
2. **Contract verification** — the contract is verified on [Sourcify](https://repo.sourcify.dev), and the address and ABI match the descriptor. Unverified contracts are not signed.
3. **Descriptor accuracy** — parameter names, types, ordering, and selectors match the ABI; intents reflect the real user impact; approvals, transfers, and privileged actions are correctly flagged.
4. **Intent mutability** — the displayed intent cannot silently diverge from the executed behavior: proxy implementations and mutable state the intent depends on must be pinned via the descriptor's `proxy` / `stateRefs` preconditions, and functions whose displayed intent depends on state that v2 cannot express (time-based branches, dynamic call resolution, …) must be omitted from `display.formats`.
5. **Tester validation** — sample transactions are run through the descriptor to confirm the rendered output is correct and unambiguous.

The mechanics:

- The auditor creates an **offchain [EAS](https://attest.org) attestation** (ERC-8176 schema) over the **descriptor hash** — `keccak256` of the [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) canonicalized descriptor JSON, computed with `clearsig descriptor-hash <file>`.
- The signed attestation JSON is submitted to the registry at `registry/<entity_name>/sigs/<descriptor-name>.eip155-1-0xAuditorAddress.json`.
- Auditors are listed under [`auditors/`](https://github.com/ethereum/clear-signing-erc7730-registry/tree/master/auditors) with a profile (`id`, `name`, optional `ens` and `organization`); wallets resolve auditor identity via ENS and check revocations via EAS.
- Attestations bind to the exact reviewed content: a new descriptor version requires a new attestation, existing attestations are never modified, and retractions happen via an on-chain EAS revocation. If an auditor finds issues, they don't sign — they open a GitHub issue instead.

If you want your descriptor attested, or want to become an auditor, start with the [auditor guide](../auditors/auditor-guide.mdx).
