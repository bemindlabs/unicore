'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@unicore/ui';

interface FileUploadInputProps {
  accept?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  progress?: number;
  processing?: boolean;
}

export function FileUploadInput({
  accept = '.pdf,application/pdf',
  maxSizeMB = 25,
  onFileSelect,
  selectedFile,
  progress,
  processing = false,
}: FileUploadInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (file.size > maxSizeMB * 1024 * 1024) {
        setSizeError(`File exceeds the ${maxSizeMB} MB limit.`);
        return;
      }
      setSizeError(null);
      onFileSelect(file);
    },
    [maxSizeMB, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer.files[0] ?? null);
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
  };

  const clearFile = () => {
    onFileSelect(null);
    setSizeError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (selectedFile) {
    const isUploading = progress !== undefined && progress < 100;
    const isProcessing = processing;
    const isDone = progress === 100 && !processing;

    return (
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <div className="flex items-center gap-3">
          {isUploading || isProcessing ? (
            <Loader2 className="h-8 w-8 text-primary shrink-0 animate-spin" />
          ) : (
            <FileText className="h-8 w-8 text-primary shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · PDF
            </p>
          </div>
          {!isUploading && !isProcessing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFile}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {progress !== undefined && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {isProcessing
                  ? 'Processing document…'
                  : isUploading
                    ? 'Uploading…'
                    : isDone
                      ? 'Upload complete'
                      : ''}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDF file"
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer select-none transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />
        <Upload className="mx-auto h-8 w-8 mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">PDF files up to {maxSizeMB} MB</p>
      </div>
      {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
    </div>
  );
}
