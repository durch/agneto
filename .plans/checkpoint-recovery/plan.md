# RecoveryService Implementation Plan

## Context
Agneto has a comprehensive CheckpointService that creates detailed checkpoint files in `.agneto/task-{id}/checkpoints/` directories. These checkpoints contain complete task state, execution state, Bean Counter progress, session data, and file system state, along with metadata.json files for indexing. A RecoveryService is needed to complement this system by providing checkpoint discovery, validation, and loading capabilities.

## Acceptance Criteria
- Can discover all checkpoint files for a given task ID
- Can parse and validate checkpoint metadata.json files  
- Can load and deserialize checkpoint files into TaskCheckpoint objects
- Validates checkpoint schema version compatibility
- Provides filtering capabilities (by trigger type, recoverability, critical status)
- Handles file system errors and corrupted data gracefully with clear error messages
- Returns properly typed checkpoint data matching existing type definitions
- Includes methods to find the latest recoverable checkpoint
- Provides checkpoint file validation before attempting to load full content

## Steps

1. **Create RecoveryService class structure** 
   - **Intent**: Set up the basic service class with constructor and core properties
   - **Files**: `src/audit/recovery-service.ts`
   - **Verify**: File exists and exports RecoveryService class with proper imports from existing types

2. **Implement checkpoint discovery methods**
   - **Intent**: Add methods to find checkpoint directories and enumerate checkpoint files
   - **Files**: `src/audit/recovery-service.ts`
   - **Verify**: Can discover `.agneto/task-{id}/checkpoints/` directories and list checkpoint files with different naming formats

3. **Implement metadata.json parsing and validation**
   - **Intent**: Add methods to load and validate CheckpointMetadata from metadata.json files
   - **Files**: `src/audit/recovery-service.ts`  
   - **Verify**: Can parse metadata.json files and validate schema versions against current schema

4. **Implement checkpoint file loading and deserialization**
   - **Intent**: Add methods to load individual checkpoint files and deserialize to TaskCheckpoint objects
   - **Files**: `src/audit/recovery-service.ts`
   - **Verify**: Can load checkpoint files and return properly typed TaskCheckpoint objects

5. **Add filtering and search capabilities**
   - **Intent**: Implement methods to filter checkpoints by trigger type, recoverability, and critical status
   - **Files**: `src/audit/recovery-service.ts`
   - **Verify**: Can filter checkpoints and find latest recoverable checkpoint efficiently

6. **Implement error handling and validation**
   - **Intent**: Add comprehensive error handling for corrupted files, missing data, and file system errors
   - **Files**: `src/audit/recovery-service.ts`
   - **Verify**: Gracefully handles corrupted JSON, missing files, and permission errors with clear messages

7. **Add RecoveryService to audit exports**
   - **Intent**: Export the new service from the audit module index
   - **Files**: `src/audit/index.ts`
   - **Verify**: RecoveryService is properly exported and can be imported from audit module

8. **Write comprehensive unit tests**
   - **Intent**: Create test coverage for all RecoveryService methods with mock checkpoint data
   - **Files**: `test/recovery-service.test.ts` 
   - **Verify**: All methods tested with various scenarios including error conditions

## Risks & Rollbacks

**Risks:**
- Different checkpoint naming formats might complicate discovery logic
- Schema version mismatches could cause compatibility issues  
- Large checkpoint files might impact performance during loading
- Corrupted metadata.json files could break discovery

**Rollbacks:**
- Changes are additive only - existing CheckpointService functionality remains unchanged
- If issues arise, simply don't export RecoveryService from index.ts
- New service has no dependencies on existing audit components beyond types

**Confidence Level:** I'm confident this approach will work well. The existing CheckpointService provides a solid foundation with well-defined types and clear file structure patterns. The RecoveryService will complement it naturally by focusing purely on reading and validation without any modification capabilities.

---
_Plan created after 1 iteration(s) with human feedback_
