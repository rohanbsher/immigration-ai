import { render, screen } from '@testing-library/react';
import { ConfidenceIndicator, ConfidenceBar } from '@/components/ai/confidence-indicator';

describe('ConfidenceIndicator', () => {
  describe('confidence levels', () => {
    it('shows high confidence (>=90%) with green styling', () => {
      render(<ConfidenceIndicator confidence={0.95} />);
      expect(screen.getByText('95%')).toBeInTheDocument();
      const container = screen.getByText('95%').parentElement;
      expect(container).toHaveClass('text-green-600', 'bg-green-50');
    });

    it('shows medium confidence (70-89%) with yellow styling', () => {
      render(<ConfidenceIndicator confidence={0.8} />);
      expect(screen.getByText('80%')).toBeInTheDocument();
      const container = screen.getByText('80%').parentElement;
      expect(container).toHaveClass('text-yellow-600', 'bg-yellow-50');
    });

    it('shows low confidence (<70%) with red styling', () => {
      render(<ConfidenceIndicator confidence={0.5} />);
      expect(screen.getByText('50%')).toBeInTheDocument();
      const container = screen.getByText('50%').parentElement;
      expect(container).toHaveClass('text-red-600', 'bg-red-50');
    });
  });

  describe('display options', () => {
    it('shows label by default', () => {
      render(<ConfidenceIndicator confidence={0.9} />);
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<ConfidenceIndicator confidence={0.9} showLabel={false} />);
      expect(screen.queryByText('90%')).not.toBeInTheDocument();
    });

    it('shows icon by default', () => {
      render(<ConfidenceIndicator confidence={0.9} />);
      // Icon is rendered as SVG
      const container = screen.getByText('90%').parentElement;
      expect(container?.querySelector('svg')).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      render(<ConfidenceIndicator confidence={0.9} showIcon={false} />);
      const container = screen.getByText('90%').parentElement;
      expect(container?.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('size options', () => {
    it('applies sm size class', () => {
      render(<ConfidenceIndicator confidence={0.9} size="sm" />);
      const container = screen.getByText('90%').parentElement;
      expect(container).toHaveClass('text-xs');
    });

    it('applies md size class by default', () => {
      render(<ConfidenceIndicator confidence={0.9} />);
      const container = screen.getByText('90%').parentElement;
      expect(container).toHaveClass('text-sm');
    });

    it('applies lg size class', () => {
      render(<ConfidenceIndicator confidence={0.9} size="lg" />);
      const container = screen.getByText('90%').parentElement;
      expect(container).toHaveClass('text-base');
    });
  });

  describe('percentage calculation', () => {
    it('rounds percentage correctly', () => {
      render(<ConfidenceIndicator confidence={0.856} />);
      expect(screen.getByText('86%')).toBeInTheDocument();
    });

    it('handles 0% confidence', () => {
      render(<ConfidenceIndicator confidence={0} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles 100% confidence', () => {
      render(<ConfidenceIndicator confidence={1} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<ConfidenceIndicator confidence={0.9} className="custom-class" />);
      const container = screen.getByText('90%').parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });
});

describe('ConfidenceBar', () => {
  it('displays percentage text', () => {
    render(<ConfidenceBar confidence={0.75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('displays "Confidence" label', () => {
    render(<ConfidenceBar confidence={0.5} />);
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('sets correct width style for progress bar', () => {
    const { container } = render(<ConfidenceBar confidence={0.8} />);
    const progressBar = container.querySelector('[style*="width: 80%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies green color for high confidence', () => {
    const { container } = render(<ConfidenceBar confidence={0.95} />);
    const progressBar = container.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies yellow color for medium confidence', () => {
    const { container } = render(<ConfidenceBar confidence={0.75} />);
    const progressBar = container.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies red color for low confidence', () => {
    const { container } = render(<ConfidenceBar confidence={0.5} />);
    const progressBar = container.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ConfidenceBar confidence={0.9} className="my-custom-class" />);
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument();
  });
});
