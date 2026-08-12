---
sidebar_position: 3
title: Proxy contracts
---

# Descriptors for proxy contracts

Proxies split a contract in two: the **proxy address** users interact with, and the **implementation address** holding the code that actually runs. That split is exactly what makes them tricky for clear signing — a descriptor describes what code *means*, but with a proxy, the code behind an address can change. This page explains how to bind descriptors for proxied contracts, and why the registry's guidance deviates from the ERC-7730 specification here.

## What the specification says

The [ERC-7730 proxy support section](https://eips.ethereum.org/EIPS/eip-7730) distinguishes three patterns:

- **Upgradeable proxies** (Transparent, UUPS/[ERC-1822](https://eips.ethereum.org/EIPS/eip-1822)): bind the descriptor to the **proxy address** — the stable address users interact with — and update the registry descriptor whenever an upgrade changes the ABI.
- **Composable contracts** (Diamond proxies, [ERC-2535](https://eips.ethereum.org/EIPS/eip-2535)): one context-free descriptor per facet, composed into an overarching descriptor bound to the **proxy address**.
- **Multi-instantiation** (smart wallet factories deploying many thin proxies): bind the descriptor to the **implementation address** and let the wallet detect that the target is a proxy to that well-known implementation.

## What we recommend instead

:::warning[Deviation from the specification]
The ERC-7730 specification does not use the recommended way of binding proxies. For security reasons, **all kinds of proxies should be bound to the implementation address** — not only the multi-instantiation case.
:::

Binding a descriptor to the proxy address means it keeps matching **whatever code the proxy points to next**. After an upgrade, the descriptor still applies and happily renders the intents that were written — and [attested](../auditors/what-audits-do.md) — for the *old* implementation. The displayed intent can silently diverge from the executed behavior, which is precisely the class of attack clear signing exists to prevent. It also conflicts with the registry's trust model: attested descriptors are [immutable](../registry/reviewing-prs.md#6-attested-descriptors-are-not-modified), so "update the descriptor on upgrade" would invalidate the attestation chain on every upgrade.

Binding to the **implementation address** pins the descriptor to the exact code that was reviewed:

- The wallet resolves the proxy's implementation (standardized slots for [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)/ERC-1822, the loupe functions for diamonds) and looks up the descriptor **by the implementation address**.
- After an upgrade, the old descriptor simply stops matching — the wallet falls back to opaque signing instead of showing stale intents. That's a fail-safe default.
- The new implementation gets a **new descriptor file** (and new attestations), following the same versioning flow as any descriptor change.

A practical side benefit: the [linter](../registry/ci-checks.md#what-the-linter-checks-in-detail) validates display fields against the ABI fetched from Sourcify, and skips that validation when the deployment address looks like a proxy — bound to the implementation address, the ABI checks actually run against the code being described.

## Writing the descriptor

Concretely, a descriptor for a proxied contract looks like any other — the deployments just list the **implementation** addresses:

```json
{
  "$schema": "../../specs/erc7730-v2.schema.json",
  "context": {
    "$id": "My Protocol Vault (implementation v2)",
    "contract": {
      "deployments": [
        { "chainId": 1, "address": "0xImplementationAddress" }
      ]
    }
  },
  "metadata": { "owner": "My Protocol", "info": { "url": "https://myprotocol.xyz" } },
  "display": { "formats": { "…": {} } }
}
```

- Make sure the **implementation contract is verified on Sourcify** — that's the ABI your display formats are validated against.
- For **diamonds**, apply the same idea per facet: one descriptor per facet, bound to the facet's implementation address.
- On an upgrade, submit a **new descriptor file** for the new implementation address (the filename carries the version) — don't modify the old one.
- Reference test cases work unchanged: the `rawTx` in your [testsv2 file](./creating-a-descriptor.md#4-write-reference-test-cases) still targets the proxy address users actually call; runners resolve descriptors the same way wallets do.

## An improved design is being standardized

There is a draft to improve proxy handling in the specification: [ethereum/ERCs#1738](https://github.com/ethereum/ERCs/pull/1738) adds an **intent mutability** section to ERC-7730. It keeps descriptors matchable at the proxy address but makes the implementation binding explicit and verifiable:

- `context.contract.proxy` — a typed block (`eip1967`, `eip1822`, `eip2535`) declaring the **expected implementation addresses**; for diamonds, the expected selector-to-facet routing. Wallets read the live implementation from the standardized slot and refuse (or warn) when it isn't in the declared list.
- `context.contract.stateRefs` — storage-slot preconditions (`slot`, `expectedValue`, optional `mask`) for other mutable state the displayed intent depends on, such as admin-controlled parameters.
- Functions whose displayed intent depends on state these mechanisms *cannot* express must be omitted from `display.formats` entirely.

Once that design lands in the specification and the registry tooling, this page will be updated — until then, bind to the implementation address as described above.
