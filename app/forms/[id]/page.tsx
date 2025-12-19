'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';

import LoadingSpinner from '@/components/LoadingSpinner';
import QuestionCard from '@/components/QuestionCard';
import RichTextEditor from '@/components/RichTextEditor';
import { navbarEvents } from '@/components/Navbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Question {
  id: string;
  text: string;
  description?: string;
  type: 'SHORT_ANSWER' | 'PARAGRAPH' | 'MULTIPLE_CHOICE' | 'CHECKBOXES' | 'DROPDOWN';
  required: boolean;
  options: { id: string; text: string; imageUrl?: string; }[];
  shuffleOptionsOrder?: boolean;
  imageUrl?: string;
  points?: number;
  correctAnswers?: string[];
}

interface Section {
  id: string;
  title: string;
  description: string | null;
  order: number;
  questions: Question[];
}

interface FormData {
  id: string;
  title: string;
  description: string;
  published: boolean;
  acceptingResponses: boolean;
  shuffleQuestions?: boolean;
  collectEmail?: boolean;
  allowMultipleResponses?: boolean;
  showProgress?: boolean;
  confirmationMessage?: string;
  restrictToOrganization?: boolean;
  isQuiz?: boolean;
  showCorrectAnswers?: boolean;
  releaseGrades?: boolean;
  sections: Section[];
}

interface Answer {
  questionId: string;
  questionText: string;
  questionType: string;
  answerText: string | null;
  selectedOptions: string[];
}

interface Response {
  id: string;
  createdAt: string;
  answers: Answer[];
}

interface ResponseData {
  responses: Response[];
  count: number;
  formTitle: string;
}

