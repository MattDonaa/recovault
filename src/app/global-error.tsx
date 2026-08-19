"use client";

/**
 * Global error boundary (wraps the root layout). Renders its own <html>/<body>
 * and a sanitized message — never raw error detail.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          An unexpected error occurred. No sensitive information is shown.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#0A2854",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
