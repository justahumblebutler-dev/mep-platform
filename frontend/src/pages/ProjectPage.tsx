import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Equipment, cn, formatDate } from '../lib/utils';
import { EquipmentList, UploadZone } from '../components';
import { ArrowLeft, FileText, Loader2, BarChart3, FileDiff, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface TakeoffData {
  id: string;
  equipment: Equipment[];
  stats: {
    pages: number;
    equipment_count: number;
    unique_tags: number;
    by_category: Record<string, number>;
  };
  metadata: {
    page_count: number;
    title?: string;
    author?: string;
    created?: string;
  };
  version_info?: {
    drawing_date?: string;
    revision?: string;
  };
  fileName: string;
  createdAt: string;
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [takeoffs, setTakeoffs] = useState<TakeoffData[]>([]);
  const [selectedTakeoff, setSelectedTakeoff] = useState<string | null>(null);

  // Fetch project
  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}`);
      return data.data;
    },
    enabled: !!projectId,
  });

  // Mock: For demo, we'll use extracted data from our Python script
  // In production, this would come from the database
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be under 50MB');
      return;
    }

    setIsUploading(true);
    setCurrentFile(file.name);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId!);
      
      const { data: uploadData } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearInterval(progressInterval);
      setUploadProgress(95);

      // Trigger extraction
      const { data: extractData } = await api.post('/takeoff/extract', {
        fileId: uploadData.data.fileId,
        projectId,
      });

      setUploadProgress(100);

      // Add to takeoffs list
      const newTakeoff: TakeoffData = {
        id: crypto.randomUUID(),
        equipment: extractData.data.equipment,
        stats: extractData.data.stats,
        metadata: extractData.data.metadata,
        version_info: extractData.data.version_info,
        fileName: uploadData.data.filename,
        createdAt: new Date().toISOString(),
      };

      setTakeoffs(prev => [newTakeoff, ...prev]);
      setSelectedTakeoff(newTakeoff.id);
      
      toast.success('File processed successfully!');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

    } catch (error) {
      toast.error('Upload failed. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setCurrentFile('');
      setUploadProgress(0);
    }
  }, [projectId, queryClient]);

  const selectedTakeoffData = takeoffs.find(t => t.id === selectedTakeoff);

  // Calculate stats
  const totalEquipment = takeoffs.reduce((sum, t) => sum + t.equipment.length, 0);
  const totalFiles = takeoffs.length;
  const avgConfidence = takeoffs.length > 0 
    ? takeoffs.reduce((sum, t) => sum + t.equipment.reduce((s, e) => s + e.confidence, 0) / (t.equipment.length || 1), 0) / takeoffs.length
    : 0;

  if (projectLoading) {
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
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">
              {projectData?.name || 'Loading...'}
            </h1>
            {projectData?.description && (
              <p className="text-sm text-gray-600">{projectData.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // TODO: Export functionality
                toast('Export coming soon!');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Zone */}
        <div className="mb-8">
          <UploadZone
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            currentFile={currentFile}
            onCancel={() => {
              setIsUploading(false);
              setUploadProgress(0);
              setCurrentFile('');
            }}
          />
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Total Files</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalFiles}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Equipment Found</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalEquipment}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileDiff className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Avg Confidence</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{(avgConfidence * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-600">Last Updated</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {takeoffs.length > 0 
                ? formatDate(takeoffs[0].createdAt)
                : projectData?.updatedAt 
                  ? formatDate(projectData.updatedAt)
                  : '—'
              }
            </p>
          </div>
        </div>

        {/* Results Section */}
        {takeoffs.length > 0 && (
          <div className="space-y-6">
            {/* Takeoff Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {takeoffs.map((takeoff) => (
                <button
                  key={takeoff.id}
                  onClick={() => setSelectedTakeoff(takeoff.id)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors",
                    selectedTakeoff === takeoff.id
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <FileText className="w-4 h-4" />
                  {takeoff.fileName}
                  <span className="text-xs opacity-75">
                    ({takeoff.equipment.length} items)
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Takeoff Results */}
            {selectedTakeoffData && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedTakeoffData.fileName}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span>{selectedTakeoffData.metadata.page_count} pages</span>
                      {selectedTakeoffData.version_info?.revision && (
                        <span>Revision: {selectedTakeoffData.version_info.revision}</span>
                      )}
                      {selectedTakeoffData.version_info?.drawing_date && (
                        <span>Date: {selectedTakeoffData.version_info.drawing_date}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Re-extract
                      toast('Re-extraction coming soon!');
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Re-extract
                  </button>
                </div>

                {/* Equipment List */}
                <EquipmentList 
                  equipment={selectedTakeoffData.equipment}
                />
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {takeoffs.length === 0 && !isUploading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents processed yet</h3>
            <p className="text-gray-600 mb-4">
              Upload a PDF to extract equipment and create a take-off
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
