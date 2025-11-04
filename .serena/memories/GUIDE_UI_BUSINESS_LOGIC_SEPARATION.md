# Guide: Separating UI Components from Business Logic

## Pattern Overview

This guide documents the pattern used to decouple React components from business logic by extracting logic into custom hooks.

## Key Principles

1. **Components for Rendering**: Components should focus on:
   - JSX structure and layout
   - Styling and visual presentation
   - Event binding to handlers
   - Accessibility attributes

2. **Hooks for Logic**: Custom hooks should encapsulate:
   - State management
   - Side effects
   - Business calculations
   - API interactions
   - Device communication

## Refactoring Pattern

### Step 1: Identify Business Logic

Look for logic in components related to:

- Data transformation (e.g., unit conversion)
- Validation and bounds checking
- State machines and workflows
- Device/API communication
- Complex calculations

### Step 2: Create Custom Hook

Extract logic into a hook with:

```typescript
export function useFeatureName(options: Options): Result {
  // Internal state
  const [state, setState] = useState(...);

  // Callbacks with business logic
  const handleAction = useCallback((...) => {
    // Business logic here
  }, [deps]);

  // Return interface for component
  return {
    state,
    handlers,
    derivedValues,
  };
}
```

### Step 3: Add Comprehensive Tests

Test the hook independently:

- All state transitions
- Edge cases and error handling
- Callback behavior
- Dependency tracking

### Step 4: Update Component

Replace inline logic with hook:

```typescript
function Component(props) {
  const { state, handlers, values } = useFeatureName({
    // Pass props to hook
  });

  return (
    <div>
      {/* Pure UI rendering using hook's interface */}
    </div>
  );
}
```

## Examples from rad.io

### Example 1: useReception

**Extracted from**: Monitor component
**Logic encapsulated**:

- Device tuning with hardware parameters
- Reception start/stop control
- Auto-start behavior
- Cleanup on unmount

**Benefits**:

- Monitor component reduced by ~100 lines
- Reception logic testable independently
- Can be reused in other components

### Example 2: useFrequencyInput

**Extracted from**: RadioControls component
**Logic encapsulated**:

- Hz ↔ MHz/kHz conversion
- Signal type-specific bounds (FM/AM/P25)
- Keyboard navigation (Arrow, PageUp/Down)
- Accessibility text generation

**Benefits**:

- RadioControls is now purely presentational
- Frequency logic reusable across components
- 18 tests ensure correctness
- Easy to add new signal types

## Testing Strategy

### Hook Tests

- Mock all external dependencies
- Test state changes independently
- Verify callback behavior
- Check error handling
- Test cleanup effects

### Component Tests

- Mock the custom hook
- Test UI rendering
- Verify prop passing
- Check accessibility

## Anti-Patterns to Avoid

❌ **Don't**: Mix rendering and logic in same component
❌ **Don't**: Create hooks that are too generic
❌ **Don't**: Forget to test hook independently
❌ **Don't**: Break existing component contracts

✅ **Do**: Extract focused, single-responsibility hooks
✅ **Do**: Keep component props interface stable
✅ **Do**: Add comprehensive hook tests
✅ **Do**: Document hook parameters and return values

## File Organization

```
src/
  hooks/
    useFeatureName.ts          # Hook implementation
    __tests__/
      useFeatureName.test.ts   # Hook tests
    index.ts                   # Barrel export
  components/
    Component.tsx              # Uses hook
    __tests__/
      Component.test.tsx       # Component tests
```

## Type Safety

Always export types from hooks:

```typescript
export interface UseFeatureOptions { ... }
export interface UseFeatureResult { ... }
export function useFeature(options: UseFeatureOptions): UseFeatureResult
```

This enables:

- Type-safe hook usage
- Better IDE autocomplete
- Compile-time error catching

## Resources

- Hook implementation: `src/hooks/useReception.ts`, `src/hooks/useFrequencyInput.ts`
- Hook tests: `src/hooks/__tests__/`
- Refactored components: `src/pages/Monitor.tsx`, `src/components/RadioControls.tsx`
