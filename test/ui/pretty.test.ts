import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import { prettyPrint } from "@/ui/pretty.js";

describe("prettyPrint", () => {
  it("preserves surrounding text for bullet lists with fenced code", () => {
    const input = [
      "- item:",
      "```ts",
      "const value = 1;",
      "```",
      "More info"
    ].join("\n");

    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("• item:");
    expect(plain).toContain("More info");
    expect(plain).toContain("const value = 1;");
  });
});
