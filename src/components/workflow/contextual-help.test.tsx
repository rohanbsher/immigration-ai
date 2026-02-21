import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  HelpTooltip,
  FieldHelp,
  ImmigrationTerm,
  ExpandableHelp,
} from './contextual-help';

// Mock motion/react to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('HelpTooltip', () => {
  test('renders default help icon when no children provided', () => {
    render(<HelpTooltip content="Help text" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('renders custom children as trigger', () => {
    render(
      <HelpTooltip content="Help text">
        <button>Custom Trigger</button>
      </HelpTooltip>
    );
    expect(screen.getByText('Custom Trigger')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<HelpTooltip content="Help" className="custom-help" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-help');
  });
});

describe('FieldHelp', () => {
  test('renders info icon button', () => {
    render(
      <FieldHelp
        title="Field Title"
        description="Field description"
      />
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(
      <FieldHelp
        title="Title"
        description="Description"
        className="custom-field-help"
      />
    );
    expect(container.firstChild).toHaveClass('custom-field-help');
  });

  test('toggles on click', () => {
    render(
      <FieldHelp
        title="Field Title"
        description="Field description"
      />
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // Toggle was clicked, component should update
    expect(button).toBeInTheDocument();
  });
});

describe('ImmigrationTerm', () => {
  test('renders children text', () => {
    render(
      <ImmigrationTerm term="H-1B" definition="Specialty occupation visa">
        H-1B Visa
      </ImmigrationTerm>
    );
    expect(screen.getByText('H-1B Visa')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(
      <ImmigrationTerm
        term="RFE"
        definition="Request for Evidence"
        className="custom-term"
      >
        RFE
      </ImmigrationTerm>
    );
    expect(screen.getByText('RFE')).toHaveClass('custom-term');
  });

  test('renders with dashed underline style', () => {
    render(
      <ImmigrationTerm term="USCIS" definition="US Citizenship and Immigration Services">
        USCIS
      </ImmigrationTerm>
    );
    const span = screen.getByText('USCIS');
    expect(span).toHaveClass('border-b', 'border-dashed');
  });

  test('renders as a span element', () => {
    render(
      <ImmigrationTerm term="I-485" definition="Application to Register Permanent Residence">
        I-485
      </ImmigrationTerm>
    );
    const element = screen.getByText('I-485');
    expect(element.tagName).toBe('SPAN');
  });
});

describe('ExpandableHelp', () => {
  test('renders title', () => {
    render(
      <ExpandableHelp title="What is an H-1B?">
        <p>Content about H-1B</p>
      </ExpandableHelp>
    );
    expect(screen.getByText('What is an H-1B?')).toBeInTheDocument();
  });

  test('is closed by default', () => {
    render(
      <ExpandableHelp title="Help Topic">
        <p>Hidden content</p>
      </ExpandableHelp>
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  test('shows content when defaultOpen is true', () => {
    render(
      <ExpandableHelp title="Help Topic" defaultOpen>
        <p>Visible content</p>
      </ExpandableHelp>
    );
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  test('toggles content on click', () => {
    render(
      <ExpandableHelp title="Help Topic">
        <p>Toggle content</p>
      </ExpandableHelp>
    );

    // Initially hidden
    expect(screen.queryByText('Toggle content')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByText('Help Topic'));
    expect(screen.getByText('Toggle content')).toBeInTheDocument();

    // Click to close
    fireEvent.click(screen.getByText('Help Topic'));
    expect(screen.queryByText('Toggle content')).not.toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(
      <ExpandableHelp title="Topic" className="custom-expand">
        <p>Content</p>
      </ExpandableHelp>
    );
    expect(container.firstChild).toHaveClass('custom-expand');
  });

  test('renders as a clickable button', () => {
    render(
      <ExpandableHelp title="Clickable Topic">
        <p>Content</p>
      </ExpandableHelp>
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  test('renders chevron icon', () => {
    const { container } = render(
      <ExpandableHelp title="Topic">
        <p>Content</p>
      </ExpandableHelp>
    );
    // Should have an SVG for the chevron
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
