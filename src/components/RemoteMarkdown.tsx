import React, { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  /**
   * GitHub page of the markdown document to render, e.g.
   * https://github.com/<owner>/<repo>/blob/<ref>/<path>.md
   *
   * The raw content URL and the base for resolving the document's
   * repo-relative links are derived from it.
   */
  sourceUrl: string;
  /**
   * Drop the document's leading `# Title` line so it doesn't duplicate the
   * page title provided by the docs frontmatter.
   */
  stripTitle?: boolean;
}

const BLOB_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/;

/**
 * Fetches a markdown document from GitHub in the browser when the page loads
 * and renders it, showing a spinner while the request is in flight.
 */
export default function RemoteMarkdown({
  sourceUrl,
  stripTitle = false,
}: Props): ReactNode {
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const match = sourceUrl.match(BLOB_URL_PATTERN);
  if (match === null) {
    throw new Error(`Not a GitHub blob URL: ${sourceUrl}`);
  }
  const [, owner, repo, refAndPath] = match;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${refAndPath}`;
  // The document's directory — relative links resolve against it.
  const linkBase = sourceUrl.slice(0, sourceUrl.lastIndexOf("/") + 1);

  useEffect(() => {
    let cancelled = false;
    fetch(rawUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        if (cancelled) {
          return;
        }
        let processed = text;
        if (stripTitle) {
          processed = processed.replace(/^\s*# .*\n/, "");
        }
        // Rewrite repo-relative links (e.g. src/types.ts, ../auditors/README.md)
        // to absolute URLs on the source repository so they keep working here.
        processed = processed.replace(
          /\]\((?!https?:\/\/|#|mailto:)([^)]+)\)/g,
          (_, target: string) => `](${new URL(target, linkBase).href})`
        );
        setContent(processed);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rawUrl, linkBase, stripTitle]);

  if (failed) {
    return (
      <div className="alert alert--warning" role="alert">
        Loading the document failed. You can read it directly at{" "}
        <a href={sourceUrl}>{sourceUrl}</a>.
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="remote-markdown-loading" aria-live="polite">
        <span className="remote-markdown-spinner" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}
