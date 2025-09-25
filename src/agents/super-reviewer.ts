import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { SuperReviewerVerdict, SuperReviewerResult } from "../types.js";
import { log } from "../ui/log.js";

export async function runSuperReviewer(
    provider: LLMProvider,
    cwd: string,
    planMd: string
): Promise<SuperReviewerResult> {
    const sys = readFileSync(new URL("../prompts/super-reviewer.md", import.meta.url), "utf8");

    log.startStreaming("Super-Reviewer");

    const res = await provider.query({
        cwd,
        mode: "default", // Allow read tools for comprehensive review
        allowedTools: ["ReadFile", "Grep", "Bash"], // Include Bash for test/build verification
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\nPerform comprehensive review and provide verdict on the implementation.` }
        ],
        callbacks: {
            onProgress: log.streamProgress,
            onToolUse: (tool, input) => log.toolUse("Super-Reviewer", tool, input),
            onToolResult: (isError) => log.toolResult("Super-Reviewer", isError),
            onComplete: (cost, duration) => log.complete("Super-Reviewer", cost, duration)
        }
    });
    
    // Parse the response to extract verdict and details
    const lines = res.trim().split("\n");
    const verdictLine = lines.find(line => line.startsWith("VERDICT:"));
    const summaryLine = lines.find(line => line.startsWith("SUMMARY:"));
    const issuesLines = lines.filter(line => line.startsWith("ISSUE:"));
    
    const verdict: SuperReviewerVerdict = verdictLine?.includes("approve") ? "approve" : "needs-human";
    const summary = summaryLine?.replace("SUMMARY:", "").trim() || "No summary provided";
    const issues = issuesLines.length > 0 
        ? issuesLines.map(line => line.replace("ISSUE:", "").trim())
        : undefined;
    
    return { verdict, summary, issues };
}