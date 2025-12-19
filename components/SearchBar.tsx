"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Form {
  id: string;
  title: string;
  description: string;
  published: boolean;
  createdAt: string;
}

interface SearchBarProps {
  hasUserForms?: boolean;
}

export default function SearchBar({ hasUserForms = true }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Form[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search forms with debouncing
  useEffect(() => {
    const searchForms = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      // Don't search if user has no forms
      if (!hasUserForms) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/forms/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await response.json();
        
        if (data.success) {
          setSuggestions(data.forms || []);
          setIsOpen(true);
        }
      } catch (error) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchForms, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, hasUserForms]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleFormClick = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input - Google Forms Style */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
          <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search forms"
          className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 text-xs sm:text-sm border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none transition-all duration-200 placeholder-gray-500 dark:placeholder-gray-400"
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center">
            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown - YouTube Style */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] sm:max-h-96 overflow-y-auto z-50">
          {suggestions.map((form) => (
            <Link 
              key={form.id} 
              href={`/forms/${form.id}`}
              onClick={handleFormClick}
              className="block px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                    <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {form.title}
                    </h3>
                    <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                      form.published 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {form.published ? 'Live' : 'Draft'}
                    </span>
                  </div>
                  {form.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {form.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Created {formatDate(form.createdAt)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && searchQuery.trim().length >= 2 && suggestions.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
            No forms found matching "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );
}