import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingChecklist } from './onboarding-checklist';

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

// Mock motion/react to avoid animation complexities in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      // Filter out motion-specific props
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...domProps
      } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  test('renders Getting Started header', () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
  });

  test('renders all 5 onboarding steps', () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText('Create your first case')).toBeInTheDocument();
    expect(screen.getByText('Add a client')).toBeInTheDocument();
    expect(screen.getByText('Upload a document')).toBeInTheDocument();
    expect(screen.getByText('Review AI recommendations')).toBeInTheDocument();
    expect(screen.getByText('Set up your firm profile')).toBeInTheDocument();
  });

  test('renders step descriptions', () => {
    render(<OnboardingChecklist />);
    expect(
      screen.getByText('Start an immigration case for a client')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Register a client to manage their immigration journey')
    ).toBeInTheDocument();
  });

  test('displays progress text showing 0 of 5 steps complete initially', () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText('0 of 5 steps complete')).toBeInTheDocument();
  });

  test('renders dismiss button with aria-label', () => {
    render(<OnboardingChecklist />);
    expect(
      screen.getByRole('button', { name: 'Dismiss onboarding checklist' })
    ).toBeInTheDocument();
  });

  test('toggles step completion when checkbox button is clicked', () => {
    render(<OnboardingChecklist />);

    // Click the first step's toggle button
    const toggleBtn = screen.getByRole('button', {
      name: 'Mark "Create your first case" as complete',
    });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('1 of 5 steps complete')).toBeInTheDocument();

    // Verify localStorage was updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'casefill-onboarding',
      expect.stringContaining('create-case')
    );
  });

  test('un-toggles step when already completed', () => {
    render(<OnboardingChecklist />);

    const toggleBtn = screen.getByRole('button', {
      name: 'Mark "Create your first case" as complete',
    });

    // Complete the step
    fireEvent.click(toggleBtn);
    expect(screen.getByText('1 of 5 steps complete')).toBeInTheDocument();

    // Now the button label should say "incomplete"
    const uncompleteBtn = screen.getByRole('button', {
      name: 'Mark "Create your first case" as incomplete',
    });
    fireEvent.click(uncompleteBtn);

    expect(screen.getByText('0 of 5 steps complete')).toBeInTheDocument();
  });

  test('shows celebration message when all steps are complete', () => {
    render(<OnboardingChecklist />);

    // Complete all 5 steps
    const steps = [
      'Create your first case',
      'Add a client',
      'Upload a document',
      'Review AI recommendations',
      'Set up your firm profile',
    ];

    for (const step of steps) {
      const btn = screen.getByRole('button', {
        name: `Mark "${step}" as complete`,
      });
      fireEvent.click(btn);
    }

    expect(screen.getByText('All done! You are all set.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Congratulations! You have completed all onboarding steps. You can dismiss this checklist now.'
      )
    ).toBeInTheDocument();
  });

  test('dismiss button hides the checklist', () => {
    render(<OnboardingChecklist />);

    expect(screen.getByText('Getting Started')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', {
      name: 'Dismiss onboarding checklist',
    });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
  });

  test('dismiss persists to localStorage', () => {
    render(<OnboardingChecklist />);

    const dismissBtn = screen.getByRole('button', {
      name: 'Dismiss onboarding checklist',
    });
    fireEvent.click(dismissBtn);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'casefill-onboarding',
      expect.stringContaining('"dismissed":true')
    );
  });

  test('does not render if dismissed state is loaded from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ dismissed: true, completedSteps: [] })
    );

    render(<OnboardingChecklist />);
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
  });

  test('loads completed steps from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        dismissed: false,
        completedSteps: ['create-case', 'add-client'],
      })
    );

    render(<OnboardingChecklist />);
    expect(screen.getByText('2 of 5 steps complete')).toBeInTheDocument();
  });

  test('renders step links with correct hrefs', () => {
    render(<OnboardingChecklist />);

    const createCaseLink = screen.getByRole('link', {
      name: 'Create your first case',
    });
    expect(createCaseLink).toHaveAttribute('href', '/dashboard/cases/new');

    const addClientLink = screen.getByRole('link', { name: 'Add a client' });
    expect(addClientLink).toHaveAttribute('href', '/dashboard/clients');
  });
});
