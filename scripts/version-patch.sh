#!/usr/bin/env bash
set -euo pipefail

echo "🔖 Bumping patch version..."

# Bump patch version and create git tag
NEW_VERSION=$(npm version patch)

echo "✅ Version bumped to $NEW_VERSION"

# Push the tag to trigger GitHub Actions workflow
echo "📤 Pushing tag to remote repository..."
git push --follow-tags

echo "🎉 Patch version $NEW_VERSION published and tag pushed!"
echo "   GitHub Actions will now handle the NPM publishing."