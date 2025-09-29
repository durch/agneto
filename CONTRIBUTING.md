# Contributing Guidelines

Thanks for your interest in this project!

At this time, the project is **not accepting code contributions or pull requests**.
- ✅ You are welcome to open issues for bug reports, feature requests, or questions.
- 🚫 Please do not submit PRs, as they will not be merged.

If you are interested in commercial use, please reach out to drazen@urch.eu.

## Version Management Workflow (For Maintainers)

### Overview

Agneto uses semantic versioning with automated CI/CD pipelines for releases. All version management is handled through NPM scripts that trigger GitHub Actions workflows.

### Release Types

Choose the appropriate release type based on the changes:

| Release Type | When to Use | Version Change | Command |
|--------------|-------------|----------------|---------|
| **Patch** | Bug fixes, documentation updates, small improvements | `0.1.0` → `0.1.1` | `npm run version:patch` |
| **Minor** | New features, non-breaking API additions | `0.1.0` → `0.2.0` | `npm run version:minor` |
| **Major** | Breaking changes, API modifications | `0.1.0` → `1.0.0` | `npm run version:major` |

### Step-by-Step Release Process

#### 1. Pre-Release Preparation

Before creating a release, ensure:

```bash
# Verify all tests pass
npm test

# Build successfully
npm run build

# Check current branch status
git status

# Ensure you're on the main branch
git checkout master
git pull origin master
```

#### 2. Version Management Commands

```bash
# For bug fixes and patches
npm run version:patch

# For new features
npm run version:minor

# For breaking changes
npm run version:major
```

**What happens automatically:**
1. Version number incremented in `package.json`
2. Git tag created (e.g., `v0.1.1`)
3. Tag pushed to GitHub repository
4. GitHub Actions workflow triggered

#### 3. Automated Pipeline Steps

The GitHub Actions workflow automatically handles:

1. **Environment Validation**
   - Checks for required `NPM_TOKEN` and `GITHUB_TOKEN` secrets
   - Validates semantic versioning tag format

2. **Quality Assurance**
   - Installs dependencies with `npm ci`
   - Runs complete test suite with `npm test`
   - Builds project with `npm run build`

3. **Release Generation**
   - Generates changelog from git commits since last tag
   - Creates human-readable release notes

4. **Publishing**
   - Publishes package to NPM registry (with retry logic)
   - Creates GitHub release with generated changelog
   - Marks release as "latest" on GitHub

#### 4. Post-Release Verification

After running a version command:

```bash
# Check the workflow status on GitHub
# Visit: https://github.com/durch/agneto/actions

# Verify NPM publication
# Visit: https://www.npmjs.com/package/agneto

# Verify GitHub release
# Visit: https://github.com/durch/agneto/releases
```

### Repository Configuration

#### Required GitHub Secrets

Ensure these secrets are configured in the repository:

| Secret | Purpose | How to Obtain |
|--------|---------|---------------|
| `NPM_TOKEN` | Automated NPM publishing | Create automation token at npmjs.com |
| `GITHUB_TOKEN` | Release creation | Usually auto-provided by GitHub Actions |

#### NPM Token Setup

1. **Login to NPM:**
   - Visit [npmjs.com](https://www.npmjs.com/) and sign in

2. **Create Automation Token:**
   - Navigate to **Account Settings** → **Access Tokens**
   - Click **Generate New Token**
   - Select **Automation** type (allows CI/CD publishing)
   - Copy the generated token

3. **Add to GitHub:**
   - Go to repository **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Paste the NPM token
   - Click **Add secret**

### Troubleshooting Releases

#### Common Issues and Solutions

**Version command fails:**
```bash
# Ensure working directory is clean
git status
git add . && git commit -m "Pre-release cleanup"

# Ensure you're on the correct branch
git checkout master
```

**NPM publish fails:**
- Check that `NPM_TOKEN` secret is correctly configured
- Verify the version doesn't already exist on NPM
- Ensure you have publishing rights to the package

**GitHub release creation fails:**
- Verify repository permissions for `GITHUB_TOKEN`
- Check that the tag was successfully pushed
- Ensure branch protection rules allow the workflow

**Empty or broken changelog:**
- Use conventional commit format: `feat:`, `fix:`, `docs:`, etc.
- Ensure there are meaningful commits since the last tag
- Check that the changelog generation script has proper permissions

**Tests fail during workflow:**
- All tests must pass before publishing
- Fix failing tests locally and create a new release
- Check test environment differences between local and CI

#### Manual Recovery

If automated release fails partway through:

```bash
# Check current tags
git tag --list | tail -5

# If tag was created but release failed, you can:
# 1. Delete the tag locally and remotely
git tag -d v0.1.1
git push origin --delete v0.1.1

# 2. Fix the issue and re-run version command
npm run version:patch  # or minor/major
```

### Best Practices

1. **Commit Messages:** Use conventional format for better changelog generation:
   ```bash
   feat: add user authentication system
   fix: resolve memory leak in data processor
   docs: update API documentation
   refactor: improve database connection handling
   ```

2. **Testing:** Always run full test suite before releases:
   ```bash
   npm test && npm run build
   ```

3. **Release Frequency:**
   - Patch releases: As needed for urgent fixes
   - Minor releases: Weekly/bi-weekly for feature additions
   - Major releases: Monthly/quarterly for breaking changes

4. **Changelog Review:** After release, verify the generated changelog makes sense and provides clear value to users.

### Emergency Procedures

**Urgent hotfix release:**
```bash
# 1. Create hotfix from latest release
git checkout v0.1.0  # Latest stable tag
git checkout -b hotfix/critical-fix

# 2. Make minimal fix
# ... edit files ...
git commit -m "fix: critical security vulnerability"

# 3. Merge back and release
git checkout master
git merge hotfix/critical-fix
npm run version:patch
```

**Rollback a release:**
- NPM packages cannot be unpublished after 24 hours
- Instead, publish a new patch version with the fix
- Use `npm deprecate` if absolutely necessary
