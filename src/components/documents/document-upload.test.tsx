import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentUpload } from './document-upload';

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

// Mock storage utils
vi.mock('@/lib/storage/utils', () => ({
  formatFileSize: (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  },
  isAllowedFileType: (mimeType: string) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    return allowed.includes(mimeType);
  },
}));

// Mock AI components
vi.mock('@/components/ai', () => ({
  AIConsentModal: ({
    open,
    onConsent,
    onCancel,
  }: {
    open: boolean;
    onConsent: () => void;
    onCancel: () => void;
    error?: string | null;
  }) =>
    open ? (
      <div data-testid="ai-consent-modal">
        <button onClick={onConsent}>Accept AI</button>
        <button onClick={onCancel}>Decline AI</button>
      </div>
    ) : null,
}));

// Mock billing upgrade components
vi.mock('@/components/billing/upgrade-prompt', () => ({
  UpgradePromptDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    metric: string;
    quota: unknown;
  }) => (open ? <div data-testid="upgrade-dialog">Upgrade Dialog</div> : null),
  UpgradePromptBanner: ({
    metric,
    quota,
  }: {
    metric: string;
    quota: { allowed: boolean; isUnlimited: boolean };
  }) =>
    !quota.isUnlimited && !quota.allowed ? (
      <div data-testid={`upgrade-banner-${metric}`}>Quota limit for {metric}</div>
    ) : null,
}));

// Mock hooks
const mockUploadDocument = vi.fn();
const mockUseUploadDocument = vi.fn();
vi.mock('@/hooks/use-documents', () => ({
  useUploadDocument: (...args: unknown[]) => mockUseUploadDocument(...args),
}));

const mockUseQuota = vi.fn();
vi.mock('@/hooks/use-quota', () => ({
  useQuota: (...args: unknown[]) => mockUseQuota(...args),
}));

const mockUseAiConsent = vi.fn();
vi.mock('@/hooks/use-ai-consent', () => ({
  useAiConsent: (...args: unknown[]) => mockUseAiConsent(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('DocumentUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUploadDocument.mockReturnValue({
      mutate: mockUploadDocument,
      isPending: false,
    });
    mockUseQuota.mockReturnValue({ data: null });
    mockUseAiConsent.mockReturnValue({
      hasConsented: true,
      showConsentModal: false,
      consentError: null,
      grantConsent: vi.fn(),
      openConsentDialog: vi.fn(),
      closeConsentDialog: vi.fn(),
    });
  });

  test('renders upload drop zone with instructions', () => {
    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByText(/Drag and drop files here/)).toBeInTheDocument();
    expect(screen.getByText('browse')).toBeInTheDocument();
    expect(screen.getByText(/Supported: PDF, Images/)).toBeInTheDocument();
  });

  test('renders file input with correct accept attribute', () => {
    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.accept).toBe('.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx');
    expect(fileInput.multiple).toBe(true);
  });

  test('does not show file queue when no files selected', () => {
    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.queryByText(/Selected Files/)).not.toBeInTheDocument();
  });

  test('adds files to queue on file input change', () => {
    // Mock crypto.randomUUID
    const originalRandomUUID = crypto.randomUUID;
    let counter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${++counter}`);

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const testFile = new File(['test content'], 'test-passport.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(testFile, 'size', { value: 1024 });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(screen.getByText('Selected Files (1)')).toBeInTheDocument();
    expect(screen.getByText('test-passport.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Upload 1 File/)).toBeInTheDocument();

    crypto.randomUUID = originalRandomUUID;
  });

  test('shows document type selector for each file', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1');

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const testFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(testFile, 'size', { value: 512 });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(screen.getByText('Document Type')).toBeInTheDocument();
  });

  test('removes file from queue when remove button is clicked', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1');

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const testFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(testFile, 'size', { value: 512 });

    fireEvent.change(fileInput, { target: { files: [testFile] } });
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();

    // Find the remove button - it's a button with variant="ghost" and size="icon"
    // containing the X svg icon. Get all buttons except the Upload button.
    const allButtons = screen.getAllByRole('button');
    const removeBtn = allButtons.find(
      (btn) => !btn.textContent?.includes('Upload') && !btn.textContent?.includes('Accept') && !btn.textContent?.includes('Decline')
    );
    expect(removeBtn).toBeDefined();
    fireEvent.click(removeBtn!);

    expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
  });

  test('shows quota warning banner when document quota is at limit', () => {
    mockUseQuota.mockImplementation((metric: string) => {
      if (metric === 'documents') {
        return {
          data: {
            allowed: false,
            isUnlimited: false,
            current: 50,
            limit: 50,
            remaining: 0,
          },
        };
      }
      return { data: null };
    });

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('upgrade-banner-documents')).toBeInTheDocument();
  });

  test('opens consent modal when uploading without consent', () => {
    const mockOpenConsent = vi.fn();
    mockUseAiConsent.mockReturnValue({
      hasConsented: false,
      showConsentModal: false,
      consentError: null,
      grantConsent: vi.fn(),
      openConsentDialog: mockOpenConsent,
      closeConsentDialog: vi.fn(),
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1');

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const testFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(testFile, 'size', { value: 512 });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Click upload
    fireEvent.click(screen.getByText(/Upload 1 File/));
    expect(mockOpenConsent).toHaveBeenCalled();
    expect(mockUploadDocument).not.toHaveBeenCalled();
  });

  test('shows consent modal component when showConsentModal is true', () => {
    mockUseAiConsent.mockReturnValue({
      hasConsented: false,
      showConsentModal: true,
      consentError: null,
      grantConsent: vi.fn(),
      openConsentDialog: vi.fn(),
      closeConsentDialog: vi.fn(),
    });

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    expect(screen.getByTestId('ai-consent-modal')).toBeInTheDocument();
  });

  test('upload button shows Uploading... when isPending', () => {
    mockUseUploadDocument.mockReturnValue({
      mutate: mockUploadDocument,
      isPending: true,
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1');

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const testFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(testFile, 'size', { value: 512 });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  test('upload button is disabled when isPending', () => {
    mockUseUploadDocument.mockReturnValue({
      mutate: mockUploadDocument,
      isPending: true,
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-1');

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const testFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(testFile, 'size', { value: 512 });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const uploadBtn = screen.getByText('Uploading...').closest('button');
    expect(uploadBtn).toBeDisabled();
  });

  test('shows upload button with correct plural text for multiple files', () => {
    let counter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${++counter}`);

    render(<DocumentUpload caseId="case-1" />, { wrapper: createWrapper() });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file1 = new File(['a'], 'doc1.pdf', { type: 'application/pdf' });
    const file2 = new File(['b'], 'doc2.pdf', { type: 'application/pdf' });
    Object.defineProperty(file1, 'size', { value: 512 });
    Object.defineProperty(file2, 'size', { value: 1024 });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText(/Upload 2 Files/)).toBeInTheDocument();
  });
});
