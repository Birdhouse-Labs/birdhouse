#!/usr/bin/env bash
# ABOUTME: Sets up the standard Birdhouse issue label taxonomy on GitHub.
# ABOUTME: Run once after the repo is created: bash .github/scripts/setup-labels.sh

REPO="Birdhouse-Labs/birdhouse"

echo "Setting up labels for $REPO..."

# Type labels (blue)
gh label create "type: bug"           --color "0075ca" --description "Something isn't working"                     --repo "$REPO" --force
gh label create "type: feature"       --color "0075ca" --description "New feature or enhancement"                  --repo "$REPO" --force
gh label create "type: docs"          --color "0075ca" --description "Documentation improvements"                  --repo "$REPO" --force
gh label create "type: chore"         --color "0075ca" --description "Code change with no functional difference"   --repo "$REPO" --force
gh label create "type: performance"   --color "0075ca" --description "Performance improvement"                     --repo "$REPO" --force

# Status labels (yellow)
gh label create "needs triage"        --color "e4e669" --description "Not yet reviewed by maintainers"             --repo "$REPO" --force
gh label create "needs reproduction"  --color "e4e669" --description "Cannot reproduce without more info"          --repo "$REPO" --force
gh label create "needs design"        --color "e4e669" --description "Requires design decision before work starts" --repo "$REPO" --force
gh label create "blocked"             --color "e4e669" --description "Blocked by another issue or external factor" --repo "$REPO" --force

# Contribution labels (green)
gh label create "good first issue"    --color "7057ff" --description "Good for newcomers"                          --repo "$REPO" --force
gh label create "help wanted"         --color "008672" --description "Extra attention or outside help welcome"     --repo "$REPO" --force

# Outcome labels (red/grey)
gh label create "out of scope"        --color "e4e669" --description "Does not align with project vision"          --repo "$REPO" --force
gh label create "duplicate"           --color "cfd3d7" --description "This issue already exists"                   --repo "$REPO" --force
gh label create "wontfix"             --color "cfd3d7" --description "Will not be addressed"                       --repo "$REPO" --force

# Area labels (orange)
gh label create "area: frontend"      --color "f9a03f" --description "SolidJS frontend"                            --repo "$REPO" --force
gh label create "area: server"        --color "f9a03f" --description "Bun orchestration server"                    --repo "$REPO" --force
gh label create "area: agent api (aapi)" --color "f9a03f" --description "Agent API / OpenCode plugin"              --repo "$REPO" --force
gh label create "area: dx"            --color "f9a03f" --description "Developer experience and tooling"            --repo "$REPO" --force

echo "Done."