export default function Form() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const formId = params.id as string;

  // All state declarations must come before any conditional logic
  const [formData, setFormData] = useState<FormData>({
    id: '',
    title: 'Untitled form',
    description: '',
    published: false,
    acceptingResponses: true,
    sections: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'questions' | 'responses' | 'settings'>('questions');
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // Section deletion confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<{id: string, index: number, questionCount: number} | null>(null);
  
  // Form deletion confirmation dialog
  const [deleteFormDialogOpen, setDeleteFormDialogOpen] = useState(false);

  // Track original form data to detect changes
  const [originalFormData, setOriginalFormData] = useState<FormData | null>(null);

  // Form settings states
  const [formSettings, setFormSettings] = useState({
    shuffleQuestions: false,
    collectEmail: false,
    allowMultipleResponses: true,
    showProgress: true,
    confirmationMessage: 'Your response has been recorded.',
    defaultRequired: false,
    // Quiz settings
    isQuiz: false,
    showCorrectAnswers: true,
    releaseGrades: true,
    // Response editing settings
    allowResponseEditing: false,
    editTimeLimit: '24h',
    // Theme settings
    themeColor: '#4285F4', // Default blue
    themeBackground: 'rgba(66, 133, 244, 0.1)' // Light blue background
  });
  
  // Track original settings for change detection
  const [originalSettings, setOriginalSettings] = useState({
    shuffleQuestions: false,
    collectEmail: false,
    allowMultipleResponses: true,
    showProgress: true,
    confirmationMessage: 'Your response has been recorded.',
    defaultRequired: false,
    // Quiz settings
    isQuiz: false,
    showCorrectAnswers: true,
    releaseGrades: true,
    // Response editing settings
    allowResponseEditing: false,
    editTimeLimit: '24h',
    // Theme settings
    themeColor: '#4285F4', // Default blue
    themeBackground: 'rgba(66, 133, 244, 0.1)' // Light blue background
  });

  // Check if settings have unsaved changes
  const hasUnsavedSettingsChanges = () => {
    return JSON.stringify(formSettings) !== JSON.stringify(originalSettings);
  };

  // Check if form has unsaved changes (including section title/description)
  const hasUnsavedChanges = () => {
    // For new forms (no original data), always allow saving if there's content
    if (!originalFormData) {
      return true; // Allow saving new forms
    }

    // Compare title and description

    if (formData.title !== originalFormData.title || 
        formData.description !== originalFormData.description) {
      return true;
    }

    // Compare sections (title, description, count)
    const currentSections = formData.sections || [];
    const originalSections = originalFormData.sections || [];

    if (currentSections.length !== originalSections.length) {
      return true;
    }

    // Compare each section's title and description
    for (let i = 0; i < currentSections.length; i++) {
      const currentSection = currentSections[i];
      const originalSection = originalSections[i];
      
      if (!originalSection) {
        return true; // New section
      }
      
      // Normalize section titles and descriptions for comparison
      const currentTitle = currentSection.title || '';
      const originalTitle = originalSection.title || '';
      const currentDesc = currentSection.description || '';
      const originalDesc = originalSection.description || '';
      
      if (currentTitle !== originalTitle || currentDesc !== originalDesc) {
        return true;
      }
    }

    const currentQuestions = getAllQuestions(formData.sections || []);
    const originalQuestions = getAllQuestions(originalFormData.sections || []);

    // Compare questions count
    if (currentQuestions.length !== originalQuestions.length) {
      return true;
    }

    // Compare each question
    for (let i = 0; i < currentQuestions.length; i++) {
      const currentQ = currentQuestions[i];
      const originalQ = originalQuestions[i];
      
      if (!originalQ) {
        return true; // New question
      }
      
      if (currentQ.text !== originalQ.text) {
        return true;
      }
      
      if ((currentQ.description || '') !== (originalQ.description || '')) {
        return true;
      }
      
      if (currentQ.type !== originalQ.type ||
          currentQ.required !== originalQ.required ||
          (currentQ.shuffleOptionsOrder || false) !== (originalQ.shuffleOptionsOrder || false) ||
          (currentQ.imageUrl || '') !== (originalQ.imageUrl || '')) {
        return true;
      }
      
      // Compare quiz fields
      if ((currentQ.points || 1) !== (originalQ.points || 1)) {
        return true;
      }
      
      // Compare correct answers
      const currentCorrectAnswers = JSON.stringify(currentQ.correctAnswers || []);
      const originalCorrectAnswers = JSON.stringify(originalQ.correctAnswers || []);
      if (currentCorrectAnswers !== originalCorrectAnswers) {
        return true;
      }
      
      // Compare options for questions that have them
      const currentOptions = currentQ.options?.filter((opt: any) => opt.text.trim() !== "") || [];
      const originalOptions = originalQ.options?.filter((opt: any) => opt.text.trim() !== "") || [];
      
      if (currentOptions.length !== originalOptions.length) {
        return true;
      }
      
      for (let j = 0; j < currentOptions.length; j++) {
        if (currentOptions[j].text !== originalOptions[j].text ||
            (currentOptions[j].imageUrl || '') !== (originalOptions[j].imageUrl || '')) {
          return true;
        }
      }
    }
    
    return false;
  };

  const isExistingForm = formId !== 'create';

  // Theme customization
  const [showCustomColorInput, setShowCustomColorInput] = useState(false);
  
  const predefinedColors = [
    { name: 'Red', value: '#db4437' },
    { name: 'Purple', value: '#673ab7' },
    { name: 'Indigo', value: '#3f51b5' },
    { name: 'Blue', value: '#4285F4' },
    { name: 'Green', value: '#4caf50' },
    { name: 'Orange', value: '#ff9800' },
    { name: 'Gray', value: '#9e9e9e' },
    { name: 'Blue Gray', value: '#607d8b' },
    { name: 'Red Orange', value: '#ff5722' },
    { name: 'Cyan', value: '#00bcd4' },
    { name: 'Teal', value: '#009688' },
    { name: 'Light Blue', value: '#03a9f4' }
  ];
  
  const getBackgroundOptions = (color: string) => {
    // Convert hex to RGB for lighter shades
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 66, g: 133, b: 244 }; // Default blue
    };
    
    const rgb = hexToRgb(color);
    
    return [
      { 
        name: 'Light', 
        value: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
        preview: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` 
      },
      { 
        name: 'Medium', 
        value: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
        preview: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` 
      },
      { 
        name: 'Dark', 
        value: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
        preview: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)` 
      },
      { 
        name: 'White', 
        value: 'white',
        preview: '#ffffff' 
      }
    ];
  };

  // Helper function to get all questions from sections (flattened)
  const getAllQuestions = (sections: Section[]): Question[] => {
    if (!sections || sections.length === 0) return [];
    return sections.flatMap(section => section.questions || []);
  };

  // Helper function to update a question in sections
  const updateQuestionInSections = (sections: Section[], questionId: string, updateFn: (question: Question) => Question): Section[] => {
    return sections.map(section => ({
      ...section,
      questions: section.questions.map(q => q.id === questionId ? updateFn(q) : q)
    }));
  };

  // Helper function to add a question to a specific section (or create section if none exist)
  const addQuestionToSections = (sections: Section[], newQuestion: Question, sectionId?: string): Section[] => {
    if (!sections || sections.length === 0) {
      // Create default section if none exist
      return [{
        id: `section_${Date.now()}`,
        title: 'Section 1',
        description: null,
        order: 0,
        questions: [newQuestion]
      }];
    }
    
    // If sectionId is provided, add to that specific section
    if (sectionId) {
      return sections.map(section => 
        section.id === sectionId 
          ? { ...section, questions: [...(section.questions || []), newQuestion] }
          : section
      );
    }
    
    // Default: Add to last section
    const updatedSections = [...sections];
    const lastSectionIndex = updatedSections.length - 1;
    updatedSections[lastSectionIndex] = {
      ...updatedSections[lastSectionIndex],
      questions: [...(updatedSections[lastSectionIndex].questions || []), newQuestion]
    };
    return updatedSections;
  };

  // Helper function to remove a question from sections
  const removeQuestionFromSections = (sections: Section[], questionId: string): Section[] => {
    return sections.map(section => ({
      ...section,
      questions: section.questions.filter(q => q.id !== questionId)
    }));
  };

  // Utility function to validate settings before saving
  const validateSettings = (settings: typeof formSettings) => {
    // Ensure response editing is disabled in quiz mode
    if (settings.isQuiz && settings.allowResponseEditing) {
      return {
        ...settings,
        allowResponseEditing: false
      };
    }
    return settings;
  };

  // ALL useEffect hooks must come before any conditional returns
  // Authentication check
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  // Auto-disable response editing when quiz mode is enabled
  useEffect(() => {
    if (formSettings.isQuiz && formSettings.allowResponseEditing) {
      setFormSettings(prev => ({
        ...prev,
        allowResponseEditing: false
      }));
    }
  }, [formSettings.isQuiz]);

  // Fetch existing form data if editing
  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        if (isExistingForm) {
          // Only fetch on initial load, not on subsequent auth state changes
          // Check if we haven't already loaded the form data
          if (!formData.id) {
            fetchFormData();
            fetchResponseCount();
          }
        } else {
          // New form - start fresh
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [isSignedIn, isLoaded]); // Removed formId from dependencies

  // Auto-refresh responses when on responses tab
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    
    // Only auto-refresh if form is published AND has responses (no need to refresh empty state)
    if (activeTab === 'responses' && isExistingForm && formData.published && responseCount > 0) {
      // Refresh responses every 10 seconds when on responses tab
      refreshInterval = setInterval(() => {
        fetchResponses();
        fetchResponseCount();
      }, 10000); // 10 seconds
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [activeTab, isExistingForm, formData.published, responseCount]);

  // Listen for navbar publish button clicks
  useEffect(() => {
    const handleNavbarPublish = async () => {
      if (loading || !formData.id || !formData.sections || formData.sections.length === 0) {
        alert('Please wait for the form to load completely before publishing');
        return;
      }

      const allQuestions = getAllQuestions(formData.sections || []);
      const validQuestions = allQuestions.filter((q: any) => q.text && q.text.trim() !== '');

      if (validQuestions.length === 0) {
        alert('Please add at least one question to publish this form');
        return;
      }

      // Check for unsaved changes and show alert without saving
      if (hasUnsavedChanges()) {
        alert('Please save your changes before publishing the form.');
        return;
      }

      // Handle publishing logic
      if (isExistingForm) {
        if (!formData.published) {
          togglePublishStatus();
        }
      } else {
        await saveForm(true); // Save and publish for new forms
      }
    };

    const handleNavbarUnpublish = () => {
      if (isExistingForm && formData.published) {
        // Check for unsaved changes before unpublishing
        if (hasUnsavedChanges()) {
          alert('Please save your changes before unpublishing the form.');
          return;
        }
        // Unpublish the form
        togglePublishStatus();
      }
    };

    const handleToggleResponses = () => {
      toggleResponseAcceptance();
    };

    const handleNavbarSave = () => {
      saveForm();
    };

    navbarEvents.subscribe('publishForm', handleNavbarPublish);
    navbarEvents.subscribe('unpublishForm', handleNavbarUnpublish);
    navbarEvents.subscribe('toggleResponses', handleToggleResponses);
    navbarEvents.subscribe('saveForm', handleNavbarSave);
    
    return () => {
      navbarEvents.unsubscribe('publishForm', handleNavbarPublish);
      navbarEvents.unsubscribe('unpublishForm', handleNavbarUnpublish);
      navbarEvents.unsubscribe('toggleResponses', handleToggleResponses);
      navbarEvents.unsubscribe('saveForm', handleNavbarSave);
    };
  }, [isExistingForm, formData.published, formData.sections, formData.id, formData.title, formData.description, loading]);

  // Update navbar whenever formData changes - with proper timing
  useEffect(() => {
    // Only update navbar after form data is fully loaded and published status is defined
    if (formData.id && isExistingForm && !loading && formData.published !== undefined) {
      const hasChanges = hasUnsavedChanges();
      navbarEvents.emit('formStatusUpdate', {
        published: formData.published,
        acceptingResponses: formData.acceptingResponses,
        formId: formData.id,
        title: formData.title,
        hasChanges: hasChanges,
        saving: saving,
        justSaved: justSaved
      });
    }
  }, [formData.published, formData.acceptingResponses, formData.id, formData.title, isExistingForm, loading, saving, justSaved, formData]);

  // Auto-save settings to database
  const settingsSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const autoSaveSettings = async (settings: typeof formSettings) => {
    // Only auto-save for existing forms
    if (!isExistingForm) return;
    
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/forms/${formId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update original settings to mark as saved
        setOriginalSettings(JSON.parse(JSON.stringify(settings)));
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      }
    } catch (error) {
      console.error('Error auto-saving settings:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  // Debounced auto-save effect for settings changes
  useEffect(() => {
    // Don't auto-save if:
    // 1. Form hasn't been created yet
    // 2. Settings haven't changed from original
    // 3. Original settings haven't been loaded yet
    if (!isExistingForm || !originalSettings || JSON.stringify(formSettings) === JSON.stringify(originalSettings)) {
      return;
    }

    // Clear any existing timeout
    if (settingsSaveTimeoutRef.current) {
      clearTimeout(settingsSaveTimeoutRef.current);
    }

    // Set new timeout for debounced save (500ms delay)
    settingsSaveTimeoutRef.current = setTimeout(() => {
      autoSaveSettings(formSettings);
    }, 500);

    // Cleanup function
    return () => {
      if (settingsSaveTimeoutRef.current) {
        clearTimeout(settingsSaveTimeoutRef.current);
      }
    };
  }, [formSettings, isExistingForm, formId]);

  // Cleanup navbar when component unmounts
  useEffect(() => {
    return () => {
      navbarEvents.emit('formStatusUpdate', {
        published: false,
        acceptingResponses: true,
        formId: '',
        title: ''
      });
    };
  }, []);

  // Effect to show/hide preview button and update save button text based on changes
  useEffect(() => {
    // Only run after component is fully mounted to avoid DOM issues
    const timeout = setTimeout(() => {
      const previewButton = document.getElementById('preview-button-edit');
      const saveButtonPublished = document.getElementById('save-button-edit-published');
      const saveButtonDraft = document.getElementById('save-button-edit-draft');
      const saveTextPublished = document.getElementById('save-text-edit-published');
      const saveTextDraft = document.getElementById('save-text-edit-draft');
      
      // Only proceed if we have the necessary data to check for changes
      if (originalFormData && originalSettings) {
        // Use the canonical hasUnsavedChanges helper for detection
        const hasChanges = hasUnsavedChanges();
        
        if (previewButton) {
          if (hasChanges) {
            previewButton.style.display = 'none';
          } else {
            previewButton.style.display = 'flex';
          }
        }
        
        // Update save button for published forms
        if (saveButtonPublished && saveTextPublished) {
          if (saving) {
            saveButtonPublished.setAttribute('disabled', 'true');
            saveTextPublished.textContent = 'Saving...';
          } else if (justSaved) {
            saveButtonPublished.setAttribute('disabled', 'true');
            saveTextPublished.textContent = 'Saved!';
          } else if (hasChanges) {
            saveButtonPublished.removeAttribute('disabled');
            saveTextPublished.textContent = 'Save Changes';
          } else {
            saveButtonPublished.setAttribute('disabled', 'true');
            saveTextPublished.textContent = 'No Changes';
          }
        }
        
        // Update save button for draft forms
        if (saveButtonDraft && saveTextDraft) {
          if (saving) {
            saveButtonDraft.setAttribute('disabled', 'true');
            saveTextDraft.textContent = 'Saving...';
          } else if (justSaved) {
            saveButtonDraft.setAttribute('disabled', 'true');
            saveTextDraft.textContent = 'Saved!';
          } else if (hasChanges) {
            saveButtonDraft.removeAttribute('disabled');
            saveTextDraft.textContent = 'Save Draft';
          } else {
            saveButtonDraft.setAttribute('disabled', 'true');
            saveTextDraft.textContent = 'No Changes';
          }
        }
      }
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [formData, formSettings, originalFormData, originalSettings, saving, justSaved]);

  // Show loading spinner while checking authentication
  if (!isLoaded) {
    return <LoadingSpinner message="Loading..." />;
  }
  
  // Show loading spinner while redirecting
  if (!isSignedIn) {
    return <LoadingSpinner message="Redirecting to sign in..." />;
  }

  // Fetch form data function
  const fetchFormData = async (shouldUpdateOriginal = true) => {
    try {
      // Add cache-busting headers to fetchFormData
      const response = await fetch(`/api/forms/${formId}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setFormData(data.form);
        
        // Only update originalFormData when initially loading the form, not after saves
        if (shouldUpdateOriginal) {
          setOriginalFormData(JSON.parse(JSON.stringify(data.form))); // Deep copy to avoid reference issues
        }
        
        // Load form settings from the fetched data
        const loadedSettings = {
          shuffleQuestions: data.form.shuffleQuestions || false,
          collectEmail: data.form.collectEmail || false,
          allowMultipleResponses: data.form.allowMultipleResponses ?? true,
          showProgress: data.form.showProgress ?? true,
          confirmationMessage: data.form.confirmationMessage || 'Your response has been recorded.',
          defaultRequired: data.form.defaultRequired || false,
          // Quiz settings
          isQuiz: data.form.isQuiz || false,
          showCorrectAnswers: data.form.showCorrectAnswers ?? true,
          releaseGrades: data.form.releaseGrades ?? true,
          // Response editing settings
          allowResponseEditing: data.form.allowResponseEditing || false,
          editTimeLimit: data.form.editTimeLimit || '24h',
          // Theme settings
          themeColor: data.form.themeColor || '#4285F4',
          themeBackground: data.form.themeBackground || 'rgba(66, 133, 244, 0.1)'
        };
        setFormSettings(loadedSettings);
        
        // Only update originalSettings when initially loading the form, not after saves
        if (shouldUpdateOriginal) {
          setOriginalSettings(loadedSettings);
        }
        
        // Update navbar with form status
        navbarEvents.emit('formStatusUpdate', {
          published: data.form.published,
          formId: data.form.id,
          title: data.form.title
        });
        
        // Return the fetched data for use after save
        return { formData: data.form, settings: loadedSettings };
      } else {
        router.push('/');
        return null;
      }
    } catch (error) {
      router.push('/');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchResponseCount = async () => {
    try {
      const response = await fetch(`/api/forms/${formId}/responses`);
      const data = await response.json();
      
      if (data.success) {
        setResponseCount(data.count);
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const fetchResponses = async () => {
    // Skip API call if form is not published and there are no responses
    // This prevents unnecessary loading states for forms that aren't live
    if (!formData.published && responseCount === 0) {
      setLoadingResponses(false);
      return;
    }

    setLoadingResponses(true);
    try {
      const response = await fetch(`/api/forms/${formId}/responses`);
      const data = await response.json();
      
      if (data.success) {
        setResponseData(data);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoadingResponses(false);
    }
  };

  

  // Form editing functions
  const updateFormTitle = (title: string) => {
    setFormData(prevData => ({ ...prevData, title }));
  };

  const updateFormDescription = (description: string) => {
    setFormData(prevData => ({ ...prevData, description }));
  };

  const updateQuestion = (questionId: string, field: string, value: any) => {
    const updatedSections = updateQuestionInSections(formData.sections || [], questionId, (question: Question) => ({
      ...question,
      [field]: value
    }));
    setFormData({ ...formData, sections: updatedSections });
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `temp_${Date.now()}`,
      text: '',
      type: 'SHORT_ANSWER',
      required: formSettings.defaultRequired,
      options: [],
      imageUrl: ''
    };
    
    const updatedSections = addQuestionToSections(formData.sections || [], newQuestion);
    setFormData({ ...formData, sections: updatedSections });
  };

  const addSectionAfter = (questionId: string) => {
    if (!formData.sections) return;

    // Find which section contains this question and the question's position
    let targetSectionIndex = -1;
    let questionIndex = -1;
    formData.sections.forEach((section, secIndex) => {
      const qIndex = section.questions.findIndex(q => q.id === questionId);
      if (qIndex !== -1) {
        targetSectionIndex = secIndex;
        questionIndex = qIndex;
      }
    });

    if (targetSectionIndex === -1 || questionIndex === -1) return;

    const targetSection = formData.sections[targetSectionIndex];
    
    // Split the questions: keep questions up to and including the clicked question,
    // move remaining questions to the new section
    const questionsToKeep = targetSection.questions.slice(0, questionIndex + 1);
    const questionsToMove = targetSection.questions.slice(questionIndex + 1);

    // Create new section with the moved questions plus a new empty question
    const newSection: Section = {
      id: `temp_section_${Date.now()}`,
      title: '', // Set title to an empty string
      description: '', // Set description to an empty string
      order: targetSectionIndex + 1,
      questions: [
        ...questionsToMove,
        // Add new empty question if no questions were moved
        ...(questionsToMove.length === 0 ? [{
          id: `temp_${Date.now()}`,
          text: '',
          type: 'SHORT_ANSWER' as const,
          required: formSettings.defaultRequired,
          options: [],
          imageUrl: ''
        }] : [])
      ]
    };

    // Update the original section to only keep questions up to the clicked question
    const updatedSections = [...formData.sections];
    updatedSections[targetSectionIndex] = {
      ...updatedSections[targetSectionIndex],
      questions: questionsToKeep
    };

    // Insert the new section after the target section
    updatedSections.splice(targetSectionIndex + 1, 0, newSection);

    // Update order values for sections after the insertion point
    updatedSections.forEach((section, index) => {
      section.order = index;
    });

    setFormData({ ...formData, sections: updatedSections });
  };

  const deleteSection = (sectionId: string) => {
    if (!formData.sections || formData.sections.length <= 1) {
      // Don't allow deleting the last section
      alert('Cannot delete the last section. A form must have at least one section.');
      return;
    }

    // Find the section to delete and its index
    const sectionIndex = formData.sections.findIndex(section => section.id === sectionId);
    const sectionToDelete = formData.sections[sectionIndex];
    if (!sectionToDelete) return;

    // Get all questions from the section that will be deleted
    const questionsToMove = sectionToDelete.questions || [];
    
    // If section has questions, show confirmation dialog
    if (questionsToMove.length > 0) {
      setSectionToDelete({
        id: sectionId,
        index: sectionIndex,
        questionCount: questionsToMove.length
      });
      setShowDeleteDialog(true);
    } else {
      // If no questions in section, delete directly
      deleteSectionDirectly(sectionId);
    }
  };

  const handleMergeSection = () => {
    if (sectionToDelete) {
      mergeWithPreviousSection(sectionToDelete.id);
      setShowDeleteDialog(false);
      setSectionToDelete(null);
    }
  };

  const handleDeleteEntireSection = () => {
    if (sectionToDelete) {
      deleteSectionDirectly(sectionToDelete.id);
      setShowDeleteDialog(false);
      setSectionToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setSectionToDelete(null);
  };

  const mergeWithPreviousSection = (sectionId: string) => {
    if (!formData.sections) return;

    const sectionIndex = formData.sections.findIndex(section => section.id === sectionId);
    const sectionToDelete = formData.sections[sectionIndex];
    if (!sectionToDelete) return;

    const questionsToMove = sectionToDelete.questions || [];
    
    // Remove the section
    let updatedSections = formData.sections.filter(section => section.id !== sectionId);
    
    // Add questions to the previous section (or first section if deleting the first one)
    if (questionsToMove.length > 0 && updatedSections.length > 0) {
      const targetSectionIndex = sectionIndex > 0 ? sectionIndex - 1 : 0;
      updatedSections[targetSectionIndex] = {
        ...updatedSections[targetSectionIndex],
        questions: [...(updatedSections[targetSectionIndex].questions || []), ...questionsToMove]
      };
    }

    // Update order values
    updatedSections.forEach((section, index) => {
      section.order = index;
    });

    setFormData({ ...formData, sections: updatedSections });
    // Changes will be saved when user clicks "Save Changes"
  };

  const deleteSectionDirectly = (sectionId: string) => {
    if (!formData.sections) return;
    
    // Prevent deleting the last section
    if (formData.sections.length <= 1) {
      alert('Cannot delete the last section. A form must have at least one section.');
      return;
    }
    
    // Remove the section from local state
    const updatedSections = formData.sections.filter(section => section.id !== sectionId);
    
    // Update order values
    updatedSections.forEach((section, index) => {
      section.order = index;
    });

    setFormData({ ...formData, sections: updatedSections });
    // Changes will be saved when user clicks "Save Changes"
  };

  const deleteQuestion = (questionId: string) => {
    const updatedSections = removeQuestionFromSections(formData.sections || [], questionId);
    setFormData({ ...formData, sections: updatedSections });
  };

  const duplicateQuestion = (questionId: string) => {
    const updatedSections = formData.sections.map((section) => {
      // Check if the section contains the question to duplicate
      const questionIndex = section.questions.findIndex((q) => q.id === questionId);
      if (questionIndex === -1) {
        return section; // No changes for sections that don't contain the question
      }

      // Duplicate the question
      const questionToDuplicate = section.questions[questionIndex];
      const duplicatedQuestion = {
        ...questionToDuplicate,
        id: `temp_${Date.now()}`,
        options: questionToDuplicate.options.map((opt: any) => ({
          ...opt,
          id: `temp_${Date.now()}_${Math.random()}`
        }))
      };

      // Insert the duplicated question right after the original
      const updatedQuestions = [
        ...section.questions.slice(0, questionIndex + 1),
        duplicatedQuestion,
        ...section.questions.slice(questionIndex + 1)
      ];

      return {
        ...section,
        questions: updatedQuestions
      };
    });

    setFormData({ ...formData, sections: updatedSections });
  };

  const addOption = (questionId: string) => {
    const updatedSections = updateQuestionInSections(formData.sections || [], questionId, (question: Question) => ({
      ...question,
      options: [...question.options, { id: `temp_${Date.now()}`, text: '' }]
    }));
    setFormData({ ...formData, sections: updatedSections });
  };

  const removeOption = (questionId: string, optionId: string) => {
    const updatedSections = updateQuestionInSections(formData.sections || [], questionId, (question: Question) => ({
      ...question,
      options: question.options.filter((opt: any) => opt.id !== optionId)
    }));
    setFormData({ ...formData, sections: updatedSections });
  };

  const saveForm = async (forcePublished?: boolean) => {
    // Prevent duplicate save calls
    if (saving) {
      return;
    }
    
    if (!formData.title.trim()) {
      alert('Form title cannot be empty');
      return;
    }

    // Validate sections
    if (formData.sections && formData.sections.length > 0) {
      // Check for empty section titles
      const sectionsWithEmptyTitle = formData.sections.filter(section => 
        !section.title || section.title.trim() === ''
      );
      
      if (sectionsWithEmptyTitle.length > 0) {
        alert('All sections must have a title. Please add titles to all sections before saving.');
        return;
      }

      // Check for sections without questions
      const sectionsWithoutQuestions = formData.sections.filter(section => 
        !section.questions || section.questions.length === 0
      );
      
      if (sectionsWithoutQuestions.length > 0) {
        const sectionNames = sectionsWithoutQuestions.map((section, index) => 
          section.title || `Section ${index + 1}`
        ).join(', ');
        alert(`The following sections need at least one question: ${sectionNames}`);
        return;
      }

      // Check for sections with only empty questions
      const sectionsWithOnlyEmptyQuestions = formData.sections.filter(section => 
        section.questions && section.questions.length > 0 && 
        section.questions.every(q => !q.text || q.text.trim() === '')
      );
      
      if (sectionsWithOnlyEmptyQuestions.length > 0) {
        const sectionNames = sectionsWithOnlyEmptyQuestions.map((section, index) => 
          section.title || `Section ${index + 1}`
        ).join(', ');
        alert(`The following sections have questions with no text: ${sectionNames}. Please add text to at least one question in each section.`);
        return;
      }
    }

    setSaving(true);
    setJustSaved(false);
    try {
      // For existing forms, preserve current published status unless explicitly specified
      // For new forms, use the forcePublished parameter or default to false
      const publishedStatus = isExistingForm 
        ? (forcePublished !== undefined ? forcePublished : formData.published)
        : (forcePublished !== undefined ? forcePublished : false);
      
      // Create payload with correct published status and proper data structure
      const allQuestions = getAllQuestions(formData.sections || []);
      
      // Process sections to filter out temporary IDs and structure data properly
      const processedSections = (formData.sections || []).map(section => ({
        id: section.id && !section.id.startsWith('temp_') ? section.id : undefined, // Remove temp IDs
        title: section.title || 'Untitled Section',
        description: section.description || null,
        order: section.order,
        questions: (section.questions || []).map((q: any) => ({
          id: q.id && !q.id.startsWith('temp_') ? q.id : undefined, // Remove temp IDs
          text: q.text,
          description: q.description,
          type: q.type,
          required: q.required,
          options: (q.options || []).map((opt: any) => ({
            id: opt.id && !opt.id.startsWith('temp_') ? opt.id : undefined, // Remove temp IDs
            text: opt.text,
            imageUrl: opt.imageUrl || null
          })),
          shuffleOptionsOrder: q.shuffleOptionsOrder || false,
          imageUrl: q.imageUrl || null,
          // Quiz fields
          points: q.points || 1,
          correctAnswers: q.correctAnswers || []
        }))
      }));
      
      const payload = {
        title: formData.title,
        description: formData.description,
        published: publishedStatus,
        sections: processedSections,
        // Legacy support - also include flattened questions
        questions: allQuestions.map((q: any) => ({
          id: q.id && !q.id.startsWith('temp_') ? q.id : undefined, // Remove temp IDs
          question: q.text, // API expects 'question' field
          text: q.text, // Also send as 'text' for compatibility
          description: q.description, // Add description to the payload
          type: q.type,
          required: q.required,
          options: (q.options || []).map((opt: any) => ({
            id: opt.id && !opt.id.startsWith('temp_') ? opt.id : undefined, // Remove temp IDs
            text: opt.text,
            imageUrl: opt.imageUrl || null
          })),
          shuffleOptionsOrder: q.shuffleOptionsOrder || false,
          imageUrl: q.imageUrl, // Add image URL to the payload
          // Quiz fields
          points: q.points || 1,
          correctAnswers: q.correctAnswers || []
        })),
        settings: validateSettings(formSettings)
      };
      
      const url = isExistingForm ? `/api/forms/update/${formId}` : '/api/forms/create';
      const method = isExistingForm ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ API ERROR - Status:', response.status);
        console.error('❌ API ERROR - Data:', data);
        console.error('❌ API ERROR - Details:', data.details);
        console.error('❌ API ERROR - Error:', data.error);
      }
      
      if (data.success) {
        // After successful save, refetch the form data to get the latest state from database
        const fetchedData = await fetchFormData(false);

        // Immediately set originalFormData and originalSettings from the fresh fetched data
        if (fetchedData) {
          setOriginalFormData(JSON.parse(JSON.stringify(fetchedData.formData)));
          setOriginalSettings(JSON.parse(JSON.stringify(fetchedData.settings)));
        }

        // Show saved state briefly
        setJustSaved(true);
        setTimeout(() => {
          setJustSaved(false);
        }, 2000);

        // Update navbar with new status - clear hasChanges immediately
        navbarEvents.emit('formStatusUpdate', {
          published: publishedStatus,
          formId: formData.id || data.form?.id,
          title: formData.title,
          hasChanges: false,
          saving: false,
          justSaved: false
        });

        // Show appropriate message based on what happened
        let message;
        if (isExistingForm) {
          if (formData.published && publishedStatus) {
            message = 'Changes saved!';
          } else if (!formData.published && publishedStatus) {
            message = 'Form published successfully!';
          } else if (formData.published && !publishedStatus) {
            message = 'Form unpublished and saved as draft!';
          } else {
            message = 'Form saved as draft!';
          }
        } else {
          message = publishedStatus ? 'Form published successfully!' : 'Form saved as draft!';
        }
        
        // For new forms, redirect to edit page for drafts, home for published
        if (!isExistingForm) {
          if (publishedStatus) {
            router.push('/'); // Redirect to home for published forms
          } else {
            // For draft saves, redirect to the edit page of the newly created form
            const newFormId = data.form?.id || data.formId;
            if (newFormId) {
              window.location.href = `/forms/${newFormId}`;
            }
          }
        }
      } else {
        console.error('Save form failed:', data);
        alert(data.message || 'Failed to save form');
      }
    } catch (error) {
      console.error('Save form error:', error);
      alert('Failed to save form. Please try again.');
    } finally {
      setSaving(false);
    }
  };



  const togglePublishStatus = async () => {
    if (!isExistingForm) {
      return;
    }

    setPublishing(true);
    try {
      const newPublishedStatus = !formData.published;
      
      const response = await fetch(`/api/forms/${formId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ published: newPublishedStatus }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setFormData(prev => ({ ...prev, published: newPublishedStatus }));
        // Update navbar with new status
        navbarEvents.emit('formStatusUpdate', {
          published: newPublishedStatus,
          acceptingResponses: formData.acceptingResponses,
          formId: formData.id || formId, // Use formId from URL if formData.id is empty
          title: formData.title
        });
        const message = newPublishedStatus ? 'Form published!' : 'Form unpublished (draft)';
      } else {
        console.error('togglePublishStatus - API error:', data);
        // Show the API error message to the user
        alert(data.error || 'Failed to update form status');
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
    } finally {
      setPublishing(false);
    }
  };

  const toggleResponseAcceptance = async () => {
    if (!formData.published) {
      return;
    }

    setPublishing(true);
    try {
      const newAcceptingStatus = !formData.acceptingResponses;
      
      const response = await fetch(`/api/forms/${formId}/toggle-responses`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acceptingResponses: newAcceptingStatus }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setFormData(prev => ({ ...prev, acceptingResponses: newAcceptingStatus }));
        // Update navbar with new status
        navbarEvents.emit('formStatusUpdate', {
          published: formData.published,
          acceptingResponses: newAcceptingStatus,
          formId: formData.id || formId,
          title: formData.title
        });
        const message = newAcceptingStatus ? 'Now accepting responses!' : 'Stopped accepting responses';
      } else {
        console.error('toggleResponseAcceptance - API error:', data);
      }
    } catch (error) {
      console.error('Error toggling response acceptance:', error);
    } finally {
      setPublishing(false);
    }
  };

  // Delete form function
  const handleDeleteForm = () => {
    if (!formId || formId === 'create') return;
    setDeleteFormDialogOpen(true);
  };

  const confirmDeleteForm = async () => {
    if (!formId || formId === 'create') return;
    
    try {
      const response = await fetch(`/api/forms/delete/${formId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Redirect to homepage after successful deletion
        router.push('/');
      } else {
        alert('Failed to delete form. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('An error occurred while deleting the form.');
    } finally {
      setDeleteFormDialogOpen(false);
    }
  };

  // Response functions
  const handleTabChange = (tab: 'questions' | 'responses' | 'settings') => {
    setActiveTab(tab);
    if (tab === 'responses') {
      // Only fetch responses if form is published OR if responses already exist in DB
      // This prevents unnecessary API calls for unpublished forms with zero responses
      if (formData.published || responseCount > 0) {
        fetchResponses();
        fetchResponseCount(); // Also update the response count
      } else {
        // Form is not published and has no responses - show "no responses" immediately
        setLoadingResponses(false);
      }
    }
  };

  const toggleResponseExpansion = (responseId: string) => {
    setExpandedResponse(expandedResponse === responseId ? null : responseId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderAnswer = (answer: Answer) => {
    if (answer.selectedOptions && answer.selectedOptions.length > 0) {
      return answer.selectedOptions.join(', ');
    }
    
    if (answer.answerText && answer.answerText.trim() !== '') {
      return answer.answerText;
    }
    
    return 'No answer provided';
  };

  // Show loading while auth is checking
  if (!isLoaded || loading) {
    return <LoadingSpinner message="Loading form..." />;
  }

  // Show sign in message only after auth is fully loaded
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to edit forms.</p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen" 
      style={{ 
        backgroundColor: formSettings.themeBackground.includes('rgba') || formSettings.themeBackground === 'white' ? formSettings.themeBackground : '#f3f4f6',
        overscrollBehavior: 'none'
      }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        
        {/* Google Forms Style Tab Navigation */}
        <div className="bg-white rounded-lg border border-gray-200 mb-4 sm:mb-6 shadow-sm overflow-x-auto">
          <div className="flex justify-between items-center min-w-max sm:min-w-0">
            <div className="flex">
              <button
                onClick={() => handleTabChange('questions')}
                className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'questions'
                    ? 'text-current'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === 'questions' ? { color: formSettings.themeColor } : {}}
              >
                Questions
              </button>
              <button
                onClick={() => handleTabChange('responses')}
                className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  activeTab === 'responses'
                    ? 'text-current'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === 'responses' ? { color: formSettings.themeColor } : {}}
              >
                Responses {responseCount > 0 && <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium">{responseCount}</span>}
              </button>
              <button
                onClick={() => handleTabChange('settings')}
                className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'text-current'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === 'settings' ? { color: formSettings.themeColor } : {}}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Total Points Display */}
              {formSettings.isQuiz && getAllQuestions(formData.sections || []).length > 0 && (
                <div className="text-xs sm:text-sm text-gray-600 px-3 sm:px-4 lg:px-6 whitespace-nowrap">
                  Total points: {getAllQuestions(formData.sections || []).reduce((total: number, q: any) => total + (q.points || 1), 0)}
                </div>
              )}
              
              {/* Delete Form Button */}
              {isExistingForm && (
                <button
                  onClick={handleDeleteForm}
                  className="px-3 sm:px-4 py-2 mr-2 text-xs sm:text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  title="Delete Form"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="hidden sm:inline">Delete Form</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'questions' && (
          <>
            {/* Form Status Indicator */}
            {isExistingForm && (
              <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center space-x-2">
                  <div className={`inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                    formData.published 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      formData.published ? 'bg-green-400' : 'bg-gray-400'
                    }`}></div>
                    {formData.published ? 'Published' : 'Draft'}
                  </div>
                  {formData.published && (
                    <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                      <span className="hidden sm:inline">Public link:</span>
                      <a
                        href={typeof window !== 'undefined' ? `${window.location.origin}/forms/${formId}/view` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 hover:underline font-mono text-xs truncate max-w-[120px] sm:max-w-none cursor-pointer transition-colors"
                        title="Click to open form"
                      >
                        {typeof window !== 'undefined' ? `${window.location.origin}/forms/${formId}/view` : ''}
                      </a>
                      <button 
                        onClick={() => {
                          const url = `${window.location.origin}/forms/${formId}/view`;
                          navigator.clipboard.writeText(url);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className={`p-1 sm:p-1.5 rounded-md transition-all duration-200 flex items-center ${
                          linkCopied 
                            ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                            : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                        }`}
                        title={linkCopied ? 'Copied!' : 'Copy link'}
                      >
                        {linkCopied ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Form Header Card */}
            <div className="bg-white rounded-lg mb-4 sm:mb-6">
              <div className="h-2 sm:h-3 rounded-t-lg" style={{ backgroundColor: formSettings.themeColor }}></div>
              <div className="p-4 sm:p-6 lg:p-8">
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => updateFormTitle(e.target.value)}
                  placeholder="Untitled form"
                  className="w-full text-xl sm:text-2xl lg:text-3xl font-normal text-gray-900 bg-white border-none outline-none focus:bg-gray-50 rounded px-2 py-1 -mx-2 transition-colors"
                  style={{ minHeight: '40px' }}
                />
                
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => updateFormDescription(e.target.value)}
                  placeholder="Form description"
                  className="w-full mt-3 sm:mt-4 text-sm sm:text-base text-gray-600 bg-white border-none outline-none focus:bg-gray-50 rounded px-2 py-1 -mx-2 resize-none transition-colors"
                  style={{ minHeight: '45px' }}
                  rows={2}
                />
              </div>
            </div>

            {/* Questions Section - Section-wise Display */}
            <div className="space-y-4 sm:space-y-6">
              {formData.sections && formData.sections.length > 0 ? (
                formData.sections.map((section, sectionIndex) => (
                  <div key={section.id} className="space-y-0">
                    {/* Section Header with Lines */}
                    {formData.sections.length > 1 && (
                      <div className="mb-4 sm:mb-6">
                        {/* Section Number and Delete Button */}
                        <div className="mb-2 sm:mb-3 flex items-center justify-between">
                          <span 
                            className="text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1 rounded-full"
                            style={{ 
                              color: formSettings.themeColor, 
                              backgroundColor: `${formSettings.themeColor}15` 
                            }}
                          >
                            Section {sectionIndex + 1}
                          </span>
                          {formData.sections.length > 1 && (
                            <button
                              onClick={() => deleteSection(section.id)}
                              className="p-1.5 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                              title="Delete Section"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        
                        {/* Section Container - White background like form header */}
                        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                          {/* Section Title */}
                          <div className="mb-3 sm:mb-4">
                            <input
                              type="text"
                              value={section.title}
                              onChange={(e) => {
                                const updatedSections = formData.sections.map((sec, idx) => 
                                  idx === sectionIndex 
                                    ? { ...sec, title: e.target.value }
                                    : sec
                                );
                                setFormData({ ...formData, sections: updatedSections });
                              }}
                              placeholder={`Section ${sectionIndex + 1} Title`}
                              className="w-full text-base sm:text-lg font-medium text-gray-900 bg-white border-none outline-none focus:bg-gray-50 rounded px-2 sm:px-3 py-1 transition-colors placeholder-gray-400"
                            />
                          </div>
                          
                          {/* Section Description */}
                          <div className="mb-0">
                            <textarea
                              value={section.description || ''}
                              onChange={(e) => {
                                const updatedSections = formData.sections.map((sec, idx) => 
                                  idx === sectionIndex 
                                    ? { ...sec, description: e.target.value || null }
                                    : sec
                                );
                                setFormData({ ...formData, sections: updatedSections });
                              }}
                              placeholder="Section description (optional)"
                              className="w-full text-xs sm:text-sm text-gray-600 bg-white border-none outline-none focus:bg-gray-50 rounded px-2 sm:px-3 py-1.5 sm:py-2 transition-colors resize-none placeholder-gray-400"
                              rows={2}
                              style={{ minHeight: '24px' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Questions in this Section */}
                    {section.questions.map((question: any) => (
                      <QuestionCard
                        key={question.id}
                        id={question.id}
                        initialQuestion={question.text}
                        initialDescription={question.description || ""}
                        initialType={question.type}
                        initialRequired={question.required}
                        initialOptions={question.options || []}
                        initialShuffleOptionsOrder={question.shuffleOptionsOrder || false}
                        initialImageUrl={question.imageUrl || ""}
                        // Quiz props
                        isQuiz={formSettings.isQuiz}
                        initialPoints={question.points || 1}
                        initialCorrectAnswers={question.correctAnswers || []}
                        // Theme prop
                        themeColor={formSettings.themeColor}
                        onDelete={() => deleteQuestion(question.id)}
                        onDuplicate={() => duplicateQuestion(question.id)}
                        onAddSectionAfter={() => addSectionAfter(question.id)}
                        onUpdate={(data) => {
                          // Update the question with new data - sections aware
                          const updatedSections = formData.sections.map(sec => ({
                            ...sec,
                            questions: sec.questions.map((q: any) =>
                              q.id === question.id
                                ? {
                                    ...q,
                                    text: data.question,
                                    description: data.description,
                                    type: data.type,
                                    required: data.required,
                                    shuffleOptionsOrder: data.shuffleOptionsOrder,
                                    imageUrl: data.imageUrl,
                                    options: data.options.map((opt: any, idx: number) => ({
                                      id: question.options[idx]?.id || `temp_${Date.now()}_${idx}`,
                                      text: opt.text,
                                      imageUrl: opt.imageUrl
                                    })),
                                    // Quiz fields
                                    points: data.points,
                                    correctAnswers: data.correctAnswers
                                  }
                                : q
                            )
                          }));
                          
                          setFormData({ ...formData, sections: updatedSections });
                        }}
                      />
                    ))}
                    
                    {/* Add Question Button for this Section */}
                    <div className="mt-3 sm:mt-4 mb-4 sm:mb-6">
                      <button 
                        onClick={() => {
                          const newQuestion = {
                            id: `temp_${Date.now()}`,
                            text: '',
                            type: 'SHORT_ANSWER' as const,
                            required: formSettings.defaultRequired,
                            options: [],
                            imageUrl: ''
                          };
                          
                          const updatedSections = [...formData.sections];
                          const targetSectionIndex = formData.sections.findIndex(s => s.id === section.id);
                          
                          if (targetSectionIndex !== -1) {
                            updatedSections[targetSectionIndex].questions.push(newQuestion);
                            setFormData({ ...formData, sections: updatedSections });
                          }
                        }}
                        className="inline-flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md bg-white text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                        style={{ 
                          color: formSettings.themeColor
                        }}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>
                          {formData.sections.length > 1 
                            ? `Add Question to Section ${sectionIndex + 1}` 
                            : 'Add Question'
                          }
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-gray-500">
                  No questions yet. Add your first question below.
                </div>
              )}

              {/* Default Add Question Button for empty forms */}
              {(!formData.sections || formData.sections.length === 0) && (
                <div className="mb-4 sm:mb-6">
                  <button 
                    onClick={addQuestion}
                    className="inline-flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md bg-white text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors"
                    style={{ 
                      color: formSettings.themeColor
                    }}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add Question</span>
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <Link href="/" className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md shadow-sm bg-white text-xs sm:text-sm font-medium hover:bg-gray-50 transition-colors" style={{ color: formSettings.themeColor }}>
                ← Back to Home
              </Link>
            </div>
          </>
        )}

        {/* Responses Tab Content */}
        {activeTab === 'responses' && (
          <div>
            {/* Response Stats */}
            <div className="bg-white rounded-lg border border-gray-200 mb-4 sm:mb-6 p-4 sm:p-6">
              <div className="flex flex-col gap-4">
                {/* Top Row: Accepting Responses Toggle */}
                {formData.published && (
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <span className="text-xs sm:text-sm text-gray-600">Accepting responses:</span>
                    <button
                      onClick={toggleResponseAcceptance}
                      disabled={saving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        formData.acceptingResponses ? 'bg-green-600' : 'bg-gray-300'
                      } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.acceptingResponses ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-xs sm:text-sm font-medium ${
                      formData.acceptingResponses ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {formData.acceptingResponses ? 'On' : 'Off'}
                    </span>
                  </div>
                )}
                
                {/* Bottom Row: Total Responses and Menu */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="text-2xl sm:text-3xl font-bold text-blue-600">{responseCount}</div>
                      {loadingResponses && (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent flex-shrink-0"></div>
                      )}
                    </div>
                    <div className="text-sm sm:text-base lg:text-lg font-medium text-gray-700 truncate">
                      Response{responseCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  
                  {/* 3-dot menu for delete all responses */}
                  {responseCount > 0 && (
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === 'responses-menu' ? null : 'responses-menu');
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z" />
                        </svg>
                      </button>
                      
                      {/* Dropdown Menu */}
                      {openMenuId === 'responses-menu' && (
                        <div className="absolute right-0 top-full mt-2 w-48 sm:w-52 bg-white rounded-md shadow-lg border border-gray-200 z-20">
                          <div className="py-1">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                
                                if (confirm(`Are you sure you want to delete all ${responseCount} responses? This action cannot be undone.`)) {
                                  try {
                                    const response = await fetch(`/api/forms/${formId}/responses`, {
                                      method: 'DELETE'
                                    });
                                    
                                    if (response.ok) {
                                      // Update UI
                                      setResponseCount(0);
                                      setResponseData(null);
                                      // Refresh the responses data
                                      fetchResponses();
                                      fetchResponseCount();
                                    } else {
                                      alert('Failed to delete responses');
                                    }
                                  } catch (error) {
                                    console.error('Error deleting responses:', error);
                                    alert('Failed to delete responses');
                                  }
                                }
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete all responses</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Responses List */}
            {loadingResponses && formData.published && responseCount > 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
                <LoadingSpinner message="Loading responses..." size="md" fullScreen={false} />
              </div>
            ) : responseCount === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">📝</div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No responses yet</h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Share your form to start collecting responses from users.</p>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="text-xs sm:text-sm text-gray-500">Share your form:</div>
                    <div className="bg-gray-50 p-2 sm:p-3 rounded-md text-xs sm:text-sm font-mono text-gray-800 border break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}/forms/${formId}/view` : ''}
                    </div>
                    <button 
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/forms/${formId}/view`);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }
                      }}
                      className={`text-sm font-medium transition-all duration-200 ${
                        linkCopied 
                          ? 'text-green-600 hover:text-green-700' 
                          : 'text-blue-600 hover:text-blue-800'
                      }`}
                    >
                      {linkCopied ? '✅ Copied!' : '📋 Copy Link'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              responseData && (
                <div className="space-y-3 sm:space-y-4">
                  {responseData.responses.map((response, index) => (
                    <div key={response.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      
                      {/* Response Header */}
                      <div 
                        className="p-3 sm:p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between gap-3"
                        onClick={() => toggleResponseExpansion(response.id)}
                      >
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                          <div className="flex-shrink-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs sm:text-sm font-medium text-blue-600">#{index + 1}</span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">Response #{index + 1}</div>
                            <div className="text-xs sm:text-sm text-gray-500 truncate">{formatDate(response.createdAt)}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
                          <span className="text-xs sm:text-sm text-gray-500">{response.answers.length} answer{response.answers.length === 1 ? '' : 's'}</span>
                          <svg
                            className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform ${
                              expandedResponse === response.id ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Response Details */}
                      {expandedResponse === response.id && (
                        <div className="border-t border-gray-200 p-3 sm:p-4 bg-gray-50">
                          <div className="space-y-3 sm:space-y-4">
                            {response.answers.map((answer, answerIndex) => (
                              <div key={answerIndex} className="bg-white p-3 sm:p-4 rounded-md border border-gray-200">
                                <div 
                                  className="text-xs sm:text-sm font-medium text-gray-900 mb-2 [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
                                  dangerouslySetInnerHTML={{ __html: answer.questionText }}
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.tagName === 'A') {
                                      e.preventDefault();
                                      window.open((target as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                />
                                <div className="text-xs sm:text-sm text-gray-700 bg-gray-50 p-2 sm:p-3 rounded border break-words">
                                  {renderAnswer(answer)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="space-y-4 sm:space-y-6">
            
            {/* New Form Notice */}
            {!isExistingForm && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm sm:text-base text-yellow-800 font-medium">New Form</span>
                </div>
                <p className="text-xs sm:text-sm text-yellow-700 mt-2">
                  Please save your form first before configuring settings. Settings will be available after the form is created.
                </p>
              </div>
            )}

            {/* Form Settings */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">Form Settings</h3>
                
                {/* Auto-save indicator */}
                {isExistingForm && (
                  <div className="flex items-center space-x-2 text-xs sm:text-sm">
                    {savingSettings && (
                      <span className="text-gray-500 flex items-center space-x-1.5">
                        <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving...</span>
                      </span>
                    )}
                    {settingsSaved && !savingSettings && (
                      <span className="text-green-600 flex items-center space-x-1.5">
                        <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Saved</span>
                      </span>
                    )}
                    {!savingSettings && !settingsSaved && (
                      <span className="text-gray-400 text-xs">
                        Changes auto-save
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4 sm:space-y-6">
                
                {/* Theme Customization */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                    Theme Customization
                  </h4>
                  
                  {/* Color Selection */}
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3 block">Choose Color</label>
                      <div className="grid grid-cols-6 sm:grid-cols-6 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                        {predefinedColors.map((color) => (
                          <div key={color.value} className="relative group">
                            <button
                              onClick={() => {
                                const newColor = color.value;
                                setFormSettings(prev => {
                                  const hexToRgb = (hex: string) => {
                                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                                    return result ? {
                                      r: parseInt(result[1], 16),
                                      g: parseInt(result[2], 16),
                                      b: parseInt(result[3], 16)
                                    } : { r: 66, g: 133, b: 244 };
                                  };
                                  const rgb = hexToRgb(newColor);
                                  
                                  return {
                                    ...prev, 
                                    themeColor: newColor,
                                    // Always auto-update background to light version of new color
                                    themeBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
                                  };
                                });
                              }}
                              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all hover:scale-105 ${
                                formSettings.themeColor === color.value
                                  ? 'border-gray-800 ring-2 ring-gray-300'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                            
                            {/* Hover Tooltip */}
                            <div 
                              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 sm:mb-2 px-2 sm:px-3 py-1.5 sm:py-2 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10"
                              style={{ backgroundColor: color.value }}
                            >
                              <div className="font-medium">{color.name}</div>
                              <div className="text-gray-200">{color.value}</div>
                              {/* Tooltip Arrow - Perfectly Centered */}
                              <div 
                                className="absolute top-full left-1/2 border-[3px] sm:border-4 border-transparent"
                                style={{ 
                                  borderTopColor: color.value,
                                  transform: 'translateX(-50%)',
                                  marginLeft: '0px'
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Custom Color Option */}
                        <button
                          onClick={() => setShowCustomColorInput(!showCustomColorInput)}
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed border-gray-400 transition-all hover:border-gray-500 flex items-center justify-center text-gray-500 hover:text-gray-600 ${
                            showCustomColorInput ? 'bg-gray-100' : 'bg-white'
                          }`}
                          title="Custom Color"
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Custom Color Input */}
                      {showCustomColorInput && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mt-2 sm:mt-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <input
                            type="color"
                            value={formSettings.themeColor}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              setFormSettings(prev => {
                                const hexToRgb = (hex: string) => {
                                  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                                  return result ? {
                                    r: parseInt(result[1], 16),
                                    g: parseInt(result[2], 16),
                                    b: parseInt(result[3], 16)
                                  } : { r: 66, g: 133, b: 244 };
                                };
                                const rgb = hexToRgb(newColor);
                                
                                return {
                                  ...prev,
                                  themeColor: newColor,
                                  themeBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
                                };
                              });
                            }}
                            className="w-full sm:w-10 h-10 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={formSettings.themeColor}
                            onChange={(e) => {
                              const newColor = e.target.value;
                              if (/^#[0-9A-F]{6}$/i.test(newColor)) {
                                setFormSettings(prev => {
                                  const hexToRgb = (hex: string) => {
                                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                                    return result ? {
                                      r: parseInt(result[1], 16),
                                      g: parseInt(result[2], 16),
                                      b: parseInt(result[3], 16)
                                    } : { r: 66, g: 133, b: 244 };
                                  };
                                  const rgb = hexToRgb(newColor);
                                  
                                  return {
                                    ...prev,
                                    themeColor: newColor,
                                    themeBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
                                  };
                                });
                              } else {
                                // For incomplete hex codes, just update color without background
                                setFormSettings(prev => ({ ...prev, themeColor: newColor }));
                              }
                            }}
                            className="flex-1 px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm font-mono"
                            placeholder="#000000"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Background Selection */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-3 block">Choose Background</label>
                      <div className="grid grid-cols-4 gap-3">
                        {getBackgroundOptions(formSettings.themeColor).map((bg) => (
                          <div key={bg.name} className="relative group">
                            <button
                              onClick={() => setFormSettings(prev => ({ ...prev, themeBackground: bg.value }))}
                              className={`w-full p-4 rounded-lg border-2 transition-all hover:scale-105 relative ${
                                formSettings.themeBackground === bg.value
                                  ? 'border-gray-800 ring-2 ring-gray-300'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}
                              style={{ backgroundColor: bg.preview }}
                            >
                              <div className="text-xs font-medium text-gray-700 text-center mb-2">
                                {bg.name}
                              </div>
                              <div className="flex justify-center">
                                <div 
                                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm" 
                                  style={{ backgroundColor: formSettings.themeColor }}
                                ></div>
                              </div>
                            </button>
                            
                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              <div className="font-medium">{bg.name}</div>
                              <div className="text-gray-300">{bg.value}</div>
                              {/* Tooltip Arrow */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Question Settings */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                    Question Settings
                  </h4>
                  
                  {/* Shuffle Questions */}
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">Randomize Question Order</label>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                        Questions will appear in random order for each respondent. This helps reduce response bias and ensures fair distribution of attention across all questions.
                      </p>
                    </div>
                    <button
                      onClick={() => setFormSettings(prev => ({ ...prev, shuffleQuestions: !prev.shuffleQuestions }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formSettings.shuffleQuestions ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formSettings.shuffleQuestions ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show Progress */}
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">Show Progress Bar</label>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                        Display progress indicator to respondents
                      </p>
                    </div>
                    <button
                      onClick={() => setFormSettings(prev => ({ ...prev, showProgress: !prev.showProgress }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formSettings.showProgress ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formSettings.showProgress ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Make Questions Required by Default */}
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">Make Questions Required by Default</label>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                        New questions will be marked as required automatically. You can still make individual questions optional later.
                      </p>
                    </div>
                    <button
                      onClick={() => setFormSettings(prev => ({ ...prev, defaultRequired: !prev.defaultRequired }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formSettings.defaultRequired ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formSettings.defaultRequired ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Response Settings */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                    Response Settings
                  </h4>
                  
                  {/* Collect Email */}
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">Collect Email Addresses</label>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                        Require respondents to provide their email address
                      </p>
                    </div>
                    <button
                      onClick={() => setFormSettings(prev => ({ ...prev, collectEmail: !prev.collectEmail }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formSettings.collectEmail ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formSettings.collectEmail ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Multiple Responses */}
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">Allow Multiple Responses</label>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                        Users can submit multiple responses to this form
                      </p>
                    </div>
                    <button
                      onClick={() => setFormSettings(prev => ({ ...prev, allowMultipleResponses: !prev.allowMultipleResponses }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formSettings.allowMultipleResponses ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formSettings.allowMultipleResponses ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Response Editing - Only show if NOT a quiz */}
                  {!formSettings.isQuiz && (
                    <>
                      {/* Allow response editing toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700">Allow response editing</label>
                          <p className="text-sm text-gray-500 mt-1">
                            Let users modify their responses after submission
                          </p>
                        </div>
                        <button
                          onClick={() => setFormSettings(prev => ({ ...prev, allowResponseEditing: !prev.allowResponseEditing }))}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                            formSettings.allowResponseEditing ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formSettings.allowResponseEditing ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Edit time limit - only show when response editing is enabled */}
                      {formSettings.allowResponseEditing && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <label className="text-xs sm:text-sm font-medium text-gray-700">Edit time limit</label>
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                              How long users can edit their responses
                            </p>
                          </div>
                          <select
                            value={formSettings.editTimeLimit}
                            onChange={(e) => setFormSettings(prev => ({ ...prev, editTimeLimit: e.target.value }))}
                            className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm w-full sm:min-w-[120px] sm:w-auto">
                            <option value="24h">24 Hours</option>
                            <option value="7d">7 Days</option>
                            <option value="30d">30 Days</option>
                            <option value="always">Always</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {/* Quiz mode restriction notice - only show when quiz is enabled */}
                  {formSettings.isQuiz && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 sm:p-3">
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-orange-800 text-xs sm:text-sm font-medium">Quiz Mode Active</span>
                      </div>
                      <p className="text-orange-700 text-xs sm:text-sm mt-1">
                        Response editing is automatically disabled in quiz mode to maintain academic integrity.
                      </p>
                    </div>
                  )}

                </div>

                {/* Quiz Settings */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                    Quiz Settings
                  </h4>
                  
                  {/* Make this a quiz */}
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-700">Make this a quiz</label>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                        Collect and grade responses with automatic scoring
                      </p>
                    </div>
                    <button
                      onClick={() => setFormSettings(prev => ({ ...prev, isQuiz: !prev.isQuiz }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formSettings.isQuiz ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formSettings.isQuiz ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Quiz-specific options (only show when quiz is enabled) */}
                  {formSettings.isQuiz && (
                    <>
                      {/* Release grades immediately */}
                      <div className="flex items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700">Release grades immediately</label>
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                            Show quiz results right after submission
                          </p>
                        </div>
                        <button
                          onClick={() => setFormSettings(prev => ({ ...prev, releaseGrades: !prev.releaseGrades }))}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                            formSettings.releaseGrades ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formSettings.releaseGrades ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Show correct answers */}
                      <div className="flex items-start sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <label className="text-xs sm:text-sm font-medium text-gray-700">Show correct answers</label>
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                            Display correct answers after quiz submission
                          </p>
                        </div>
                        <button
                          onClick={() => setFormSettings(prev => ({ ...prev, showCorrectAnswers: !prev.showCorrectAnswers }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formSettings.showCorrectAnswers ? 'bg-blue-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formSettings.showCorrectAnswers ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Confirmation Message */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                    Confirmation Message
                  </h4>
                  
                  <div>
                    <label className="text-xs sm:text-sm font-medium text-gray-700 block mb-2">
                      Message shown after form submission
                    </label>
                    <textarea
                      value={formSettings.confirmationMessage}
                      onChange={(e) => setFormSettings(prev => ({ ...prev, confirmationMessage: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                      rows={3}
                      placeholder="Enter confirmation message..."
                    />
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </div>

      {/* Delete Section Confirmation Dialog */}
      {showDeleteDialog && sectionToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-200 px-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-sm w-full shadow-lg">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Delete section?</h3>
            <p className="text-gray-600 text-xs sm:text-sm mb-4 sm:mb-6">
              Section {sectionToDelete.index + 1} has {sectionToDelete.questionCount} {sectionToDelete.questionCount === 1 ? 'question' : 'questions'}. 
              What would you like to do with {sectionToDelete.questionCount === 1 ? 'it' : 'them'}?
            </p>
            
            <div className="space-y-2">
              <button
                onClick={handleMergeSection}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md text-xs sm:text-sm transition-colors"
              >
                Move to previous section
              </button>
              
              <button
                onClick={handleDeleteEntireSection}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-md text-xs sm:text-sm transition-colors"
              >
                Delete questions permanently
              </button>
            </div>
            
            <button
              onClick={handleCancelDelete}
              className="w-full mt-2 sm:mt-3 px-3 sm:px-4 py-1.5 sm:py-2 text-gray-600 hover:bg-gray-50 rounded-md text-xs sm:text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Form Confirmation Dialog */}
      <AlertDialog open={deleteFormDialogOpen} onOpenChange={setDeleteFormDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this form? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteFormDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteForm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}