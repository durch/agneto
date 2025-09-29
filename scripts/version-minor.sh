#!/usr/bin/env bash
set -euo pipefail

echo "🔖 Bumping minor version..."

# Bump minor version and create git tag
NEW_VERSION=$(npm version minor)

echo "✅ Version bumped to $NEW_VERSION"

# Push the tag to trigger GitHub Actions workflow
echo "📤 Pushing tag to remote repository..."
git push --follow-tags

echo "🎉 Minor version $NEW_VERSION published and tag pushed!"
echo "   GitHub Actions will now handle the NPM publishing."