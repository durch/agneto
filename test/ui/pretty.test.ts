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

  it("preserves all text with bold formatting", () => {
    const input = "This is **bold text** and this is normal";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("This is bold text and this is normal");
  });

  it("preserves all text with italic formatting", () => {
    const input = "This is *italic text* and this is normal";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("This is italic text and this is normal");
  });

  it("preserves all text with inline code", () => {
    const input = "This is `code text` and this is normal";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("This is code text and this is normal");
  });

  it("handles mixed formatting without losing text", () => {
    const input = "This **bold** and *italic* and `code` text";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("This bold and italic and code text");
  });

  it("handles unmatched asterisks without losing text", () => {
    const input = "This * is not italic and ** is not bold";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("This * is not italic and ** is not bold");
  });

  it("handles unmatched backticks without losing text", () => {
    const input = "This ` is not code and should remain";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("This ` is not code and should remain");
  });

  it("preserves text with multiple asterisks", () => {
    const input = "Math: 2 * 3 * 4 = 24";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("Math: 2 * 3 * 4 = 24");
  });

  it("handles edge cases with asterisks at boundaries", () => {
    const input = "*start and end*";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("start and end");
  });

  it("preserves all content in complex markdown", () => {
    const input = [
      "# Header",
      "",
      "This is a paragraph with **bold**, *italic*, and `code`.",
      "",
      "- Bullet 1 with *emphasis*",
      "- Bullet 2 with **strong**",
      "",
      "Normal text after bullets"
    ].join("\n");

    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    // Check all content is preserved
    expect(plain).toContain("Header");
    expect(plain).toContain("This is a paragraph with bold, italic, and code");
    expect(plain).toContain("• Bullet 1 with emphasis");
    expect(plain).toContain("• Bullet 2 with strong");
    expect(plain).toContain("Normal text after bullets");
  });

  it("converts bullet dashes to bullet symbols", () => {
    const input = "- Item 1\n- Item 2";
    const output = prettyPrint(input, { width: 80 });
    const plain = stripAnsi(output);

    expect(plain).toContain("• Item 1");
    expect(plain).toContain("• Item 2");
  });
});
