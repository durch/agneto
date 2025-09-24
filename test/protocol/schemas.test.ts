import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import {
  CODER_COMPLETE_SCHEMA,
  REVIEWER_COMPLETE_SCHEMA,
  schemas
} from '../../src/protocol/schemas.js';

describe('Protocol Schemas', () => {
  const ajv = new Ajv();

  describe('Coder Schema', () => {
    const validate = ajv.compile(CODER_COMPLETE_SCHEMA);

    it('validates correct plan proposal', () => {
      const validProposal = {
        action: 'propose_plan',
        data: {
          description: 'Add logging functionality',
          steps: ['Install winston', 'Create logger', 'Replace console.log'],
          files: ['src/utils/logger.ts', 'package.json']
        }
      };

      expect(validate(validProposal)).toBe(true);
    });

    it('validates complete signal', () => {
      const validComplete = {
        action: 'complete'
      };

      expect(validate(validComplete)).toBe(true);
    });

    it('validates implementation confirmation', () => {
      const validImplemented = {
        action: 'implemented',
        data: {
          description: 'Added logging functionality',
          filesChanged: ['src/utils/logger.ts', 'src/index.ts']
        }
      };

      expect(validate(validImplemented)).toBe(true);
    });

    it('rejects invalid action type', () => {
      const invalid = {
        action: 'invalid_action',
        data: {
          description: 'Test',
          steps: [],
          files: []
        }
      };

      expect(validate(invalid)).toBe(false);
    });

    it('rejects missing required fields in proposal', () => {
      const invalid = {
        action: 'propose_plan',
        data: {
          description: 'Missing steps and files'
          // Missing: steps, files
        }
      };

      expect(validate(invalid)).toBe(false);
    });

    it('rejects extra properties in complete', () => {
      const invalid = {
        action: 'complete',
        extra: 'should not be here'
      };

      expect(validate(invalid)).toBe(false);
    });

    it('validates arrays correctly', () => {
      const valid = {
        action: 'propose_plan',
        data: {
          description: 'Test',
          steps: [], // Empty array is valid
          files: []
        }
      };

      expect(validate(valid)).toBe(true);
    });

    it('rejects wrong data types', () => {
      const invalid = {
        action: 'propose_plan',
        data: {
          description: 123, // Should be string
          steps: 'not an array', // Should be array
          files: ['file.ts']
        }
      };

      expect(validate(invalid)).toBe(false);
    });
  });

  describe('Reviewer Schema', () => {
    const validate = ajv.compile(REVIEWER_COMPLETE_SCHEMA);

    it('validates approve verdict', () => {
      const validApprove = {
        action: 'review',
        verdict: 'approve',
        feedback: 'Looks good',
        continueNext: true
      };

      expect(validate(validApprove)).toBe(true);
    });

    it('validates revise verdict', () => {
      const validRevise = {
        action: 'review',
        verdict: 'revise',
        feedback: 'Please add error handling'
      };

      expect(validate(validRevise)).toBe(true);
    });

    it('validates reject verdict', () => {
      const validReject = {
        action: 'review',
        verdict: 'reject',
        feedback: 'This approach will not work'
      };

      expect(validate(validReject)).toBe(true);
    });

    it('validates needs_human verdict', () => {
      const validNeedsHuman = {
        action: 'review',
        verdict: 'needs_human',
        feedback: 'Ambiguous requirements need clarification'
      };

      expect(validate(validNeedsHuman)).toBe(true);
    });

    it('requires action and verdict', () => {
      const invalid = {
        feedback: 'Missing required fields'
      };

      expect(validate(invalid)).toBe(false);
    });

    it('rejects invalid verdict', () => {
      const invalid = {
        action: 'review',
        verdict: 'invalid_verdict'
      };

      expect(validate(invalid)).toBe(false);
    });

    it('allows optional feedback', () => {
      const valid = {
        action: 'review',
        verdict: 'approve'
        // No feedback - should be valid
      };

      expect(validate(valid)).toBe(true);
    });

    it('allows optional continueNext', () => {
      const valid = {
        action: 'review',
        verdict: 'approve',
        feedback: 'Good implementation'
        // No continueNext - should be valid
      };

      expect(validate(valid)).toBe(true);
    });

    it('rejects additional properties', () => {
      const invalid = {
        action: 'review',
        verdict: 'approve',
        extraField: 'should not be here'
      };

      expect(validate(invalid)).toBe(false);
    });

    it('validates continueNext is boolean', () => {
      const invalid = {
        action: 'review',
        verdict: 'approve',
        continueNext: 'yes' // Should be boolean
      };

      expect(validate(invalid)).toBe(false);
    });
  });

  describe('Schema Component Validation', () => {
    it('has correct structure for Coder components', () => {
      expect(schemas.coder.planProposal).toBeDefined();
      expect(schemas.coder.complete).toBeDefined();
      expect(schemas.coder.implemented).toBeDefined();
    });

    it('has correct structure for Reviewer component', () => {
      expect(schemas.reviewer).toBeDefined();
      expect(schemas.reviewer.properties.verdict.enum).toEqual([
        'approve',
        'revise',
        'reject',
        'needs_human'
      ]);
    });

    it('exports JSON strings for prompt injection', async () => {
      const { CODER_SCHEMA_JSON, REVIEWER_SCHEMA_JSON } =
        await import('../../src/protocol/schemas.js');

      expect(typeof CODER_SCHEMA_JSON).toBe('string');
      expect(typeof REVIEWER_SCHEMA_JSON).toBe('string');

      // Should be valid JSON
      expect(() => JSON.parse(CODER_SCHEMA_JSON)).not.toThrow();
      expect(() => JSON.parse(REVIEWER_SCHEMA_JSON)).not.toThrow();
    });
  });

  describe('Real-world Response Validation', () => {
    const coderValidate = ajv.compile(CODER_COMPLETE_SCHEMA);
    const reviewerValidate = ajv.compile(REVIEWER_COMPLETE_SCHEMA);

    it('validates typical Coder planning response', () => {
      const response = {
        action: 'propose_plan',
        data: {
          description: 'Implement user authentication with JWT',
          steps: [
            'Install jsonwebtoken and bcrypt',
            'Create auth middleware',
            'Add login endpoint',
            'Add register endpoint',
            'Protect routes with middleware'
          ],
          files: [
            'package.json',
            'src/middleware/auth.ts',
            'src/routes/auth.ts',
            'src/models/user.ts'
          ]
        }
      };

      expect(coderValidate(response)).toBe(true);
    });

    it('validates typical Reviewer approval', () => {
      const response = {
        action: 'review',
        verdict: 'approve',
        feedback: 'Implementation correctly handles authentication flow',
        continueNext: false
      };

      expect(reviewerValidate(response)).toBe(true);
    });

    it('validates typical revision request', () => {
      const response = {
        action: 'review',
        verdict: 'revise',
        feedback: 'The error handling is missing. Please add try-catch blocks and appropriate error responses.'
      };

      expect(reviewerValidate(response)).toBe(true);
    });
  });
});