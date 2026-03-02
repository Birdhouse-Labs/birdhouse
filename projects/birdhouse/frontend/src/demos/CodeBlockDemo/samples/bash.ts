// ABOUTME: Bash code sample for syntax highlighting demo
// ABOUTME: Demonstrates variables, functions, conditionals, and common CLI patterns

import type { CodeSample } from "./types";

export const bash: CodeSample = {
  id: "bash",
  name: "Bash",
  language: "bash",
  description: "A deployment script that has seen things",
  code: `#!/bin/bash
# deploy.sh - A deployment script that has survived production
# Author: Someone who learned the hard way
# Last modified: 3am during an incident

set -euo pipefail  # Because we've been burned before
IFS=$'\\n\\t'

# Colors for pretending everything is fine
readonly RED='\\033[0;31m'
readonly GREEN='\\033[0;32m'
readonly YELLOW='\\033[1;33m'
readonly NC='\\033[0m' # No Color

# Configuration (please don't hardcode secrets, we beg you)
readonly APP_NAME="\${APP_NAME:-my-app}"
readonly DEPLOY_ENV="\${DEPLOY_ENV:-staging}"
readonly MAX_RETRIES=3
readonly HEALTH_CHECK_TIMEOUT=30

log_info() {
    echo -e "\${GREEN}[INFO]\${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "\${YELLOW}[WARN]\${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_error() {
    echo -e "\${RED}[ERROR]\${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Check if we should even be doing this
preflight_check() {
    log_info "Running preflight checks..."
    
    # Is it Friday? Is it after 4pm? Both are red flags.
    local day_of_week hour
    day_of_week=$(date +%u)
    hour=$(date +%H)
    
    if [[ $day_of_week -eq 5 && $hour -ge 16 ]]; then
        log_warn "It's Friday afternoon. Are you sure about this?"
        read -p "Type 'I accept the consequences' to continue: " confirmation
        [[ "$confirmation" != "I accept the consequences" ]] && exit 1
    fi
    
    # Check required tools
    local required_tools=("docker" "kubectl" "jq" "curl")
    for tool in "\${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' not found. Please install it."
            exit 1
        fi
    done
    
    log_info "Preflight checks passed!"
}

# Deploy with retries because networks are suggestions
deploy() {
    local attempt=1
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        log_info "Deployment attempt $attempt of $MAX_RETRIES"
        
        if kubectl apply -f "k8s/\${DEPLOY_ENV}/" --record; then
            log_info "Deployment applied successfully"
            return 0
        fi
        
        log_warn "Attempt $attempt failed, retrying in $((attempt * 5)) seconds..."
        sleep $((attempt * 5))
        ((attempt++))
    done
    
    log_error "Deployment failed after $MAX_RETRIES attempts"
    return 1
}

# Health check with existential dread
wait_for_healthy() {
    local endpoint="$1"
    local elapsed=0
    
    log_info "Waiting for $endpoint to be healthy..."
    
    while [[ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]]; do
        if curl -sf "$endpoint/health" > /dev/null 2>&1; then
            log_info "Service is healthy!"
            return 0
        fi
        sleep 2
        ((elapsed += 2))
        echo -n "."
    done
    
    echo ""
    log_error "Health check timed out after \${HEALTH_CHECK_TIMEOUT}s"
    return 1
}

# Main - where the magic (and panic) happens
main() {
    log_info "Starting deployment of $APP_NAME to $DEPLOY_ENV"
    
    preflight_check
    deploy
    wait_for_healthy "https://\${APP_NAME}.\${DEPLOY_ENV}.example.com"
    
    log_info "Deployment complete! Time for mass coffee."
}

main "$@"`,
};
