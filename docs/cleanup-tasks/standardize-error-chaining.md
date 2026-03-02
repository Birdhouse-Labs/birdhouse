# Standardize Error Chaining Across Codebase

## Context

The patterns API layer introduces `FetchPatternError` with ES2022 error chaining using the `cause` property. This provides full error trail from UI → API → Network.

## Task

Update existing custom error classes to use the same pattern for consistency.

## Files to Update

- `projects/birdhouse/frontend/src/services/messages-api.ts` - `SendMessageError` class

## Pattern to Follow

See `FetchPatternError` in `projects/birdhouse/frontend/src/patterns/types/errors.ts` for reference implementation.

Key changes:
1. Add optional `cause?: Error` parameter to constructor
2. Pass `cause` to `super(message, { cause })`
3. Include `cause` in `toJSON()` serialization

## Testing

Verify error chain is preserved when errors are thrown and caught.
