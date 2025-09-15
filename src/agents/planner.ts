import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import {
    displayPlan,
    getPlanFeedback,
    confirmPlanApproval,
    showPlanningComplete,
    formatFeedbackForPlanner,
    type PlanFeedback
} from "../ui/planning-interface.js";
import { log } from "../ui/log.js";

export async function runPlanner(
    provider: LLMProvider,
    cwd: string,
    task: string,
    taskId: string,
    interactive: boolean = false
): Promise<{ planMd: string; planPath: string }> {
    const sys = readFileSync(new URL("../prompts/planner.md", import.meta.url), "utf8");

    if (!interactive) {
        // Original non-interactive behavior
        const planMd = (await provider.query({
            cwd,
            mode: "plan",
            messages: [
                { role: "system", content: sys },
                { role: "user", content: `Task: ${task}\n\nProduce ONLY the Markdown plan.` }
            ]
        })).trim();

        const planDir = `${cwd}/.plans/${taskId}`;
        mkdirSync(planDir, { recursive: true });
        const planPath = `${planDir}/plan.md`;
        writeFileSync(planPath, planMd + "\n");
        return { planMd, planPath };
    }

    // Interactive planning with iterative refinement
    return await interactivePlanning(provider, cwd, task, taskId, sys);
}

async function interactivePlanning(
    provider: LLMProvider,
    cwd: string,
    task: string,
    taskId: string,
    systemPrompt: string
): Promise<{ planMd: string; planPath: string }> {
    let planMd = "";
    let approved = false;
    let iteration = 0;
    const maxIterations = 5;
    let currentTask = task;
    let feedbackHistory: string[] = [];

    log.planner("Starting interactive planning session...");

    while (!approved && iteration < maxIterations) {
        // Generate or refine plan
        if (iteration === 0) {
            log.planner("Generating initial plan...");
            planMd = (await provider.query({
                cwd,
                mode: "plan",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Task: ${currentTask}\n\nProduce ONLY the Markdown plan.` }
                ]
            })).trim();
        } else {
            log.planner("Refining plan based on your feedback...");
            const feedbackContext = feedbackHistory.join("\n\n");
            planMd = (await provider.query({
                cwd,
                mode: "plan",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Original task: ${task}\n\nCurrent plan:\n${planMd}\n\nFeedback history:\n${feedbackContext}\n\nPlease revise the plan based on the feedback. Produce ONLY the updated Markdown plan.` }
                ]
            })).trim();
        }

        // Display the plan
        await displayPlan(planMd, iteration + 1);

        // Get human feedback
        const feedback = await getPlanFeedback();

        if (feedback.type === "approve") {
            approved = await confirmPlanApproval(iteration);
            if (!approved) {
                // User changed their mind, continue refining
                continue;
            }
        } else if (feedback.type === "start-over") {
            // Reset with new task description
            currentTask = feedback.details || task;
            iteration = 0;
            feedbackHistory = [`Restarted with new task: ${currentTask}`];
            continue;
        } else {
            // Add feedback to history for context
            const formattedFeedback = formatFeedbackForPlanner(feedback);
            feedbackHistory.push(formattedFeedback);
            iteration++;
        }
    }

    if (!approved && iteration >= maxIterations) {
        log.human(`Reached maximum iterations (${maxIterations}). Using current plan.`);
        const useCurrentPlan = await confirmPlanApproval(iteration);
        if (!useCurrentPlan) {
            throw new Error("Planning cancelled after maximum iterations");
        }
    }

    // Save the final plan
    const planDir = `${cwd}/.plans/${taskId}`;
    mkdirSync(planDir, { recursive: true });
    const planPath = `${planDir}/plan.md`;

    // Add metadata about the planning session
    const planWithMetadata = `${planMd}\n\n---\n_Plan created after ${iteration + 1} iteration(s) with human feedback_\n`;
    writeFileSync(planPath, planWithMetadata);

    // Save feedback history for audit
    if (feedbackHistory.length > 0) {
        const feedbackPath = `${planDir}/planning-feedback.md`;
        writeFileSync(feedbackPath, `# Planning Feedback History\n\n${feedbackHistory.join("\n\n")}`);
    }

    await showPlanningComplete(planPath);
    return { planMd, planPath };
}
