'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { useUploadDocument } from '@/hooks/use-documents';
import { formatFileSize, isAllowedFileType } from '@/lib/storage/utils';
import { toast } from 'sonner';
import type { DocumentType } from '@/types';

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'visa', label: 'Visa' },
  { value: 'i94', label: 'I-94' },
  { value: 'birth_certificate', label: 'Birth Certificate' },
  { value: 'marriage_certificate', label: 'Marriage Certificate' },
  { value: 'employment_letter', label: 'Employment Letter' },
  { value: 'pay_stub', label: 'Pay Stub' },
  { value: 'tax_return', label: 'Tax Return' },
  { value: 'w2', label: 'W-2' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'photo', label: 'Passport Photo' },
  { value: 'medical_exam', label: 'Medical Exam (I-693)' },
  { value: 'police_clearance', label: 'Police Clearance' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'recommendation_letter', label: 'Recommendation Letter' },
  { value: 'other', label: 'Other' },
];

interface DocumentUploadProps {
  caseId: string;
  onSuccess?: () => void;
}

interface SelectedFile {
  file: File;
  documentType: DocumentType;
  expirationDate?: string;
  notes?: string;
}

export function DocumentUpload({ caseId, onSuccess }: DocumentUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { mutate: uploadDocument, isPending } = useUploadDocument();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((file) => {
      if (!isAllowedFileType(file.type)) {
        toast.error(`${file.name} is not a supported file type`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    const newFiles: SelectedFile[] = validFiles.map((file) => ({
      file,
      documentType: 'other' as DocumentType,
    }));

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  const updateFileType = (index: number, documentType: DocumentType) => {
    setSelectedFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, documentType } : f))
    );
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    for (const selectedFile of selectedFiles) {
      uploadDocument(
        {
          case_id: caseId,
          document_type: selectedFile.documentType,
          file: selectedFile.file,
          expiration_date: selectedFile.expirationDate,
          notes: selectedFile.notes,
        },
        {
          onSuccess: () => {
            toast.success(`${selectedFile.file.name} uploaded successfully`);
          },
          onError: (error) => {
            toast.error(`Failed to upload ${selectedFile.file.name}: ${error.message}`);
          },
        }
      );
    }

    setSelectedFiles([]);
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
        <p className="text-slate-600 mb-2">
          Drag and drop files here, or{' '}
          <label className="text-blue-600 hover:underline cursor-pointer">
            browse
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </p>
        <p className="text-sm text-slate-500">
          Supported: PDF, Images (JPG, PNG), Word documents. Max 10MB each.
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900">
            Selected Files ({selectedFiles.length})
          </h4>
          {selectedFiles.map((selectedFile, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {selectedFile.file.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatFileSize(selectedFile.file.size)}
                    </p>
                    <div className="mt-2">
                      <Label className="text-xs">Document Type</Label>
                      <select
                        value={selectedFile.documentType}
                        onChange={(e) =>
                          updateFileType(index, e.target.value as DocumentType)
                        }
                        className="mt-1 w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      >
                        {documentTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={handleUpload} disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
