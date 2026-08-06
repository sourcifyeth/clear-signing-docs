# Clear Signing Docs

Documentation site for the [ERC-7730](https://eips.ethereum.org/EIPS/eip-7730) clear signing ecosystem — the [registry](https://github.com/ethereum/clear-signing-erc7730-registry), descriptor authoring, and wallet integrations. Built with [Docusaurus](https://docusaurus.io/), intended to be hosted under a [clearsigning.org](https://clearsigning.org) subdomain.

## Development

```bash
npm install
npm start        # local dev server with hot reload
```

## Build

```bash
npm run build    # static output in build/
npm run serve    # preview the production build
```

Two pages render remote GitHub documents **in the browser at page-load time** (via the `RemoteMarkdown` component in `src/components/`): the TypeScript SDK guide (`GUIDE.md` from sourcifyeth/clear-signing) and the auditor guide (`auditors/README.md` from the registry). Their content is not part of the build — to change it, edit the source repositories.

## Structure

- `docs/intro.md` — what clear signing / ERC-7730 is
- `docs/descriptors/` — creating descriptors and submitting them to the registry
- `docs/registry/` — registry CI checks in detail, PR review guidelines
- `docs/wallets/` — wallet integration overview and SDK guides
