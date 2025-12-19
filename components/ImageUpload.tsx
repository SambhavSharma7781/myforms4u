'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  imageUrl?: string;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove: () => void;
}

export default function ImageUpload({ imageUrl, onImageUpload, onImageRemove }: ImageUploadProps) {
  const { toast } = useToast();
  // useState hook to track if image is being uploaded
  const [isUploading, setIsUploading] = useState(false);
  
  // useRef hook to reference the hidden file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function that triggers when user clicks "Add Image" button
  const handleImageClick = () => {
    fileInputRef.current?.click(); // Programmatically click the hidden file input
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Get the first selected file
    if (!file) return; // Exit if no file selected

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true); // Show loading state

    try {
      // Convert file to base64 string for display
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageUpload(result); // Pass the base64 string to parent component
        setIsUploading(false); // Hide loading state
      };
      reader.readAsDataURL(file); // Start reading file as base64
    } catch (error) {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-2">
      {/* Hidden file input - this is invisible but functional */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Show image if one exists */}
      {imageUrl ? (
        <div className="mt-2">
          <img
            src={imageUrl}
            alt="Question image"
            className="max-w-full h-auto rounded-lg border border-gray-200"
            style={{ maxHeight: '300px' }}
          />
          {/* Remove image button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImageRemove}
            className="mt-2 text-red-600 hover:text-red-700"
          >
            Remove Image
          </Button>
        </div>
      ) : (
        /* Show "Add Image" button when no image exists */
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleImageClick}
          disabled={isUploading}
          className="text-gray-600 hover:text-gray-700"
        >
          {isUploading ? 'Uploading...' : 'Add Image'}
        </Button>
      )}
    </div>
  );
}