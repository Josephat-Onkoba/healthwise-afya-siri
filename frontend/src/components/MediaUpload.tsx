import React, { useState, useRef } from 'react';
import { FiLoader, FiUpload } from 'react-icons/fi';

interface MediaUploadProps {
  onFileSelect: (file: File) => void;
  accept: string;
  icon: React.ReactNode;
  buttonAriaLabel: string;
}

const MediaUpload: React.FC<MediaUploadProps> = ({ 
  onFileSelect, 
  accept, 
  icon, 
  buttonAriaLabel 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);
    setUploadProgress(0);
    setShowProgress(true);

    try {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
      }
      
      // Simulate upload progress when we don't have actual XHR progress
      const simulateProgress = () => {
        setUploadProgress(prev => {
          // Gradually increase progress up to 95%
          if (prev < 95) {
            const increment = Math.random() * 15 + 5; // 5-20% increment
            const newProgress = Math.min(95, prev + increment);
            
            // Continue simulation until near completion
            if (newProgress < 95) {
              const nextDelay = Math.random() * 300 + 200; // 200-500ms delay
              setTimeout(simulateProgress, nextDelay);
            }
            
            return newProgress;
          }
          return prev;
        });
      };
      
      // Start progress simulation
      simulateProgress();
      
      // Call the onFileSelect callback and finish progress when complete
      onFileSelect(file);
      
      // Set progress to 100% to indicate completion
      setTimeout(() => {
        setUploadProgress(100);
        
        // Hide progress bar after a delay
        setTimeout(() => {
          setShowProgress(false);
          setIsLoading(false);
          
          // Clear the file input to allow selecting the same file again
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 1000);
      }, 500);
      
    } catch (err) {
      console.error('Error in handleFileUpload:', err);
      setError(err instanceof Error ? err.message : 'Error uploading file');
      setShowProgress(false);
      setIsLoading(false);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="relative inline-block">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept={accept}
        className="hidden"
        aria-hidden="true"
      />
      <button
        onClick={handleUploadClick}
        disabled={isLoading}
        className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition relative"
        aria-label={buttonAriaLabel}
        title={buttonAriaLabel}
      >
        {isLoading ? <FiLoader className="animate-spin text-blue-500" /> : icon}
      </button>
      
      {/* Progress overlay */}
      {showProgress && (
        <div className="absolute top-full left-0 mt-1 bg-white shadow-md rounded p-2 w-32 z-10">
          <div className="text-xs text-gray-600 mb-1 flex justify-between">
            <span>Uploading...</span>
            <span>{uploadProgress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 bg-red-50 p-1 rounded w-32">
          {error}
        </div>
      )}
    </div>
  );
};

export default MediaUpload; 