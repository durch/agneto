# Task: Refactor logging to use Winston

## Goal
Replace all console.log statements with a proper Winston logger implementation across multiple files.

## Context
The current codebase uses console.log for debugging and error reporting. We need to implement a structured logging solution using Winston.

## Steps
1. Install Winston dependency
   - Add winston to package.json
   - Add @types/winston for TypeScript support

2. Create logger configuration
   - Create `src/utils/logger.ts`
   - Configure Winston with:
     - Console transport for development
     - File transport for production
     - Appropriate log levels (error, warn, info, debug)
     - Timestamp formatting

3. Replace console.log statements
   - Update `src/index.ts` - replace console.log calls
   - Update `src/api/routes.ts` - replace console.error calls
   - Update `src/services/database.ts` - replace all console statements

4. Add logger initialization
   - Import logger in main entry point
   - Set log level based on environment variable

## Files to Modify
- `package.json` - add dependencies
- `src/utils/logger.ts` - new file
- `src/index.ts` - replace logging
- `src/api/routes.ts` - replace logging
- `src/services/database.ts` - replace logging

## Success Criteria
- Winston is properly configured
- All console.* statements are replaced with logger calls
- Log levels are used appropriately
- Logs include timestamps and proper formatting
- No direct console.* calls remain in the codebase