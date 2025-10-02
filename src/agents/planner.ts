import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { LLMProvider } from "../providers/index.js";
import type { SuperReviewerResult } from "../types.js";
import {
  displayPlan,
  getPlanFeedback,
  confirmPlanApproval,
  showPlanningComplete,
  formatFeedbackForPlanner,
  type PlanFeedback,
} from "../ui/planning-interface.js";
import { log } from "../ui/log.js";
import React from "react";
import { App } from "../ui/ink/App.js";
import { summarizeToolParams } from "../utils/tool-summary.js";

export async function runPlanner(
  provider: LLMProvider,
  cwd: string,
  task: string,
  taskId: string,
  interactive: boolean = false,
  curmudgeonFeedback?: string,
  superReviewerFeedback?: SuperReviewerResult,
  uiCallback?: (feedback: Promise<PlanFeedback>, rerenderCallback?: () => void) => void,
  taskStateMachine?: any,
  inkInstance?: { waitUntilExit: () => Promise<void>; unmount: () => void; rerender: (node: React.ReactElement) => void } | null
): Promise<{ planMd: string | undefined; planPath: string }> {
  const sys = readFileSync(
    new URL("../prompts/planner.md", import.meta.url),
    "utf8"
  );

  if (!interactive) {
    // Non-interactive with streaming
    log.startStreaming("Planner");

    let userMessage = `Task: ${task}`;
    if (curmudgeonFeedback) {
      userMessage += `\n\nThe Curmudgeon has reviewed your previous plan with the following feedback:\n\n${curmudgeonFeedback}\n\nPlease address this feedback in your revised plan.`;
    }
    if (superReviewerFeedback) {
      userMessage += `\n\nPrevious implementation was reviewed by SuperReviewer with the following feedback:\n`;
      userMessage += `Summary: ${superReviewerFeedback.summary}\n`;
      if (superReviewerFeedback.issues && superReviewerFeedback.issues.length > 0) {
        userMessage += `\nSpecific issues to address:\n`;
        superReviewerFeedback.issues.forEach((issue, index) => {
          userMessage += `${index + 1}. ${issue}\n`;
        });
      }
      userMessage += `\nCreate a new plan that specifically addresses these concerns.`;
    }
    userMessage += "\n\nProduce ONLY the Markdown plan.";

    const planMd = (
      await provider.query({
        cwd,
        mode: "default",
        allowedTools: ["ReadFile", "Grep", "Bash"],
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: userMessage,
          },
        ],
        callbacks: {
          onProgress: (update: string) => {
            log.streamProgress(update);
            if (taskStateMachine && inkInstance) {
              taskStateMachine.setLiveActivityMessage("Planner", update);
              // Removed rerender - streaming updates aren't displayed anyway due to length filter in UI
              // inkInstance.rerender(React.createElement(App, { taskStateMachine }));
            }
          },
          onToolUse: (tool, input) => {
            log.toolUse("Planner", tool, input);
            if (taskStateMachine) {
              taskStateMachine.setToolStatus("Planner", tool, summarizeToolParams(tool, input));
            }
          },
          onToolResult: (isError) => {
            log.toolResult("Planner", isError);
            if (taskStateMachine) {
              taskStateMachine.clearToolStatus();
            }
          },
          onComplete: (cost, duration) =>
            log.complete("Planner", cost, duration),
        },
      })
    )?.trim();

    const planDir = `${cwd}/.plans/${taskId}`;
    mkdirSync(planDir, { recursive: true });
    const planPath = `${planDir}/plan.md`;
    writeFileSync(planPath, planMd + "\n");
    return { planMd, planPath };
  }

  // Interactive planning with iterative refinement
  return await interactivePlanning(provider, cwd, task, taskId, sys, curmudgeonFeedback, superReviewerFeedback, uiCallback, taskStateMachine, inkInstance);
}

