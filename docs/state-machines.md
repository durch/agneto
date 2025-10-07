# Agneto State Machines

This document visualizes the two-level state machine architecture in Agneto.

## Task State Machine (Parent - Overall Task Lifecycle)

```mermaid
flowchart TD
    Start([Start Task]) --> Interactive{Interactive<br/>Mode?}

    Interactive -->|Yes| Refine[Task Refiner:<br/>Improve Description]
    Interactive -->|No| Plan

    Refine --> RefineApproval{👤 User<br/>Approves?}
    RefineApproval -->|Yes| Plan[Planner:<br/>Create Plan]
    RefineApproval -->|No, use original| Plan

    Plan --> Curmudgeon[Curmudgeon:<br/>Review Plan]

    Curmudgeon --> CurmudgeonLoop{Auto-cycle:<br/>Planner ↔<br/>Curmudgeon<br/>up to 4x}
    CurmudgeonLoop -->|Needs simplification| Plan
    CurmudgeonLoop -->|Ready| PlanApproval

    PlanApproval{👤 User<br/>Approves<br/>Plan?} -->|Yes| Execute
    PlanApproval -->|Reject| PlanRevise[Planner:<br/>Revise Plan<br/>skips Curmudgeon]
    PlanRevise --> PlanApproval

    Execute[Bean Counter/Coder/Reviewer<br/>Execution Loop<br/>see below] --> SuperReview

    SuperReview[SuperReviewer:<br/>Final Quality Check] --> SuperResult{Result?}

    SuperResult -->|Pass| Finalize[Finalize & Merge]
    SuperResult -->|Needs Human| HumanDecision{👤 User<br/>Decision?}

    HumanDecision -->|Approve| Finalize
    HumanDecision -->|Retry| Plan
    HumanDecision -->|Abandon| Abandoned

    Finalize --> Complete([Task Complete])

    Plan -.->|Error| Abandoned([Task Abandoned])
    Execute -.->|Error| Abandoned
    SuperReview -.->|Error| Abandoned

    style Refine fill:#e1f5ff
    style Plan fill:#e1f5ff
    style Curmudgeon fill:#e1f5ff
    style PlanRevise fill:#e1f5ff
    style Execute fill:#fff4e1
    style SuperReview fill:#e1f5ff
    style Finalize fill:#e1ffe1
    style RefineApproval fill:#ffe1e1
    style PlanApproval fill:#ffe1e1
    style HumanDecision fill:#ffe1e1
    style Complete fill:#e1ffe1
    style Abandoned fill:#fee
```

## Execution State Machine (Bean Counter/Coder/Reviewer Loop)

```mermaid
flowchart TD
    Start([Start Execution]) --> BeanCounter

    BeanCounter[Bean Counter:<br/>Determine Next Work Chunk] --> ChunkReady{Chunk<br/>Ready?}

    ChunkReady -->|Yes| Coder[Coder:<br/>Propose Implementation]
    ChunkReady -->|All Done| Complete([Execution Complete])

    Coder --> CoderAttempt{Attempt<br/>< Max?}
    CoderAttempt -->|No| Failed([Execution Failed])
    CoderAttempt -->|Yes| PlanReview

    PlanReview[Reviewer:<br/>Review Implementation Plan] --> PlanVerdict{Reviewer<br/>Verdict?}

    PlanVerdict -->|Approve| Implement[Coder:<br/>Apply Changes]
    PlanVerdict -->|Already Done| BeanCounter
    PlanVerdict -->|Revise| Coder
    PlanVerdict -->|Reject| BeanCounter
    PlanVerdict -->|Needs Human| PlanHuman{👤 User<br/>Decision?}

    PlanHuman -->|Approve| Implement
    PlanHuman -->|Reject| Coder
    PlanHuman -->|Abort| Aborted([Task Aborted])

    Implement --> ImplementAttempt{Attempt<br/>< Max?}
    ImplementAttempt -->|No| Failed
    ImplementAttempt -->|Yes| CodeReview

    CodeReview[Reviewer:<br/>Review Implementation] --> CodeVerdict{Reviewer<br/>Verdict?}

    CodeVerdict -->|Approve| BeanCounter
    CodeVerdict -->|Revise| Implement
    CodeVerdict -->|Reject| BeanCounter
    CodeVerdict -->|Needs Human| CodeHuman{👤 User<br/>Decision?}

    CodeHuman -->|Approve| BeanCounter
    CodeHuman -->|Reject| Implement
    CodeHuman -->|Abort| Aborted

    BeanCounter -.->|User Abort| Aborted
    Coder -.->|User Abort| Aborted
    Implement -.->|User Abort| Aborted

    style BeanCounter fill:#fff4e1
    style Coder fill:#e1f5ff
    style PlanReview fill:#f0e1ff
    style Implement fill:#e1f5ff
    style CodeReview fill:#f0e1ff
    style Complete fill:#e1ffe1
    style Failed fill:#fee
    style Aborted fill:#fee
    style PlanHuman fill:#ffe1e1
    style CodeHuman fill:#ffe1e1
```

## User Interaction Points Summary

### Task State Machine
| State | Interaction | Trigger Event | User Options |
|-------|-------------|---------------|--------------|
| `TASK_REFINING` | Task refinement approval | After Task Refiner proposes refinement | Approve (REFINEMENT_COMPLETE) / Reject (REFINEMENT_CANCELLED) |
| `TASK_CURMUDGEONING` | Plan approval after Curmudgeon review | After Planner ↔ Curmudgeon auto-cycles complete (up to 4x) | Approve (CURMUDGEON_APPROVED) / Reject (CURMUDGEON_SIMPLIFY)* |
| `TASK_SUPER_REVIEWING` | Final review decision | SuperReviewer returns NEEDS_HUMAN | Approve (HUMAN_APPROVED) / Retry (HUMAN_RETRY) / Abandon (HUMAN_ABANDON) |

\* **Note:** After the first user review (approve or reject), subsequent planning iterations skip Curmudgeon review. User becomes the reviewer for all revisions.

### Execution State Machine
| State | Interaction | Trigger Event | User Options |
|-------|-------------|---------------|--------------|
| `PLAN_REVIEW` | Plan needs human review | Reviewer returns NEEDS_HUMAN for plan | Approve / Reject / Provide feedback |
| `CODE_REVIEW` | Code needs human review | Reviewer returns NEEDS_HUMAN for code | Approve / Reject / Provide feedback |
| Any state | User abort | User requests abort (Ctrl+C, etc.) | Task transitions to TASK_ABORTED |

## Architecture Notes

- **Two-level architecture**: The Task State Machine manages the overall lifecycle, while the Execution State Machine handles the Bean Counter/Coder/Reviewer loop
- **TASK_EXECUTING delegates**: When the Task State Machine enters `TASK_EXECUTING`, it creates and runs an Execution State Machine
- **Conservative by design**: Multiple review points ensure quality and give users control
- **Non-interactive mode**: Skips `TASK_REFINING` and `TASK_CURMUDGEONING` approval points
- **Session-based**: Bean Counter maintains progress ledger across chunks; Coder and Reviewer have separate sessions
- **Error recovery**: Both machines handle errors gracefully with retries and fallbacks
- **Curmudgeon auto-cycles**: Planner ↔ Curmudgeon automatically cycles up to 4 times to simplify over-engineered plans before showing to user
- **User-driven revisions skip Curmudgeon**: Once user reviews a plan (approve or reject), subsequent revisions skip Curmudgeon review - user becomes the reviewer
