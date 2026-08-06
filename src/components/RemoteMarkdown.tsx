import React, { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  /** Raw markdown URL to fetch (e.g. raw.githubusercontent.com). */
  url: string;
  /** Human-facing page of the same document, linked from the error state. */
  sourceUrl: string;
  /**
   * Base URL that repo-relative links in the fetched markdown are resolved
   * against (e.g. the GitHub blob/ URL of the document's directory).
   */
  linkBase: string;
  /**
   * Drop the document's leading `# Title` line so it doesn't duplicate the
   * page title provided by the docs frontmatter.
   */
  stripTitle?: boolean;
}

/**
 * Fetches a markdown document in the browser when the page loads and renders
 * it, showing a spinner while the request is in flight.
 */
export default function RemoteMarkdown({
  url,
  sourceUrl,
  linkBase,
  stripTitle = false,
}: Props): ReactNode {
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
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
        // Rewrite repo-relative links (e.g. src/types.ts, DECRYPTION.md) to
        // absolute URLs on the source repository so they keep working here.
        processed = processed.replace(
          /\]\((?!https?:\/\/|#|mailto:)([^)]+)\)/g,
          `](${linkBase}$1)`
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
  }, [url, linkBase, stripTitle]);

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
