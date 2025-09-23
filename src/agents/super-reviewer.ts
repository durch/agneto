import { readFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { SuperReviewerVerdict, SuperReviewerResult } from "../types.js";

export async function runSuperReviewer(
    provider: LLMProvider, 
    cwd: string, 
    planMd: string,
    completedSteps: number,
    totalSteps: number
): Promise<SuperReviewerResult> {
    const sys = readFileSync(new URL("../prompts/super-reviewer.md", import.meta.url), "utf8");
    
    const res = await provider.query({
        cwd,
        mode: "default", // Allow read tools for comprehensive review
        allowedTools: ["ReadFile", "Grep", "Bash"], // Include Bash for test/build verification
        messages: [
            { role: "system", content: sys },
            { role: "user", content: `Plan (Markdown):\n\n${planMd}\n\nCompleted steps: ${completedSteps}/${totalSteps}\n\nPerform comprehensive review and provide verdict.` }
        ]
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