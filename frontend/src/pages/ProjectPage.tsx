import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Equipment, cn, formatDate, getCategoryColor, getCategoryIcon, getConfidenceColor } from '../lib/utils';
import { ArrowLeft, Upload, FileText, Loader2, BarChart3, FileDiff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch project
  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}`);
      return data.data;
    },
    enabled: !!projectId,
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId!);
      
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: async (uploadData) => {
      // Trigger extraction
      const { data } = await api.post('/takeoff/extract', {
        fileId: uploadData.data.fileId,
        projectId,
      });
      toast.success('File processed successfully');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      return data;
    },
    onError: () => {
      toast.error('Upload failed');
      setIsUploading(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be under 50MB');
      return;
    }
    
    setIsUploading(true);
    await uploadMutation.mutateAsync(file);
    setIsUploading(false);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      // Trigger file selection
      const dataTransfer = new DataTransfer();
      dataTransfer.files.add(file);
      fileInputRef.current!.files = dataTransfer.files;
      // Manually trigger change
      const event = new Event('change', { bubbles: true });
      fileInputRef.current!.dispatchEvent(event);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {projectData?.name || 'Loading...'}
            </h1>
            {projectData?.description && (
              <p className="text-sm text-gray-600">{projectData.description}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragDrop}
          className={cn(
            "upload-zone mb-8",
            isUploading && "active"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          <div className="text-center">
            {isUploading ? (
              <>
                <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-lg font-medium text-gray-900">Processing PDF...</p>
                <p className="text-gray-600">This may take a moment</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your PDF here, or click to browse
                </p>
                <p className="text-gray-600 mb-4">
                  Supports PDF files up to 50MB
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  Select PDF
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Total Files</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Equipment Found</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileDiff className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Revisions</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-600">Last Updated</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {projectData?.updatedAt ? formatDate(projectData.updatedAt) : '—'}
            </p>
          </div>
        </div>

        {/* Placeholder for results */}
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-600">
            Upload a PDF to see extracted equipment and take-off data
          </p>
        </div>
      </main>
    </div>
  );
}
