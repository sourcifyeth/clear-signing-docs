---
sidebar_position: 1
title: What audits do
---

# What audits do

The [PR review](../registry/reviewing-prs.md) that gates the registry is deliberately short and basic. The real trust layer is the **audit**: an independent auditor verifies a merged descriptor in depth and publishes a cryptographic **attestation** of the exact content they reviewed. **Wallets must only use attested descriptors**, so a descriptor without attestations exists in the registry but shouldn't reach users yet.

## The audit

An audit verifies that a descriptor makes wallets display the truth. Roughly, the auditor checks:

1. **Project and submitter** — the protocol is what it claims to be, and the descriptor plausibly comes from it.
2. **Contract verification** — the contract's source is verified on [Sourcify](https://sourcify.dev), and the descriptor's addresses and the ABI match it. Unverified contracts don't get attested.
3. **Descriptor accuracy** — parameter names, types, and selectors match the ABI; intents describe the real user impact; approvals, transfers, and privileged actions are correctly surfaced.
4. **Intent mutability** — the displayed intent can't silently diverge from the executed behavior later: proxy implementations and any mutable state the intent depends on must be pinned by the descriptor's on-chain preconditions (`proxy`, `stateRefs`), and functions whose behavior depends on state the format can't express must be left out of the descriptor entirely.
5. **Rendering validation** — sample transactions are run through the descriptor to confirm the output is correct and unambiguous.

The full working process — tools, step-by-step checks, and the rules around signing — is on the [auditor guide](./auditor-guide.mdx) page.

## The attestation (ERC-8176)

The attestation format is being standardized as **ERC-8176** ([ethereum/ERCs#1576](https://github.com/ethereum/ERCs/pull/1576)), built on the [Ethereum Attestation Service](https://attest.org) (EAS). An attestation is a signed claim by a specific party that they reviewed a descriptor with a specific content hash:

- **The descriptor hash** is the attestation's only data field: the descriptor's `includes` are resolved first, the result is canonicalized with [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JCS), and the bytes are hashed with Keccak-256. Any change to the descriptor changes the hash — which is why [attested descriptors must never be modified](../registry/reviewing-prs.md#5-attested-descriptors-are-not-modified), only superseded by new versions.
- **Attestations can be onchain or offchain.** Onchain ones are created through the EAS contract; offchain ones are EIP-712-signed JSON blobs distributed alongside the descriptors — in the registry, under `registry/<entity>/sigs/`. Both carry the same information (attester, hash, timestamps, optional expiry).
- **Revocation is always onchain.** Regardless of how the attestation was issued, retracting it is an onchain EAS transaction by the original attester — so a revocation can't be hidden by whoever distributes the descriptor.

## How wallets use attestations

Anyone can attest, so the attestation alone proves only *who* reviewed *what*. Each wallet decides **which attesters it trusts and how many attestations it requires**. Before rendering a descriptor, a wallet verifies that the attestation's hash matches the descriptor it resolved, that the signature is valid and the attester is in its trusted set, and that the attestation is neither expired nor revoked on EAS. Auditors are listed with their identities in the registry's [`auditors/`](https://github.com/ethereum/clear-signing-erc7730-registry/tree/master/auditors) directory, resolvable via ENS.
