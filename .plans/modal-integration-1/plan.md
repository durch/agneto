# Replace Inline Rejection Feedback with TextInputModal

## Context
The SuperReviewer retry flow already uses TextInputModal successfully. We'll extend the same pattern to handle refinement and plan rejection feedback collection. Both rejection types need different prompts but share the same modal infrastructure and promise resolution pattern.

## Acceptance Criteria
- Pressing 'R' during TASK_REFINING opens modal titled "Reject Refinement" with placeholder "Why is this refinement incorrect? (e.g., 'wrong scope', 'misunderstood requirements')"
- Pressing 'R' during TASK_PLANNING opens modal titled "Reject Plan" with placeholder "Why is this approach wrong? (e.g., 'missing critical step', 'wrong architecture')"
- User input is captured and passed to orchestrator via existing promise resolver pattern
- Cancel button closes modal without resolving promise
- SuperReviewer retry modal continues working without changes
- Modal only opens on user action (R key), never on automatic state transitions

## Steps

### 1. Extend modal state to support rejection contexts
**Intent**: Add configuration state to track which rejection type (refinement/plan/superreviewer) is active

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 57-60)

**Changes**:
- Replace `isTextInputModalOpen: boolean` with:
```typescript
textInputModal: {
  isOpen: boolean;
  context: 'refinement' | 'plan' | 'superreviewer' | null;
  title: string;
  placeholder: string;
}
```
- Update initial state to `{ isOpen: false, context: null, title: '', placeholder: '' }`

**Verify**: TypeScript compiles, no type errors in modal state

### 2. Store active resolver reference
**Intent**: Track which promise resolver should be called when modal submits

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (after line 60)

**Changes**:
- Add new state: `const [activeResolver, setActiveResolver] = useState<((value: string) => void) | null>(null);`

**Verify**: TypeScript compiles, resolver state declared correctly

### 3. Create unified modal open helper
**Intent**: Centralize modal opening logic with proper title/placeholder/resolver assignment

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (after resolver state, ~line 62)

**Changes**:
- Add function:
```typescript
const openTextInputModal = (
  context: 'refinement' | 'plan' | 'superreviewer',
  title: string,
  placeholder: string,
  resolver: (value: string) => void
) => {
  setTextInputModal({ isOpen: true, context, title, placeholder });
  setActiveResolver(() => resolver);
};
```

**Verify**: Function accepts all required parameters, sets both state values

### 4. Update handleRefinementReject to open modal
**Intent**: Replace hardcoded feedback with modal prompt

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 241-254)

**Changes**:
- Replace entire `handleRefinementReject` function body:
```typescript
const handleRefinementReject = () => {
  if (taskStateMachine.pendingRefinement && refinementResolver) {
    openTextInputModal(
      'refinement',
      'Reject Refinement',
      "Why is this refinement incorrect? (e.g., 'wrong scope', 'misunderstood requirements')",
      (feedback: string) => {
        refinementResolver({
          approved: false,
          feedback,
          type: 'reject'
        });
        setTextInputModal({ isOpen: false, context: null, title: '', placeholder: '' });
        setActiveResolver(null);
      }
    );
  }
};
```

**Verify**: Press 'R' during TASK_REFINING opens modal with correct title/placeholder

### 5. Update handleReject to open modal
**Intent**: Replace hardcoded feedback with modal prompt for plan rejection

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 207-220)

**Changes**:
- Replace entire `handleReject` function body:
```typescript
const handleReject = () => {
  if (planResolver) {
    openTextInputModal(
      'plan',
      'Reject Plan',
      "Why is this approach wrong? (e.g., 'missing critical step', 'wrong architecture')",
      (feedback: string) => {
        planResolver({
          approved: false,
          feedback,
          type: 'wrong-approach'
        });
        setTextInputModal({ isOpen: false, context: null, title: '', placeholder: '' });
        setActiveResolver(null);
      }
    );
  }
};
```

**Verify**: Press 'R' during TASK_PLANNING opens modal with correct title/placeholder

### 6. Update SuperReviewer retry to use unified modal pattern
**Intent**: Migrate SuperReviewer retry to new modal state structure

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 259-271)

**Changes**:
- Update `handleSuperReviewerRetry`:
```typescript
const handleSuperReviewerRetry = () => {
  if (superReviewerResolver) {
    openTextInputModal(
      'superreviewer',
      'Provide Context for Retry',
      'Explain what went wrong or what needs to change...',
      (feedback: string) => {
        superReviewerResolver({
          action: 'retry',
          context: feedback
        });
        setTextInputModal({ isOpen: false, context: null, title: '', placeholder: '' });
        setActiveResolver(null);
      }
    );
  }
};
```

**Verify**: SuperReviewer retry modal still opens and submits correctly

### 7. Update TextInputModal rendering
**Intent**: Wire modal to new state structure with proper props

**Files**: `src/ui/ink/components/PlanningLayout.tsx` (lines 768-775)

**Changes**:
- Replace modal JSX:
```typescript
{textInputModal.isOpen && (
  <TextInputModal
    title={textInputModal.title}
    placeholder={textInputModal.placeholder}
    onSubmit={(value) => {
      if (activeResolver) {
        activeResolver(value);
      }
    }}
    onCancel={() => {
      setTextInputModal({ isOpen: false, context: null, title: '', placeholder: '' });
      setActiveResolver(null);
    }}
  />
)}
```

**Verify**: Modal renders with correct title/placeholder, submits user input, cancels cleanly

### 8. Test all rejection flows
**Intent**: Verify end-to-end functionality

**Files**: Manual testing

**Changes**:
1. Run task that reaches TASK_REFINING, press 'R', verify modal opens with refinement prompt
2. Submit feedback, verify orchestrator receives `{ approved: false, feedback: '<user input>', type: 'reject' }`
3. Run task that reaches TASK_PLANNING, press 'R', verify modal opens with plan prompt
4. Submit feedback, verify orchestrator receives `{ approved: false, feedback: '<user input>', type: 'wrong-approach' }`
5. Trigger SuperReviewer retry, verify modal opens with retry prompt
6. Test cancel button in all three contexts, verify modal closes without resolving

**Verify**: All three rejection scenarios work, no TypeScript errors, orchestrator receives proper feedback

## Risks & Rollbacks

**Risk**: Breaking SuperReviewer retry flow during refactor  
**Mitigation**: Step 6 explicitly updates SuperReviewer to new pattern  
**Rollback**: Revert to original `isTextInputModalOpen` boolean and inline modal config

**Risk**: Modal state confusion if multiple rejection types triggered rapidly  
**Mitigation**: Modal only opens when `isOpen: false`, resolver cleared after submission  
**Rollback**: Add mutex lock on modal opening

**Risk**: TypeScript errors from state structure change  
**Mitigation**: Update all references to modal state in single step  
**Rollback**: Revert state change and restore original boolean flag

---
_Plan created after 1 iteration(s) with human feedback_
