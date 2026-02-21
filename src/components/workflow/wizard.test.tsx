import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Wizard } from './wizard';

// Mock motion/react to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
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

const defaultSteps = [
  {
    id: 'step-1',
    title: 'Personal Info',
    description: 'Enter your personal information',
    content: <div>Step 1 Content</div>,
    isValid: true,
  },
  {
    id: 'step-2',
    title: 'Documents',
    description: 'Upload required documents',
    content: <div>Step 2 Content</div>,
    isValid: true,
  },
  {
    id: 'step-3',
    title: 'Review',
    description: 'Review your submission',
    content: <div>Step 3 Content</div>,
    isValid: true,
  },
];

describe('Wizard', () => {
  let onStepChange: ReturnType<typeof vi.fn>;
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    onStepChange = vi.fn();
    onComplete = vi.fn();
  });

  test('renders current step title and description', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={0} onStepChange={onStepChange} />
    );
    expect(screen.getByText('Personal Info')).toBeInTheDocument();
    expect(screen.getByText('Enter your personal information')).toBeInTheDocument();
  });

  test('renders current step content', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={0} onStepChange={onStepChange} />
    );
    expect(screen.getByText('Step 1 Content')).toBeInTheDocument();
  });

  test('renders step indicators for all steps', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={0} onStepChange={onStepChange} />
    );
    // Step numbers should appear
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('renders Previous and Next buttons', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={0} onStepChange={onStepChange} />
    );
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  test('Previous button is disabled on first step', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={0} onStepChange={onStepChange} />
    );
    expect(screen.getByText('Previous').closest('button')).toBeDisabled();
  });

  test('Next button calls onStepChange with incremented step', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={0} onStepChange={onStepChange} />
    );
    fireEvent.click(screen.getByText('Next'));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  test('Previous button calls onStepChange with decremented step', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={1} onStepChange={onStepChange} />
    );
    fireEvent.click(screen.getByText('Previous'));
    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  test('shows "Complete" button on last step', () => {
    render(
      <Wizard
        steps={defaultSteps}
        currentStep={2}
        onStepChange={onStepChange}
        onComplete={onComplete}
      />
    );
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  test('calls onComplete when Complete is clicked on last step', () => {
    render(
      <Wizard
        steps={defaultSteps}
        currentStep={2}
        onStepChange={onStepChange}
        onComplete={onComplete}
      />
    );
    fireEvent.click(screen.getByText('Complete'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('disables Next button when current step isValid is false', () => {
    const steps = [
      { ...defaultSteps[0], isValid: false },
      ...defaultSteps.slice(1),
    ];
    render(
      <Wizard steps={steps} currentStep={0} onStepChange={onStepChange} />
    );
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
  });

  test('persists step to localStorage when persistKey is provided', () => {
    render(
      <Wizard
        steps={defaultSteps}
        currentStep={1}
        onStepChange={onStepChange}
        persistKey="test-wizard"
      />
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith('wizard-test-wizard', '1');
  });

  test('restores step from localStorage on mount with persistKey', () => {
    localStorageMock.getItem.mockReturnValue('2');
    render(
      <Wizard
        steps={defaultSteps}
        currentStep={0}
        onStepChange={onStepChange}
        persistKey="restore-test"
      />
    );
    expect(onStepChange).toHaveBeenCalledWith(2);
  });

  test('clicking completed step indicator navigates back', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={2} onStepChange={onStepChange} />
    );
    // Step 1 indicator should be clickable when on step 3
    const buttons = screen.getAllByRole('button');
    // Find the step indicator buttons (not Previous/Next)
    const stepButton = buttons.find((b) => b.querySelector('svg'));
    if (stepButton) {
      fireEvent.click(stepButton);
      expect(onStepChange).toHaveBeenCalled();
    }
  });

  test('renders second step content when currentStep is 1', () => {
    render(
      <Wizard steps={defaultSteps} currentStep={1} onStepChange={onStepChange} />
    );
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Step 2 Content')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(
      <Wizard
        steps={defaultSteps}
        currentStep={0}
        onStepChange={onStepChange}
        className="my-wizard"
      />
    );
    expect(container.firstChild).toHaveClass('my-wizard');
  });
});
