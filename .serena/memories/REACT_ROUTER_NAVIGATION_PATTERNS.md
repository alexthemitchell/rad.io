# React Router Navigation Patterns

## Purpose
Documents the correct navigation patterns for React Router v6 in the rad.io project to prevent common routing mistakes.

## Router Configuration
The app uses `BrowserRouter` (not `HashRouter`), which means:
- Routes are pathname-based: `/monitor`, `/scanner`, etc.
- No hash in URLs: Use `/monitor` not `#/monitor`
- Server must be configured to serve index.html for all routes (handled by webpack dev server)

## Correct Navigation Methods

### 1. Declarative Navigation (Preferred)
Use `<NavLink>` or `<Link>` components:
```tsx
import { NavLink } from 'react-router-dom';

<NavLink to="/monitor">Monitor</NavLink>
```

### 2. Programmatic Navigation
Use `useNavigate()` hook for navigation in event handlers:
```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// In event handler
const handleClick = () => {
  void navigate('/monitor'); // Note: Must use void for Promise
};

// With state
void navigate('/monitor', { state: { frequency: 100e6 } });

// With search params
void navigate('/monitor?frequency=100000000');
```

### 3. Keyboard Shortcuts Pattern
Navigation component example (src/components/Navigation.tsx):
```tsx
const navigate = useNavigate();

useEffect(() => {
  const handleKeyPress = (event: KeyboardEvent): void => {
    // Skip if typing in input
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (event.key) {
      case '1': void navigate('/monitor'); break;
      case '2': void navigate('/scanner'); break;
      // ...
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [navigate]); // Include navigate in deps
```

## Common Mistakes to Avoid

### ❌ WRONG: Hash-based navigation
```tsx
window.location.hash = '#/monitor'; // Breaks with BrowserRouter
window.location.href = '#/monitor'; // Also wrong
```

### ❌ WRONG: Direct pathname manipulation
```tsx
window.location.pathname = '/monitor'; // Full page reload, loses state
```

### ❌ WRONG: Missing void operator
```tsx
navigate('/monitor'); // ESLint error: must handle Promise
```

### ✅ CORRECT: useNavigate with void
```tsx
void navigate('/monitor'); // Explicitly ignores Promise
```

## Promise Handling
`navigate()` returns a `Promise<void>` because navigation may be deferred. Options:
1. **Use void** (most common): `void navigate('/path')`
2. **Await** (if you need to wait): `await navigate('/path')`
3. **Then/catch** (if you need error handling): `navigate('/path').catch(console.error)`

## URL Parameters

### Query Params
```tsx
// Navigate with params
void navigate('/monitor?frequency=100000000');

// Read params
import { useSearchParams } from 'react-router-dom';
const [searchParams] = useSearchParams();
const frequency = searchParams.get('frequency');
```

### Route Params
```tsx
// Define route
<Route path="/recording/:id" element={<Recording />} />

// Navigate
void navigate('/recording/abc123');

// Read params
import { useParams } from 'react-router-dom';
const { id } = useParams();
```

## Testing Navigation
Mock useNavigate in tests:
```tsx
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Test
fireEvent.click(button);
expect(mockNavigate).toHaveBeenCalledWith('/monitor');
```

## Related Files
- src/components/Navigation.tsx - Keyboard shortcuts implementation
- src/App.tsx - Router configuration
- src/panels/Bookmarks.tsx - Example of navigate with query params

## Lessons Learned
1. Never use `window.location.hash` with BrowserRouter
2. Always use `void` operator with navigate() to satisfy ESLint
3. Include `navigate` in useEffect dependency array
4. Check for input/textarea focus before handling keyboard shortcuts
5. Navigation is async - handle appropriately if you need to wait
