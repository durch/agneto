# Task Refiner Interactive Clarifying Questions

## Context
The Task Refiner currently performs one-shot refinement. This enhancement adds a Q&A loop where the Refiner can ask focused clarifying questions when task descriptions are vague. Implementation uses sequential one-question-at-a-time interaction for simplicity, maintaining session state between questions. Maximum 3 questions enforced before proceeding to final refinement.

## Acceptance Criteria
- Refiner detects vague/incomplete tasks and generates focused clarifying questions
- Refiner interpreter distinguishes between question responses and final refined output
- Sequential Q&A loop implemented: one question → answer → next question or refinement
- Hard limit of 3 questions maximum before forcing final refinement
- Refiner maintains session across Q&A iterations
- Existing TextInputModal reused for question display
- Final refinement flows into existing approval mechanism
- User experience: vague task → sequential questions → final refinement → approval

## Risks & Rollbacks
- **Risk**: Refiner session corruption between Q&A rounds
  - Mitigation: Add session validation before each followup call
  - Rollback: Disable Q&A feature flag, fall back to one-shot refinement
- **Risk**: Infinite question loops despite hard limit
  - Mitigation: Enforce counter in orchestrator, throw error if exceeded
  - Rollback: Skip refinement phase entirely, use raw task description

## Steps

### 1. Add session management to RefinerAgent
**Intent**: Enable session persistence across Q&A iterations

**Files**: `src/agents/refiner.ts`

**Changes**:
- Add `private sessionId: string | undefined` field to RefinerAgent class
- In `refine()` method: Initialize sessionId using `generateUUID()` before first provider call
- Create new `async askFollowUp(previousAnswer: string): Promise<string>` method that:
  - Validates `this.sessionId` exists (throw if missing)
  - Calls `provider.query()` with existing sessionId and user's answer
  - Returns raw response for interpreter

**Verification**: 
- `npm run build` succeeds
- Grep for `sessionId.*RefinerAgent` confirms field exists
- ReadFile refiner.ts shows askFollowUp method signature matches

**Confidence**: High - follows existing Bean Counter/Coder/Reviewer session pattern (orchestrator.ts:52-57)

---

### 2. Create refiner interpreter
**Intent**: Detect whether refiner response contains question or final refinement

**Files**: 
- `src/protocol/interpreter.ts` (add function)
- `src/prompts/interpreter-refiner.md` (new file)

**Changes**:
- Add `interpretRefinerResponse(response: string): {type: 'question', question: string} | {type: 'refinement', content: string}` function
- Create interpreter prompt specifying detection logic:
  - Question indicators: "I need to clarify:", "Could you specify:", question marks in first 2 sentences
  - Refinement indicators: structured spec format, numbered lists of features, acceptance criteria sections
  - Format: Questions must be single clear question, not lists
- Use fast Sonnet call (no session needed - stateless interpretation)

**Verification**:
- `npm run build` succeeds
- Grep for `interpretRefinerResponse` shows export in interpreter.ts
- Manual test: Call with "I need to clarify: What user authentication method?" returns `{type: 'question', ...}`
- Manual test: Call with "## Refined Task\n..." returns `{type: 'refinement', ...}`

**Confidence**: Medium - new interpreter type but follows existing pattern (interpreter.ts:74 parseCoderKeywords)

**Concern**: Question extraction from natural language may be fragile. Recommend validation that question field is non-empty before returning.

---

### 3. Update refiner prompt with Q&A guidance
**Intent**: Instruct refiner when and how to ask clarifying questions

**Files**: `src/prompts/refiner.md`

**Changes**:
- Add section: "## Clarifying Questions" explaining:
  - Ask questions when critical details missing (authentication method, data model, user flow)
  - Don't ask questions for minor details or stylistic choices
  - Format: Single focused question, not multiple questions
  - Example good question: "Should user authentication use JWT tokens or session cookies?"
  - Example bad question: "What color should the button be?"
- Add note: After 3rd question, must provide refinement regardless of clarity

**Verification**:
- ReadFile refiner.md shows new section exists
- Grep for "Clarifying Questions" returns match in prompts/refiner.md

**Confidence**: High - documentation change only

---

### 4. Store current question in TaskStateMachine
**Intent**: Enable UI to display active question during Q&A loop

**Files**: `src/task-state-machine.ts`