async function interactivePlanning(
  provider: LLMProvider,
  cwd: string,
  task: string,
  taskId: string,
  systemPrompt: string,
  curmudgeonFeedback?: string,
  superReviewerFeedback?: SuperReviewerResult,
  uiCallback?: (feedback: Promise<PlanFeedback>, rerenderCallback?: () => void) => void,
  taskStateMachine?: any,
  inkInstance?: { waitUntilExit: () => Promise<void>; unmount: () => void; rerender: (node: React.ReactElement) => void } | null
): Promise<{ planMd: string | undefined; planPath: string }> {
  let planMd = undefined;
  let approved = false;
  let iteration = 0;
  const maxIterations = 5;
  let currentTask = task;
  let feedbackHistory: string[] = [];

  // If we have Curmudgeon feedback, add it to the feedback history
  if (curmudgeonFeedback) {
    feedbackHistory.push(`Curmudgeon review feedback: ${curmudgeonFeedback}`);
    log.planner("Starting interactive planning with Curmudgeon feedback...");
  }

  // If we have SuperReviewer feedback, add it to the feedback history
  if (superReviewerFeedback) {
    let superReviewerNote = `SuperReviewer feedback - ${superReviewerFeedback.summary}`;
    if (superReviewerFeedback.issues && superReviewerFeedback.issues.length > 0) {
      superReviewerNote += `\nSpecific issues to address:\n`;
      superReviewerFeedback.issues.forEach((issue, index) => {
        superReviewerNote += `${index + 1}. ${issue}\n`;
      });
    }
    feedbackHistory.push(superReviewerNote);
    log.planner("Starting interactive planning with SuperReviewer feedback...");
  }

  if (feedbackHistory.length === 0) {
    log.planner("Starting interactive planning session...");
  }

  while (!approved && iteration < maxIterations) {
    // Generate or refine plan with streaming
    if (iteration === 0 && feedbackHistory.length === 0) {
      // First iteration with no prior feedback
      log.startStreaming("Planner");
      planMd = (
        await provider.query({
          cwd,
          mode: "default",
          allowedTools: ["ReadFile", "Grep", "Bash"],
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Task: ${currentTask}\n\nProduce ONLY the Markdown plan.`,
            },
          ],
          callbacks: {
            onProgress: (update: string) => {
              log.streamProgress(update);
              if (taskStateMachine && inkInstance) {
                taskStateMachine.setLiveActivityMessage("Planner", update);
                // Removed rerender - streaming updates aren't displayed anyway due to length filter in UI
                // inkInstance.rerender(React.createElement(App, { taskStateMachine }));
              }
            },
            onToolUse: (tool, input) => {
              log.toolUse("Planner", tool, input);
              if (taskStateMachine) {
                taskStateMachine.setToolStatus("Planner", tool, summarizeToolParams(tool, input));
              }
            },
            onToolResult: (isError) => {
              log.toolResult("Planner", isError);
              if (taskStateMachine) {
                taskStateMachine.clearToolStatus();
              }
            },
            onComplete: (cost, duration) =>
              log.complete("Planner", cost, duration),
          },
        })
      )?.trim();
    } else {
      // Either iteration > 0 OR we have curmudgeon feedback at iteration 0
      log.startStreaming("Planner");
      const feedbackContext = feedbackHistory.join("\n\n");

      // Determine the appropriate prompt based on whether we have a plan yet
      const userContent: string = planMd
        ? `Original task: ${task}\n\nCurrent plan:\n${planMd}\n\nFeedback history:\n${feedbackContext}\n\nPlease revise the plan based on the feedback. Produce ONLY the updated Markdown plan.`
        : `Task: ${currentTask}\n\nFeedback:\n${feedbackContext}\n\nProduce ONLY the Markdown plan that addresses this feedback.`;

      planMd = (
        await provider.query({
          cwd,
          mode: "default",
          allowedTools: ["ReadFile", "Grep", "Bash"],
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: userContent,
            },
          ],
          callbacks: {
            onProgress: (update: string) => {
              log.streamProgress(update);
              if (taskStateMachine && inkInstance) {
                taskStateMachine.setLiveActivityMessage("Planner", update);
                // Removed rerender - streaming updates aren't displayed anyway due to length filter in UI
                // inkInstance.rerender(React.createElement(App, { taskStateMachine }));
              }
            },
            onToolUse: (tool, input) => {
              log.toolUse("Planner", tool, input);
              if (taskStateMachine) {
                taskStateMachine.setToolStatus("Planner", tool, summarizeToolParams(tool, input));
              }
            },
            onToolResult: (isError) => {
              log.toolResult("Planner", isError);
              if (taskStateMachine) {
                taskStateMachine.clearToolStatus();
              }
            },
            onComplete: (cost, duration) =>
              log.complete("Planner", cost, duration),
          },
        })
      )?.trim();
    }

    // Display the plan (skip if using Ink UI as it will handle display)
    if (!uiCallback) {
      await displayPlan(planMd, iteration + 1);
    }

    // Get human feedback - use uiCallback if provided (Ink UI mode), otherwise use terminal interface
    let feedback: PlanFeedback;
    if (uiCallback) {
      // Create a promise that will be resolved by the Ink UI keyboard handler
      let resolverFunc: ((value: PlanFeedback) => void) | null = null;
      const feedbackPromise = new Promise<PlanFeedback>((resolve) => {
        resolverFunc = resolve;
      });
      // Attach the resolver to the promise object for the UI to access
      (feedbackPromise as any).resolve = resolverFunc;
      // Invoke the callback with the promise (orchestrator will wire it to Ink UI)
      uiCallback(feedbackPromise);
      // Wait for the UI to resolve the promise
      feedback = await feedbackPromise;
    } else {
      // Fall back to terminal-based getPlanFeedback
      feedback = await getPlanFeedback();
    }

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
    log.orchestrator(
      `Reached maximum iterations (${maxIterations}). Using current plan.`
    );
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
  const planWithMetadata = `${planMd}\n\n---\n_Plan created after ${
    iteration + 1
  } iteration(s) with human feedback_\n`;
  writeFileSync(planPath, planWithMetadata);

  // Save feedback history for audit
  if (feedbackHistory.length > 0) {
    const feedbackPath = `${planDir}/planning-feedback.md`;
    writeFileSync(
      feedbackPath,
      `# Planning Feedback History\n\n${feedbackHistory.join("\n\n")}`
    );
  }

  // Skip console output in Ink mode
  if (!uiCallback) {
    await showPlanningComplete(planPath);
  }

  return { planMd, planPath };
}
