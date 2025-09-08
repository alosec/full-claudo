# Parser Type Fixes Plan

## Issue
The test-manager-complex.ts file contains two 'as any' type assertions that should be properly typed:

1. Line 93: `(parser as any).getStatistics?.()` - should use proper interface
2. Line 147: `(parser as any).on('parser-error', (data: any) => {})` - should use proper event interface

## Solution

### 1. Create ParserWithStatistics Interface
```typescript
interface ParserWithStatistics {
  getStatistics?(): {
    lines: number;
    success: number;
    errors: number;
    errorRate: number;
    pendingTools: number;
  };
}
```

### 2. Create ParserWithEvents Interface  
```typescript
interface ParserWithEvents {
  on(event: 'parser-error', callback: (data: { context: string; error: any; data?: any }) => void): void;
  on(event: string, callback: (...args: any[]) => void): void;
}
```

### 3. Update Type Assertions
Replace the `as any` with proper type intersections:
- `parser as (ClaudeStreamParser & ParserWithStatistics)`
- `parser as (ClaudeStreamParser & ParserWithEvents)`

## Files to Change
- `src/test-manager-complex.ts` - fix the two as any assertions

## Benefits
- Better type safety
- IntelliSense support
- Catches interface changes at compile time
- Removes TypeScript any usage

