---
slug: /
sidebar_position: 1
title: What is Clear Signing?
---

# What is Clear Signing?

When a wallet asks a user to sign a transaction or an [EIP-712](https://eips.ethereum.org/EIPS/eip-712) message, it traditionally shows raw data: a hex blob, a contract address, maybe a decoded function name. Users cannot verify what they are actually agreeing to — this is **blind signing**, and it is one of the main enablers of phishing and signature-based attacks.

**Clear signing** replaces that with human-readable screens: _"Approve 1,000 USDC for Uniswap V3"_ instead of `0x095ea7b3...`. It is an open, cross-ecosystem effort backed by the Ethereum Foundation, wallet vendors, and hardware wallet manufacturers — see [clearsigning.org](https://clearsigning.org).

## ERC-7730 in one paragraph

[ERC-7730](https://eips.ethereum.org/EIPS/eip-7730) defines a JSON format for **clear signing descriptors** (also called *metadata files*). A descriptor complements a contract's ABI or an EIP-712 message schema with display information: what a function call *means* (its **intent**), which parameters to show, how to format them (token amounts, dates, address names, …), and which contract deployments it applies to. Wallets resolve the descriptor for an incoming transaction and render a readable confirmation screen from it.

## The registry

Descriptors are collected in the community-maintained **[ERC-7730 registry](https://github.com/ethereum/clear-signing-erc7730-registry)** on GitHub. Anyone can submit descriptors for a protocol through a pull request; CI validates them, reference implementations run test cases against them, and independent auditors publish cryptographic [attestations](./descriptors/creating-a-descriptor.md#attestations) of reviewed descriptors — wallets must only use attested descriptors. Wallets and SDKs consume the registry through generated index files, without cloning the whole repository.

An onchain registry is planned; until then, the GitHub repository with its CI and review process is the canonical source.

## What's in these docs

| Section | For | What you'll find |
|---|---|---|
| [Creating a descriptor](./descriptors/creating-a-descriptor.md) | Protocol teams | How to write an ERC-7730 descriptor, test it, and submit it to the registry |
| [ERC-20 tokens & permits](./descriptors/erc20-tokens-and-permits.md) | Token teams | When tokens need a descriptor, unlimited approvals, ERC-2612 permit descriptors |
| [Registry CI checks](./registry/ci-checks.md) | Contributors & reviewers | Every automated check that runs on a registry pull request, in detail |
| [Reviewing pull requests](./registry/reviewing-prs.md) | Reviewers & maintainers | The manual review checklist used until the onchain registry exists |
| [Wallet integration](./wallets/integration.md) | Wallet developers | How to render clear signing screens using the available SDKs |

## Key links

- [ERC-7730 specification](https://eips.ethereum.org/EIPS/eip-7730)
- [ERC-7730 registry](https://github.com/ethereum/clear-signing-erc7730-registry)
- [clearsigning.org](https://clearsigning.org) — the initiative's home page
- [ethereum.org clear signing tutorial](https://ethereum.org/developers/tutorials/clear-signing/)
