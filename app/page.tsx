"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import FloatingActionButton from "@/components/FloatingActionButton";

interface UserForm {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  createdAt: string;
  sections: {
    id: string;
    questions: {
      id: string;
      text: string;
      type: string;
      required: boolean;
      options: {
        text: string;
      }[];
    }[];
  }[];
}

export default function Dashboard() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [userForms, setUserForms] = useState<UserForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingFormId, setRenamingFormId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState<string>('');
  const [showFab, setShowFab] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        fetchUserForms();
      } else {
        setLoading(false);
      }
    }
  }, [isSignedIn, isLoaded]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Show FAB when 'New form' card is scrolled out of view
  useEffect(() => {
    const newFormSection = document.getElementById('new-form-section');
    const handleScroll = () => {
      if (!newFormSection) return;
      const rect = newFormSection.getBoundingClientRect();
      setShowFab(rect.bottom < 0);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchUserForms = async () => {
    try {
      const response = await fetch('/api/forms/user');
      const data = await response.json();
      
      if (data.success) {
        setUserForms(data.forms);
      }
    } catch (error) {
      // Error fetching forms
    } finally {
      setLoading(false);
    }
  };

  // Action Handlers
  const handleEditForm = (formId: string) => {
    router.push(`/forms/${formId}`);
  };

  const handleDuplicateForm = (formId: string) => {
    // Feature coming soon
  };

  const handleMenuToggle = (formId: string) => {
    setOpenMenuId(openMenuId === formId ? null : formId);
  };

  const handleRenameForm = (formId: string) => {
    const form = userForms.find(f => f.id === formId);
    if (form) {
      setNewTitle(form.title);
      setRenamingFormId(formId);
      setOpenMenuId(null);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renamingFormId || !newTitle.trim()) return;

    try {
      const response = await fetch(`/api/forms/rename/${renamingFormId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the form in the UI
        setUserForms(userForms.map(form => 
          form.id === renamingFormId 
            ? { ...form, title: newTitle.trim() }
            : form
        ));
        setRenamingFormId(null);
        setNewTitle('');
      }
    } catch (error) {
    }
  };

  const handleRenameCancel = () => {
    setRenamingFormId(null);
    setNewTitle('');
  };

  const handleOpenInNewTab = (formId: string) => {
    const url = `/forms/${formId}`;
    window.open(url, '_blank');
    setOpenMenuId(null);
  };

  const handleDeleteForm = async (formId: string) => {
    // Confirm before deleting
    if (confirm('Are you sure you want to delete this form?')) {
      try {
        const response = await fetch(`/api/forms/delete/${formId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Remove from UI
          setUserForms(userForms.filter(form => form.id !== formId));
        }
      } catch (error) {
        // Error deleting form
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Start a new form section */}
        <div className="mb-8 sm:mb-10 lg:mb-12" id="new-form-section">
          <h2 className="text-base sm:text-lg font-medium text-gray-700 mb-3 sm:mb-4">Start a new form</h2>
          <div className="w-full sm:w-48">
            {isSignedIn ? (
              <button 
                onClick={() => router.push('/forms/create')}
                className="block w-full"
              >
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                  <div className="text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-900">New form</p>
                  </div>
                </div>
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="block w-full">
                  <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                    <div className="text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-gray-900">New form</p>
                    </div>
                  </div>
                </button>
              </SignInButton>
            )}
          </div>
        </div>

        {/* Owned by you section */}
        <div>
          <h2 className="text-base sm:text-lg font-medium text-gray-700 mb-4 sm:mb-6">Owned by you</h2>
          
          {/* Forms grid - responsive */}
          {!isLoaded || loading ? (
            <div className="py-6 sm:py-8">
              <LoadingSpinner message="Loading your forms..." size="md" fullScreen={false} />
            </div>
          ) : !isSignedIn ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm sm:text-base text-gray-500">Please sign in to view your forms.</p>
            </div>
          ) : userForms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
              {userForms.map((form) => (
                <div key={form.id} className="w-full bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer group">
                  
                  {/* Form Preview Area - Click to Edit */}
                  <div onClick={() => handleEditForm(form.id)} className="relative">
                    
                    {/* Clean Professional Preview */}
                    <div className="h-32 sm:h-36 bg-gray-50 overflow-hidden relative rounded-t-lg">
                      
                      {/* Blue header stripe */}
                      <div className="h-1 bg-blue-600 w-full"></div>
                      
                      {/* Preview content */}
                      <div className="p-3 sm:p-4 bg-white h-full">
                        
                        {/* Form title */}
                        <div className="mb-2 sm:mb-3">
                          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                            {form.title}
                          </h3>
                          {form.description && (
                            <p className="text-xs text-gray-600 mt-0.5 sm:mt-1 line-clamp-2">
                              {form.description}
                            </p>
                          )}
                        </div>

                        {/* Questions summary */}
                        <div className="space-y-1.5 sm:space-y-2">
                          {form.sections && form.sections.length > 0 && 
                           form.sections.flatMap(section => section.questions).slice(0, 3).map((question, index) => (
                            <div key={question.id} className="flex items-start space-x-1.5 sm:space-x-2">
                              <span className="text-xs text-gray-400 mt-0.5">{index + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-700 truncate break-words">
                                  {question.text || "Untitled question"}
                                  {question.required && <span className="text-red-500 ml-1">*</span>}
                                </p>
                                <div className="flex items-center mt-0.5 sm:mt-1">
                                  {question.type === 'SHORT_ANSWER' && (
                                    <>
                                      <div className="w-3 h-0.5 bg-gray-300 mr-2"></div>
                                      <span className="text-xs text-gray-400">Short answer</span>
                                    </>
                                  )}
                                  {question.type === 'PARAGRAPH' && (
                                    <>
                                      <div className="w-3 h-2 border border-gray-300 mr-2"></div>
                                      <span className="text-xs text-gray-400">Paragraph</span>
                                    </>
                                  )}
                                  {question.type === 'MULTIPLE_CHOICE' && (
                                    <>
                                      <div className="w-2 h-2 border border-gray-400 rounded-full mr-2"></div>
                                      <span className="text-xs text-gray-400">Multiple choice</span>
                                    </>
                                  )}
                                  {question.type === 'CHECKBOXES' && (
                                    <>
                                      <div className="w-2 h-2 border border-gray-400 mr-2"></div>
                                      <span className="text-xs text-gray-400">Checkboxes</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {form.sections && form.sections.flatMap(section => section.questions).length > 3 && (
                            <div className="flex items-center space-x-2 pt-0.5 sm:pt-1">
                              <span className="text-xs text-gray-400">...</span>
                              <span className="text-xs text-gray-400">
                                {form.sections.flatMap(section => section.questions).length - 3} more questions
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Info Footer - Clean Single Line Layout */}
                  <div className="px-3 sm:px-4 py-2.5 sm:py-3">
                    <div className="flex items-center justify-between gap-2">
                      {/* Left Side - Form Icon + Title */}
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                          </svg>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate break-words">{form.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(form.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Right Side - Status + Menu (All in one line) */}
                      <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
                        <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold shadow-sm ${
                          form.published 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}>
                          {form.published ? 'Live' : 'Draft'}
                        </span>
                        
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMenuToggle(form.id);
                            }}
                            className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:shadow-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z" />
                            </svg>
                          </button>
                          
                          {/* Dropdown Menu */}
                          {openMenuId === form.id && (
                            <div className="absolute right-0 top-full mt-2 w-44 sm:w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameForm(form.id);
                                }}
                                className="flex items-center space-x-2 w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 text-left">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Rename</span>
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenInNewTab(form.id);
                                }}
                                className="flex items-center space-x-2 w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 text-left">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                <span>Open in new tab</span>
                              </button>
                              
                              <hr className="my-1" />
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteForm(form.id);
                                }}
                                className="flex items-center space-x-2 w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 text-left">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Empty state
            <div className="text-center py-12 sm:py-16">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">No forms yet</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 max-w-sm mx-auto px-4">Create your first form to start collecting responses and engaging with your audience!</p>
              <Link href="/forms/create">
                <span className="text-sm sm:text-base text-blue-600 hover:text-blue-700 font-medium">Create a form →</span>
              </Link>
            </div>
          )}
        </div>

      </div>

      {/* Rename Modal */}
      {renamingFormId && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-200 px-4"
          onClick={handleRenameCancel}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-200 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Rename form
              </h3>
            </div>
            
            <div className="px-4 sm:px-6 py-4 sm:py-5">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
                Form title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all duration-200"
                placeholder="Enter form title"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                autoFocus
              />
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-2 sm:space-x-3 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
              <button
                onClick={handleRenameCancel}
                className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!newTitle.trim()}
                className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Create New Form */}
      {showFab && <FloatingActionButton isSignedIn={isSignedIn} />}
    </div>
  );
}