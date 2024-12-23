import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { FilePreview } from './FilePreview';
import { Button } from '@/components/ui/button';

interface ValidationError {
  error: string;
  details: string[];
  totalLines?: number;
}

interface UploadResponse {
  message: string;
  file?: {
    id: string;
    purpose: string;
    filename: string;
    bytes: number;
    created_at: string;
    status: string;
    totalLines: number;
  };
}

export function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setEditedContent(null);
      setValidationError(null);
      setUploadResponse(null);
      setUploadProgress(0);
    }
  }, []);

  const handleFileContentChange = (content: string) => {
    setEditedContent(content);
    // Reset validation and upload states when content is edited
    setValidationError(null);
    setUploadResponse(null);
    setUploadProgress(0);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/jsonl': ['.jsonl'],
    },
    maxFiles: 1,
  });

  const validateFile = async () => {
    if (!file) return;
    
    setIsValidating(true);
    setValidationError(null);

    const formData = new FormData();
    
    if (editedContent) {
      // If we have edited content, create a new file from it
      const blob = new Blob([editedContent], { type: 'application/jsonl' });
      const editedFile = new File([blob], file.name, { type: 'application/jsonl' });
      formData.append('file', editedFile);
    } else {
      formData.append('file', file);
    }

    try {
      await axios.post('http://localhost:3001/api/validate-jsonl', formData);
      setIsValidating(false);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        setValidationError(error.response.data as ValidationError);
      } else {
        setValidationError({
          error: 'Validation failed',
          details: ['Unknown error occurred during validation']
        });
      }
      setIsValidating(false);
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    
    if (editedContent) {
      // If we have edited content, create a new file from it
      const blob = new Blob([editedContent], { type: 'application/jsonl' });
      const editedFile = new File([blob], file.name, { type: 'application/jsonl' });
      formData.append('file', editedFile);
    } else {
      formData.append('file', file);
    }
    
    formData.append('purpose', 'fine-tune');

    try {
      const response = await axios.post<UploadResponse>(
        'http://localhost:3001/api/upload',
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(progress);
          },
        }
      );

      setUploadResponse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        setValidationError(error.response.data as ValidationError);
      } else {
        setValidationError({
          error: 'Upload failed',
          details: ['Unknown error occurred during upload']
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400",
          (isValidating || isUploading) && "pointer-events-none opacity-50"
        )}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-500">Drop the JSONL file here</p>
        ) : (
          <div>
            <p className="text-gray-600">
              Drag and drop a JSONL file here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Only .jsonl files are accepted
            </p>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              {editedContent && <span className="text-blue-500 ml-2">(Edited)</span>}
            </p>
            <div className="space-x-2">
              <FilePreview
                file={file}
                maxPreviewLines={10}
                onFileContentChange={handleFileContentChange}
              />
              <Button
                onClick={validateFile}
                disabled={isValidating || isUploading}
                variant="secondary"
              >
                Validate
              </Button>
              <Button
                onClick={uploadFile}
                disabled={isValidating || isUploading || !!validationError}
              >
                Upload
              </Button>
            </div>
          </div>
        </div>
      )}

      {(isValidating || isUploading) && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {isValidating ? 'Validating file...' : `Uploading: ${uploadProgress}%`}
          </p>
        </div>
      )}

      {validationError && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <h3 className="text-red-800 font-medium">{validationError.error}</h3>
          <ul className="mt-2 list-disc list-inside">
            {validationError.details.map((detail, index) => (
              <li key={index} className="text-sm text-red-700">{detail}</li>
            ))}
          </ul>
          {validationError.totalLines && (
            <p className="mt-2 text-sm text-red-700">
              Total lines processed: {validationError.totalLines}
            </p>
          )}
        </div>
      )}

      {uploadResponse && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg">
          <h3 className="text-green-800 font-medium">{uploadResponse.message}</h3>
          {uploadResponse.file && (
            <div className="mt-2 text-sm text-green-700">
              <p>File ID: {uploadResponse.file.id}</p>
              <p>Status: {uploadResponse.file.status}</p>
              <p>Total lines: {uploadResponse.file.totalLines}</p>
              <p>Size: {(uploadResponse.file.bytes / 1024).toFixed(2)} KB</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
