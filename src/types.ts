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