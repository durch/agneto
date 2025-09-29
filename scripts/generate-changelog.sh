#!/usr/bin/env bash
set -euo pipefail

# Script to generate changelog from git commits between two tags
# Usage: ./generate-changelog.sh <previous-tag> <current-tag>
# Example: ./generate-changelog.sh v0.3.2 v0.4.0

show_usage() {
    echo "📝 Generate Changelog Script"
    echo ""
    echo "Usage: $0 <previous-tag> <current-tag>"
    echo ""
    echo "Examples:"
    echo "  $0 v0.3.2 v0.4.0"
    echo "  $0 0.3.2 0.4.0"
    echo ""
    echo "This script generates a markdown changelog from git commits between two tags."
    exit 1
}

# Check if both parameters are provided
if [ $# -ne 2 ]; then
    echo "❌ Error: Both previous and current tags are required."
    echo ""
    show_usage
fi

PREV_TAG="$1"
CURRENT_TAG="$2"

# Normalize tags (ensure they start with 'v')
normalize_tag() {
    local tag="$1"
    if [[ "$tag" =~ ^v.* ]]; then
        echo "$tag"
    else
        echo "v$tag"
    fi
}

PREV_TAG_NORMALIZED=$(normalize_tag "$PREV_TAG")
CURRENT_TAG_NORMALIZED=$(normalize_tag "$CURRENT_TAG")

# Validate that both tags exist in the repository
validate_tag() {
    local tag="$1"
    if ! git rev-parse --verify "$tag" >/dev/null 2>&1; then
        echo "❌ Error: Tag '$tag' does not exist in the repository."
        echo ""
        echo "Available tags:"
        git tag --list | tail -10
        exit 1
    fi
}

echo "🔍 Validating tags..."
validate_tag "$PREV_TAG_NORMALIZED"
validate_tag "$CURRENT_TAG_NORMALIZED"

# Get the date of the current tag
TAG_DATE=$(git log -1 --format=%ai "$CURRENT_TAG_NORMALIZED" | cut -d' ' -f1)

# Generate the changelog header
echo "## [$CURRENT_TAG_NORMALIZED] - $TAG_DATE"
echo ""
echo "### Changes"

# Get commits between the tags, excluding merge commits
COMMITS=$(git log --pretty=format:"%h %s" --no-merges "$PREV_TAG_NORMALIZED..$CURRENT_TAG_NORMALIZED")

if [ -z "$COMMITS" ]; then
    echo "- No changes found between $PREV_TAG_NORMALIZED and $CURRENT_TAG_NORMALIZED"
else
    # Format each commit as a markdown bullet point
    echo "$COMMITS" | while IFS= read -r line; do
        if [ -n "$line" ]; then
            HASH=$(echo "$line" | cut -d' ' -f1)
            MESSAGE=$(echo "$line" | cut -d' ' -f2-)
            echo "- [$HASH] $MESSAGE"
        fi
    done
fi

echo ""
echo "📋 Changelog generated successfully!"
echo "   Range: $PREV_TAG_NORMALIZED → $CURRENT_TAG_NORMALIZED"