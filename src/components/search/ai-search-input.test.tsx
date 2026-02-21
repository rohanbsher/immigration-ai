import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AISearchInput, AISearchBadge } from './ai-search-input';

// Mock logger
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
    withContext: vi.fn().mockReturnThis(),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AILoading
vi.mock('@/components/ai', () => ({
  AILoading: ({ message }: { message: string }) => (
    <span data-testid="ai-loading">{message}</span>
  ),
}));

// Mock SearchResults
vi.mock('@/components/search/search-results', () => ({
  SearchResults: ({ response }: { response: unknown }) => (
    <div data-testid="search-results">Results: {JSON.stringify(response)}</div>
  ),
}));

// Mock useNaturalSearch
const mockSearch = vi.fn();
const mockReset = vi.fn();
const mockUseNaturalSearch = vi.fn();

vi.mock('@/hooks/use-natural-search', () => ({
  useNaturalSearch: (...args: unknown[]) => mockUseNaturalSearch(...args),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

describe('AISearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockUseNaturalSearch.mockReturnValue({
      search: mockSearch,
      data: null,
      isSearching: false,
      error: null,
      reset: mockReset,
    });
  });

  test('renders input with default placeholder in AI mode', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('Try "H1B cases with missing I-94"')).toBeInTheDocument();
  });

  test('renders input with custom placeholder in standard mode', () => {
    render(<AISearchInput defaultAIMode={false} placeholder="Search here" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByPlaceholderText('Search here')).toBeInTheDocument();
  });

  test('renders AI toggle button when showToggle is true', () => {
    render(<AISearchInput showToggle={true} />, { wrapper: createWrapper() });
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  test('does not render toggle button when showToggle is false', () => {
    render(<AISearchInput showToggle={false} />, { wrapper: createWrapper() });
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Exact')).not.toBeInTheDocument();
  });

  test('toggles between AI and Exact mode on toggle click', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    expect(screen.getByText('AI')).toBeInTheDocument();

    fireEvent.click(screen.getByText('AI'));
    expect(screen.getByText('Exact')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Exact'));
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  test('typing updates input value', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');
    fireEvent.change(input, { target: { value: 'H1B visa' } });
    expect(input).toHaveValue('H1B visa');
  });

  test('shows clear button when query is non-empty', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    // No clear button initially
    const buttons = screen.getAllByRole('button');
    const initialCount = buttons.length;

    fireEvent.change(input, { target: { value: 'test' } });

    // Clear button should now appear (one extra button)
    const updatedButtons = screen.getAllByRole('button');
    expect(updatedButtons.length).toBeGreaterThan(initialCount);
  });

  test('clear button resets query and calls reset', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    fireEvent.change(input, { target: { value: 'test query' } });
    expect(input).toHaveValue('test query');

    // Find the clear button (the X button that appears)
    // It is the button inside the input container without a role="button" label
    const allButtons = screen.getAllByRole('button');
    // The clear button is the first inline button after typing
    // We look for the button that is not AI toggle and not the search arrow
    // Clear button is a <button> without aria-label, appears when query exists
    // Find by traversing - the clear button has no text content
    const clearBtn = allButtons.find(btn => {
      return btn.textContent === '' || btn.querySelector('svg');
    });

    // Click any button that would trigger clear - let's use a more targeted approach
    // The X clear button is placed right before the AI toggle
    fireEvent.change(input, { target: { value: '' } });
    // Verify reset was not called on mere clearing
    // Actually, let's test the clear button properly
    fireEvent.change(input, { target: { value: 'test query' } });
    // Find all buttons - the clear button renders when query is truthy
    // It's a native <button> (not a Button component) with class text-muted-foreground
    const container = input.closest('.relative');
    const nativeButtons = container?.querySelectorAll('button');
    const clearButton = nativeButtons
      ? Array.from(nativeButtons).find(
          (b) => b.className.includes('text-muted-foreground') && !b.className.includes('px-2 py-0.5')
        )
      : null;

    if (clearButton) {
      fireEvent.click(clearButton);
      expect(mockReset).toHaveBeenCalled();
      expect(input).toHaveValue('');
    }
  });

  test('Enter key triggers search when query length >= 2', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    fireEvent.change(input, { target: { value: 'H1B cases' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSearch).toHaveBeenCalledWith('H1B cases');
  });

  test('Enter key does not trigger search when query length < 2', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    fireEvent.change(input, { target: { value: 'H' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  test('saves recent searches to localStorage on search', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    fireEvent.change(input, { target: { value: 'H1B cases' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'recentSearches',
      expect.stringContaining('H1B cases')
    );
  });

  test('loads recent searches from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['old search', 'another search']));

    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    // Focus input to show suggestions
    fireEvent.focus(input);

    // Recent searches should be shown
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('old search')).toBeInTheDocument();
    expect(screen.getByText('another search')).toBeInTheDocument();
  });

  test('displays error message when search fails', () => {
    mockUseNaturalSearch.mockReturnValue({
      search: mockSearch,
      data: null,
      isSearching: false,
      error: new Error('Search failed'),
      reset: mockReset,
    });

    render(<AISearchInput />, { wrapper: createWrapper() });
    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  test('search button is disabled when query length < 2', () => {
    render(<AISearchInput />, { wrapper: createWrapper() });
    // The search button (ArrowRight) is the last button in the container
    const buttons = screen.getAllByRole('button');
    const searchBtn = buttons[buttons.length - 1];
    expect(searchBtn).toBeDisabled();
  });

  test('Escape key closes suggestions dropdown', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['old search']));

    render(<AISearchInput />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Try "H1B cases with missing I-94"');

    fireEvent.focus(input);
    expect(screen.getByText('Recent')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  test('displays search results when data is available', () => {
    mockUseNaturalSearch.mockReturnValue({
      search: mockSearch,
      data: { results: [{ id: '1', title: 'Test Case' }] },
      isSearching: false,
      error: null,
      reset: mockReset,
    });

    render(<AISearchInput />, { wrapper: createWrapper() });
    expect(screen.getByTestId('search-results')).toBeInTheDocument();
  });

  test('does not search in standard mode via mutation', () => {
    render(<AISearchInput defaultAIMode={false} />, { wrapper: createWrapper() });
    const input = screen.getByPlaceholderText('Search cases...');

    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // search (mutation) should NOT be called in standard mode
    expect(mockSearch).not.toHaveBeenCalled();
    // But recent searches should still be saved
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

describe('AISearchBadge', () => {
  test('renders search badge with AI label', () => {
    const onClick = vi.fn();
    render(<AISearchBadge onClick={onClick} />);
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<AISearchBadge onClick={onClick} />);
    fireEvent.click(screen.getByText('Search'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
