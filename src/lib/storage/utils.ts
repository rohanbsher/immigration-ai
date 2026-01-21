// Pure utility functions for storage - no server-side imports
// Can be safely used in both client and server components

// Helper to generate unique file paths
export function generateFilePath(caseId: string, fileName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const ext = fileName.split('.').pop();
  const sanitizedName = fileName
    .split('.')
    .slice(0, -1)
    .join('.')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);

  return `${caseId}/${timestamp}-${randomStr}-${sanitizedName}.${ext}`;
}

// Helper to get file extension
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

// Helper to check if file type is allowed
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  return allowedTypes.includes(mimeType);
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
