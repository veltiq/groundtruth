import { describe, expect, it } from "vitest";
import { emptyEvidence } from "./evidence.js";
import { detectWorkKind, summarizeRequest } from "./intent.js";
import type { Evidence } from "./types.js";

function ev(over: Partial<Evidence>): Evidence {
  return { ...emptyEvidence(), ...over };
}

describe("summarizeRequest", () => {
  it("returns undefined for empty/missing input", () => {
    expect(summarizeRequest(undefined)).toBeUndefined();
    expect(summarizeRequest("   ")).toBeUndefined();
  });

  it("collapses whitespace and strips code fences", () => {
    expect(summarizeRequest("add a\n\n  login   form ```code```")).toBe("add a login form");
  });

  it("truncates very long requests", () => {
    const long = "x".repeat(400);
    const out = summarizeRequest(long, 50);
    expect(out?.length).toBe(50);
    expect(out?.endsWith("…")).toBe(true);
  });
});

describe("detectWorkKind", () => {
  it("flags web work from a component file and offers the dev command + url", () => {
    const ctx = detectWorkKind(ev({ touchedFiles: ["src/components/Login.tsx"] }), {
      scripts: { dev: "vite", build: "tsc" },
    });
    expect(ctx.kind).toBe("web");
    expect(ctx.runHint).toBe("npm run dev");
    expect(ctx.urlHint).toBe("http://localhost:5173");
  });

  it("flags web work from DOM idioms even without a web-named file", () => {
    expect(detectWorkKind(ev({ addedText: 'el.addEventListener("click", fn)' })).kind).toBe("web");
  });

  it("flags an API from a server file plus a framework idiom, with the port from the diff", () => {
    const ctx = detectWorkKind(
      ev({ touchedFiles: ["src/server.ts"], addedText: "app.listen(4000)" }),
      { scripts: { start: "node dist/server.js" } },
    );
    expect(ctx.kind).toBe("api");
    expect(ctx.urlHint).toBe("http://localhost:4000");
    expect(ctx.runHint).toBe("npm run start");
  });

  it("does not call it an API on a server-named file alone (no framework idiom)", () => {
    expect(
      detectWorkKind(ev({ touchedFiles: ["src/server.ts"], addedText: "const x = 1" })).kind,
    ).toBe("generic");
  });

  it("flags a CLI from argv parsing", () => {
    expect(detectWorkKind(ev({ addedText: "const args = process.argv.slice(2)" })).kind).toBe(
      "cli",
    );
  });

  it("flags library work when only test files changed", () => {
    const ctx = detectWorkKind(ev({ touchedFiles: ["src/sum.test.ts"] }), {
      scripts: { test: "vitest run" },
    });
    expect(ctx.kind).toBe("library");
    expect(ctx.runHint).toBe("npm run test");
  });

  it("falls back to generic with no run hint when nothing matches", () => {
    const ctx = detectWorkKind(ev({ touchedFiles: ["README.md"] }));
    expect(ctx.kind).toBe("generic");
    expect(ctx.runHint).toBeUndefined();
    expect(ctx.urlHint).toBeUndefined();
  });

  it("prefers web over api when both a UI file and a server idiom are present", () => {
    const ctx = detectWorkKind(
      ev({ touchedFiles: ["src/App.tsx", "src/server.ts"], addedText: "app.get('/x')" }),
    );
    expect(ctx.kind).toBe("web");
  });
});
