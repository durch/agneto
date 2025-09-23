// Human interaction types for handling 'needs-human' verdict
export type HumanDecision = 'approve' | 'reject' | 'retry';

export interface HumanInteractionResult {
    decision: HumanDecision;
    feedback?: string; // Optional feedback for retry case
}