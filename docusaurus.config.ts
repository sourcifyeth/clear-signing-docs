import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Clear Signing Docs",
  tagline:
    "Documentation for the ERC-7730 clear signing ecosystem: the registry, descriptors, and wallet integrations",
  favicon: "img/favicon.svg",

  future: {
    v4: true,
  },

  // Intended to be hosted under a clearsigning.org subdomain.
  url: "https://docs.clearsigning.org",
  baseUrl: "/",

  organizationName: "sourcifyeth",
  projectName: "clear-signing-docs",

  onBrokenLinks: "throw",

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  themes: ["@docusaurus/theme-mermaid"],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  plugins: [
    [
      "docusaurus-plugin-remote-content",
      {
        // Fetches the wallet integration guide of the TypeScript SDK from
        // GitHub at build time so it is always in sync with the source repo.
        name: "sourcify-ts-sdk-guide",
        sourceBaseUrl:
          "https://raw.githubusercontent.com/sourcifyeth/clear-signing/main/",
        outDir: "docs/wallets",
        documents: ["GUIDE.md"],
        modifyContent(filename: string, content: string) {
          if (!filename.includes("GUIDE")) {
            return undefined;
          }
          // Rewrite repo-relative links (e.g. src/types.ts, DECRYPTION.md) to
          // absolute GitHub URLs so they keep working on the docs site.
          const rewritten = content.replace(
            /\]\((?!https?:\/\/|#|mailto:)([^)]+)\)/g,
            "](https://github.com/sourcifyeth/clear-signing/blob/main/$1)"
          );
          return {
            filename: "typescript-sdk.md",
            content: [
              "---",
              "title: TypeScript SDK",
              "sidebar_label: TypeScript SDK",
              "sidebar_position: 2",
              "custom_edit_url: https://github.com/sourcifyeth/clear-signing/blob/main/GUIDE.md",
              "---",
              "",
              ":::info Rendered from the source repository",
              "This page is fetched at build time from [`GUIDE.md` in `sourcifyeth/clear-signing`](https://github.com/sourcifyeth/clear-signing/blob/main/GUIDE.md). To suggest changes, edit that file.",
              ":::",
              "",
              rewritten,
            ].join("\n"),
          };
        },
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Serve the docs at the site root — this is a docs-only site.
          routeBasePath: "/",
          editUrl:
            "https://github.com/sourcifyeth/clear-signing-docs/tree/main/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "Clear Signing Docs",
      logo: {
        alt: "Clear Signing",
        src: "img/favicon.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://clearsigning.org",
          label: "clearsigning.org",
          position: "right",
        },
        {
          href: "https://github.com/ethereum/clear-signing-erc7730-registry",
          label: "Registry",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Standard",
          items: [
            {
              label: "ERC-7730 specification",
              href: "https://eips.ethereum.org/EIPS/eip-7730",
            },
            {
              label: "clearsigning.org",
              href: "https://clearsigning.org",
            },
          ],
        },
        {
          title: "Registry",
          items: [
            {
              label: "ERC-7730 registry",
              href: "https://github.com/ethereum/clear-signing-erc7730-registry",
            },
            {
              label: "erc7730 CLI (python-erc7730)",
              href: "https://github.com/LedgerHQ/python-erc7730",
            },
          ],
        },
        {
          title: "SDKs",
          items: [
            {
              label: "TypeScript SDK",
              href: "https://github.com/sourcifyeth/clear-signing",
            },
            {
              label: "Rust / Swift / Kotlin SDK",
              href: "https://github.com/llbartekll/clear-signing",
            },
          ],
        },
      ],
      copyright: `Content is in the public domain (CC0). Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["json", "bash", "solidity"],
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },
    // Match the clearsigning.org palette (accent blue, light info surfaces,
    // neutral grays). The same variables are used in light and dark mode —
    // diagram nodes render as light "cards" on the dark background.
    mermaid: {
      theme: { light: "base", dark: "base" },
      options: {
        themeVariables: {
          fontFamily:
            '"Geist", "Avenir Next", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
          primaryColor: "#f0f4ff",
          primaryTextColor: "#111318",
          primaryBorderColor: "#6b93ff",
          secondaryColor: "#f8f9fa",
          tertiaryColor: "#ffffff",
          lineColor: "#6e6e73",
          textColor: "#111318",
          clusterBkg: "#f8f9fa",
          clusterBorder: "#c9ced6",
          edgeLabelBackground: "#ffffff",
        },
      },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
