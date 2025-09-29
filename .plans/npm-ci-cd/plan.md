# CI/CD Pipeline for Automated NPM Publishing

## Context
Agneto v0.4.0 currently has manual versioning and publishing processes. The project has a solid foundation with TypeScript builds, existing tests via Vitest, and follows semantic versioning with git tags (v0.1.1 through v0.4.0). This plan establishes automated publishing triggered by version tags, with quality gates and release automation.

## Acceptance Criteria
- ✅ NPM package publishes automatically when version tags (v*) are pushed to GitHub
- ✅ Version management scripts handle semantic versioning (patch/minor/major) with single commands
- ✅ GitHub releases created automatically with generated changelogs from git commits
- ✅ Tests run and pass before any publication (quality gate)
- ✅ NPM_TOKEN security properly configured and documented
- ✅ Clear documentation for maintainers on release process
- ✅ Workflow handles edge cases gracefully (duplicate tags, test failures, network issues)

## Steps

### 1. Create GitHub Actions workflow directory and main publishing workflow
**Intent**: Establish the core CI/CD infrastructure with automated publishing on tag pushes
**Files**: `.github/workflows/publish.yml`
**Verification**: Check workflow file exists and follows YAML syntax with `yamllint .github/workflows/publish.yml`

### 2. Create version management utility scripts
**Intent**: Provide simple commands for version bumping with automatic git tagging
**Files**: `scripts/version-patch.sh`, `scripts/version-minor.sh`, `scripts/version-major.sh`  
**Verification**: Test each script with `bash -n scripts/version-*.sh` and verify they update package.json version correctly

### 3. Add NPM scripts for version management
**Intent**: Expose version management through familiar `npm run` commands
**Files**: `package.json` (add version:patch, version:minor, version:major scripts)
**Verification**: Run `npm run` to confirm new scripts appear in available commands list

### 4. Create changelog generation script
**Intent**: Automate release notes generation from git commit history between tags
**Files**: `scripts/generate-changelog.sh`
**Verification**: Test script with `scripts/generate-changelog.sh v0.3.2 v0.4.0` to verify changelog output format

### 5. Create comprehensive GitHub Actions workflow for publishing
**Intent**: Implement complete CI/CD pipeline with tests, building, and NPM publishing
**Files**: `.github/workflows/publish.yml` (complete implementation)
**Verification**: Validate workflow syntax with GitHub CLI: `gh workflow view publish.yml --yaml`

### 6. Add GitHub Actions workflow for PR validation
**Intent**: Ensure quality gates run on pull requests before merging
**Files**: `.github/workflows/ci.yml` 
**Verification**: Push to test branch and verify workflow triggers correctly without publishing

### 7. Update documentation with release process
**Intent**: Document the new CI/CD process for maintainers
**Files**: `README.md` (add Release Process section), `CONTRIBUTING.md` (update with version management)
**Verification**: Review documentation for clarity and accuracy of commands and steps

### 8. Configure repository secrets documentation
**Intent**: Provide clear instructions for NPM_TOKEN setup in repository settings
**Files**: `docs/RELEASE_SETUP.md` (new file with security configuration steps)
**Verification**: Review documentation covers all required GitHub repository settings

## Risks & Rollbacks

**Risks**:
- NPM_TOKEN misconfiguration could block automated publishing
- Duplicate tag pushes could cause workflow failures  
- Network timeouts during NPM publish could leave partial releases
- Test failures after tag creation but before publish create inconsistent state

**Rollback Strategy**:
- Keep existing manual publishing process intact as fallback
- Version management scripts are additive - existing git tag process remains functional
- GitHub Actions workflows can be disabled individually if issues occur
- All changes are incremental additions - no modification to existing build process

**Confidence Level**: I'm confident this approach will work as it follows industry-standard patterns for NPM package CI/CD. The main concern is ensuring proper NPM_TOKEN configuration, but the documentation will address this clearly.

---
_Plan created after 1 iteration(s) with human feedback_
