import { describe, expect, it } from "vitest";
import { runPipeline } from "./pipeline.js";
import { parseTranscript } from "./transcript.js";

const jsonl = (entries: unknown[]) => entries.map((e) => JSON.stringify(e)).join("\n");

describe("runPipeline (end-to-end, tool evidence only)", () => {
  it("catches a phantom change: claimed work with no matching diff", () => {
    const raw = jsonl([
      { type: "user", message: { role: "user", content: "add rate limiting" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "Write",
              input: { file_path: "README.md", content: "# Docs\nSome rate limiting prose." },
            },
          ],
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Done! I added a `rateLimiter` middleware and wrote tests for it.",
            },
          ],
        },
      },
    ]);

    const report = runPipeline({ turn: parseTranscript(raw) });
    expect(report.summary.unsupported).toBeGreaterThanOrEqual(1);

    const rateLimiter = report.verdicts.find((v) => v.claim.target === "rateLimiter");
    expect(rateLimiter?.level).toBe("unsupported");
  });

  it("verifies an honest turn where the diff backs the summary", () => {
    const raw = jsonl([
      { type: "user", message: { role: "user", content: "add validation" } },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "Edit",
              input: {
                file_path: "src/auth.ts",
                old_string: "// here",
                new_string: "export function validateInput(x) { return !!x; }",
              },
            },
          ],
        },
      },
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Added `validateInput` to `src/auth.ts`." }],
        },
      },
    ]);

    const report = runPipeline({ turn: parseTranscript(raw) });
    expect(report.summary.unsupported).toBe(0);
    expect(report.summary.verified).toBeGreaterThanOrEqual(2);
  });

  it("produces an empty report when the summary has no checkable claims", () => {
    const report = runPipeline({ turn: { summary: "All good!", toolUses: [] } });
    expect(report.verdicts).toHaveLength(0);
  });
});
