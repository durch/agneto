// Human interaction types for handling 'needs-human' verdict
export type HumanDecision = 'approve' | 'reject' | 'retry';

export interface HumanInteractionResult {
    decision: HumanDecision;
    feedback?: string; // Optional feedback for retry case
}

// SuperReviewer types
export type SuperReviewerVerdict = 'approve' | 'needs-human';

export interface SuperReviewerResult {
    verdict: SuperReviewerVerdict;
    summary: string;
    issues?: string[];
}

// Task refinement types
export interface RefinedTask {
    goal: string;
    context: string;
    constraints: string[];
    successCriteria: string[];
    raw: string; // Original refined output for reference
}

// Protocol message types for two-phase coder-reviewer interaction
export interface CoderPlanProposal {
    type: "PLAN_PROPOSAL";
    description: string;
    steps: string[];
    affectedFiles: string[];
}

export interface ReviewerPlanVerdict {
    type: "PLAN_VERDICT";
    verdict: "approve-plan" | "revise-plan" | "reject-plan" | "needs-human" | "already-complete";
    feedback?: string;
}

export interface CoderCodeApplied {
    type: "CODE_APPLIED";
    description: string;
    filesChanged: string[];
}

export interface ReviewerCodeVerdict {
    type: "CODE_VERDICT";
    verdict: "approve-code" | "revise-code" | "reject-code" | "step-complete" | "task-complete" | "needs-human";
    feedback?: string;
}

// Bean Counter types for work chunking
export interface BeanCounterWorkChunk {
    type: "WORK_CHUNK";
    description: string;
    requirements: string[];
    context: string;
}

export interface BeanCounterTaskComplete {
    type: "TASK_COMPLETE";
    description: string;
    requirements: string[];
    context: string;
}