**Changes**:
- Add `private currentQuestion: string | null = null` field
- Add `getCurrentQuestion(): string | null` getter
- Add `setCurrentQuestion(question: string | null)` method (no state transition)
- Add `clearCurrentQuestion()` convenience method calling `setCurrentQuestion(null)`

**Verification**:
- `npm run build` succeeds
- Grep for `currentQuestion.*TaskStateMachine` shows field/methods exist
- No new TaskEvent or TaskState entries (no state changes needed)

**Confidence**: High - simple state storage, no event complexity

---

### 5. Implement Q&A loop in orchestrator refinement phase
**Intent**: Coordinate question → answer → refinement cycle with hard limit

**Files**: `src/orchestrator.ts` (modify `TASK_REFINING` case)

**Changes**:
- Track question count: `let questionCount = 0; const MAX_QUESTIONS = 3;`
- After initial `refiner.refine()` call:
  - Interpret response using `interpretRefinerResponse()`
  - If type === 'question' AND questionCount < MAX_QUESTIONS:
    - Store question: `taskStateMachine.setCurrentQuestion(result.question)`
    - Re-render Ink UI to show question modal
    - Create answer promise with resolver (follow planning approval pattern)
    - Pass resolver callback to UI
    - Await user answer
    - Call `refiner.askFollowUp(answer)`
    - Increment questionCount
    - Loop back to interpret response
  - If type === 'refinement' OR questionCount >= MAX_QUESTIONS:
    - Store refinement: `taskStateMachine.setPendingRefinement(result.content || rawResponse)`
    - Clear question: `taskStateMachine.clearCurrentQuestion()`
    - Proceed to approval flow

**Verification**:
- `npm run build` succeeds
- ReadFile orchestrator.ts shows question count tracking and MAX_QUESTIONS constant
- Grep for `askFollowUp.*questionCount` confirms loop implementation
- Integration test: Start task with vague description "add auth", observe up to 3 questions asked before refinement

**Confidence**: Medium - complex control flow but follows promise-based approval pattern

**Concern**: Loop termination logic must be bulletproof. Recommend adding `if (questionCount > MAX_QUESTIONS) throw new Error("Safety limit exceeded")` as failsafe.

---

### 6. Add question modal UI component
**Intent**: Display current question and capture user answer

**Files**: 
- `src/ui/ink/components/PlanningLayout.tsx`
- `src/ui/ink/App.tsx`

**Changes**:
- In PlanningLayout: Check `taskStateMachine.getCurrentQuestion()`
- If question exists, render TextInputModal:
  ```tsx
  <TextInputModal
    title="Clarifying Question"
    placeholder="Enter your answer (Ctrl+Enter to submit)"
    value={currentQuestion}
    onSubmit={(answer) => resolveAnswer(answer)}
    onCancel={() => resolveAnswer("")}
  />
  ```
- Add `onAnswerCallback` prop to PlanningLayout (follows `onFeedbackCallback` pattern)
- In App.tsx: Pass answer resolver callback to PlanningLayout when state is TASK_REFINING

**Verification**:
- `npm run build` succeeds
- Grep for `TextInputModal.*Clarifying Question` shows usage in PlanningLayout
- Manual UI test: Question modal displays with proper title and placeholder
- Ctrl+Enter triggers submit, Esc triggers cancel

**Confidence**: High - reuses existing TextInputModal component (no new modal creation)

---

### 7. Integration testing
**Intent**: Verify end-to-end Q&A flow works correctly

**Files**: None (manual testing procedure)

**Testing Steps**:
1. Start task with vague description: `npm start -- "add authentication"`
2. Observe refiner asks first clarifying question (e.g., "What authentication method?")
3. Answer question: "Use JWT tokens"
4. Observe refiner asks second question or provides refinement
5. Continue until max 3 questions or refinement provided
6. Verify final refinement flows into approval modal (approve/reject)
7. Test edge case: Start task with clear description "Add JWT token authentication with 15-minute expiry", verify refiner skips Q&A and goes straight to refinement
8. Test safety limit: Manually modify MAX_QUESTIONS to 1, verify only 1 question asked before forced refinement

**Verification**:
- All 3 test scenarios complete without errors
- Question count never exceeds MAX_QUESTIONS
- Session maintained across Q&A iterations (no "session not found" errors)
- UI transitions smoothly between question modal and approval modal

**Confidence**: Medium - integration testing reveals wiring issues not caught by unit tests

**TODO**: If refiner consistently asks irrelevant questions, revise refiner.md prompt with better guidance on question quality.
