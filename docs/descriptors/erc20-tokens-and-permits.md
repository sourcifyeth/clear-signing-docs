---
sidebar_position: 2
title: ERC-20 tokens & permits
---

# Descriptors for ERC-20 tokens and ERC-2612 permits

Token descriptors are the most common submissions to the registry — and the most standardized, since every ERC-20 shares the same core functions. This page explains when a token actually needs a descriptor, how to build one from the shared ERC templates, how "unlimited" approvals are displayed, and how to describe [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612) permit messages.

## Does your token need a descriptor at all?

For the **basic ERC-20 functions, often no.** Clear signing libraries can render standard token interactions without a registry descriptor: the [TypeScript SDK bundles the registry's ERC-20/ERC-721 templates](https://github.com/sourcifyeth/clear-signing/pull/50) and applies them on the fly to any token the wallet lists in its `trustedTokens` map (the wallet tags each address with its standard, since ERC-20 and ERC-721 share the `approve`/`transferFrom` selectors). A plain `transfer` or `approve` on a well-known token clear-signs out of the box — and when a registry descriptor *does* exist, it always takes precedence over the bundled fallback.

Submit a registry descriptor when at least one of these applies:

- **Functions beyond the defaults.** The bundled template only covers `transfer` and `approve`. Anything else users sign — `transferFrom`, `increaseAllowance`/`decreaseAllowance`, `mint`/`burn`, `transferWithAuthorization`, wrap/unwrap functions, … — needs a descriptor to clear-sign.
- **More specific rendering.** You want tailored labels or intents ("Stake" instead of "Send"), a custom unlimited-approval message, or verified metadata shown to users (owner, project URL).
- **Verified token metadata.** A descriptor's `metadata.token` (ticker, name, decimals) gives wallets trusted display data for your token independent of their token lists.
- **Permit support.** ERC-2612 permit messages are EIP-712 typed data bound to your token's signing domain — they are matched per token and need a [registry entry](#erc-2612-permit-descriptors).

## The shared ERC templates

The registry ships reusable templates under [`ercs/`](https://github.com/ethereum/clear-signing-erc7730-registry/tree/master/ercs) so token descriptors don't repeat the standard formats:

- `ercs/calldata-erc20-tokens.json` — `transfer` and `approve` for contract calls
- `ercs/eip712-erc2612-permit.json` — the standard `Permit` typed-data message

Your descriptor pulls a template in with `includes` and only adds what is specific to your token: the deployments, the metadata, and any extra formats. Included definitions can also be overridden field by field.

## Writing an ERC-20 token descriptor

A minimal token descriptor is little more than deployments plus metadata on top of the template:

```json
{
  "$schema": "../../specs/erc7730-v2.schema.json",
  "includes": "../../ercs/calldata-erc20-tokens.json",
  "context": {
    "$id": "My Token",
    "contract": {
      "deployments": [
        { "chainId": 1, "address": "0x1234...abcd" },
        { "chainId": 137, "address": "0x5678...ef01" }
      ]
    }
  },
  "metadata": {
    "owner": "My Project",
    "info": { "url": "https://myproject.xyz" },
    "token": { "ticker": "MYT", "name": "My Token", "decimals": 18 },
    "contractName": "My Token"
  }
}
```

With this in place, the template's `transfer` renders as *Send — Amount / To*, and `approve` as *Approve — Spender / Amount*, with amounts formatted using your token's decimals and ticker.

To cover additional functions, add them under `display.formats` in the same file — the [linter](../registry/ci-checks.md#what-the-linter-checks-in-detail) will warn about ABI functions that have no display format, which is a good checklist of what's still uncovered.

## Displaying "unlimited" approvals

Approvals for the maximum possible amount are common (dapps request them to avoid repeated approvals), and rendering `115792089237316195423570985008687907853269984665640564039457584007913129639935` at a user helps nobody. The `tokenAmount` format therefore supports two optional parameters:

- **`threshold`** — a raw `uint` value (hex or decimal string); when the amount reaches it, the wallet renders a message instead of the number.
- **`message`** — the text to render in that case; defaults to `"Unlimited"`.

The registry convention, used by the ERC-20 template's `approve`, is a threshold of **2²⁵⁵** (`0x8000…0000`):

```json
{
  "path": "_value",
  "label": "Amount",
  "format": "tokenAmount",
  "params": {
    "tokenPath": "@.to",
    "threshold": "0x8000000000000000000000000000000000000000000000000000000000000000"
  }
}
```

Points to be aware of when using thresholds:

- **The comparison is on the raw integer, not the decimals-adjusted amount.** A "human" threshold like *10⁹ tokens* means a different raw value for every `decimals` configuration, so per-token tuning would be required to use one. The 2²⁵⁵ convention is deliberately conservative: it only catches sentinel values like `type(uint256).max` and can never flag a real, finite amount as unlimited — at the cost of rendering merely-astronomical approvals as exact numbers, where many wallets' own heuristics (decimals-aware cutoffs, or comparisons against total supply) would already say "unlimited".
- **Match the threshold to the amount's type.** [Permit2](https://github.com/Uniswap/permit2) amounts are `uint160`, so its sentinel is `type(uint160).max` — a 2²⁵⁵ threshold would never trigger there.
- **"Unlimited" is about spending power, not contract internals.** Token contracts treat max approvals differently (OpenZeppelin's ERC-20 skips allowance deduction only at exactly `type(uint256).max`, Lido's stETH uses an `INFINITE_ALLOWANCE` constant, USDC always decrements). From the signer's perspective these all authorize practically unlimited spending, which is what the display should convey.
- **Custom messages** — e.g. Aave descriptors render `"All"`/`"Max"` for max-amount actions — are fine; keep the conservative threshold when you customize the text. The parameter is `message` (older drafts of the spec referred to a non-existent `thresholdLabel` — that's a documentation bug, not a schema field).

There are known gaps here, tracked in [registry issue #2863](https://github.com/ethereum/clear-signing-erc7730-registry/issues/2863): thresholds relative to the token's total supply or decimals aren't expressible yet, the spec doesn't pin down whether the comparison is `>` or `>=` (immaterial with the 2²⁵⁵ convention), and there is no sentinel handling for **expiry dates** — a `deadline` of `type(uint256).max` currently renders as a far-future date rather than "Never expires".

## ERC-2612 permit descriptors

An [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612) permit is a gasless approval: the user signs an EIP-712 `Permit` message off-chain, and anyone can submit it to set an allowance. **A permit deserves the same scrutiny as an `approve` call**, so wallets need a descriptor to render it meaningfully.

Permit descriptors live in the shared [`registry/permit/`](https://github.com/ethereum/clear-signing-erc7730-registry/tree/master/registry/permit) entity — one file per token and chain — and consist of the shared template plus the token's EIP-712 binding:

```json
{
  "$schema": "../../specs/erc7730-v2.schema.json",
  "includes": "../../ercs/eip712-erc2612-permit.json",
  "context": {
    "eip712": {
      "deployments": [{ "chainId": 1, "address": "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" }],
      "domain": { "name": "Wrapped stETH", "version": "1" }
    }
  },
  "metadata": { "owner": "Lido DAO" }
}
```

The template's format key is the exact `encodeType` string of the standard permit — `Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)` — and wallets match it by hash, so [any deviation means the descriptor never applies](../registry/ci-checks.md#2-eip-712-key-validation-validateeip712keyslinter). It displays:

- **Spender** — who is being authorized;
- **Max spending amount** — the `value`, formatted as a token amount of the verifying contract (give it the same 2²⁵⁵ `threshold` as calldata approvals, so max-value permits render as "Unlimited");
- **Valid until** — the `deadline` as a date;
- `owner` and `nonce` are declared with `visible: "never"` — consciously excluded rather than forgotten.

To submit permit support for your token, add a file to `registry/permit/` with your token's deployments and its **exact** EIP-712 domain `name` and `version` (check the contract source — a wrong domain means the descriptor won't match signatures).

### Non-standard permit variants

Not every token implements the standard message. DAI's permit, for instance, is `Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)` — a boolean grant/revoke instead of an amount. Because matching is by the format key's hash, such tokens **cannot reuse the standard template's format**: the descriptor needs a format entry keyed by the token's actual `encodeType` string, displaying the fields that matter (e.g. the boolean `allowed` via an `enum` format rendered as "Grant"/"Revoke", and `expiry` as a date).
