import React, { useCallback, useState } from 'react';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  uploadProgress?: number;
  currentFile?: string;
  onCancel?: () => void;
}

export function UploadZone({ onFileSelect, isUploading, uploadProgress, currentFile, onCancel }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  if (isUploading) {
    return (
      <div className="upload-zone active">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-lg font-medium text-gray-900">Processing PDF...</p>
          {uploadProgress !== undefined && (
            <div className="mt-4 max-w-xs mx-auto">
              <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">{uploadProgress}%</p>
            </div>
          )}
          {currentFile && (
            <p className="text-sm text-gray-600 mt-2">{currentFile}</p>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "upload-zone",
        isDragOver && "active"
      )}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="hidden"
        id="file-upload"
      />
      
      <div className="text-center">
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <label htmlFor="file-upload" className="cursor-pointer">
          <span className="text-lg font-medium text-gray-900 mb-2 block">
            Drop your PDF here, or click to browse
          </span>
        </label>
        <p className="text-gray-600 mb-4">
          Supports PDF files up to 50MB
        </p>
        <label
          htmlFor="file-upload"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <FileText className="w-5 h-5" />
          Select PDF
        </label>
      </div>
    </div>
  );
}

export default UploadZone;
