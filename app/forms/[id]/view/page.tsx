'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatTimeRemaining } from '@/lib/editToken';


interface Option {
  id: string;
  text: string;
  imageUrl?: string;
}

interface Question {
  id: string;
  text: string;
  description?: string; // Add description field for helper text
  type: 'SHORT_ANSWER' | 'PARAGRAPH' | 'MULTIPLE_CHOICE' | 'CHECKBOXES' | 'DROPDOWN';
  required: boolean;
  options: Option[];
  shuffleOptionsOrder?: boolean;
  imageUrl?: string; // Add image URL field
  // Quiz fields
  points?: number;
  correctAnswers?: string[];
}

interface Section {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: Question[];
}

interface FormData {
  id: string;
  title: string;
  description: string;
  acceptingResponses: boolean;
  shuffleQuestions?: boolean;
  collectEmail?: boolean;
  allowMultipleResponses?: boolean;
  showProgress?: boolean;
  confirmationMessage?: string;
  // Quiz fields
  isQuiz?: boolean;
  showCorrectAnswers?: boolean;
  releaseGrades?: boolean;
  // Theme fields
  themeColor?: string;
  themeBackground?: string;
  sections: Section[];
}

// Response data type
interface FormResponse {
  [questionId: string]: string | string[]; // string for single answer, string[] for checkboxes
}

// Helper function to get all questions from sections
const getAllQuestionsFromSections = (sections: Section[]): Question[] => {
  return sections.flatMap(section => section.questions);
};

export default function PublicFormView() {
  const params = useParams();
  const formId = params.id as string;
  
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responses, setResponses] = useState<FormResponse>({});
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);
  
  // Quiz result states
  const [quizResults, setQuizResults] = useState<{
    totalScore: number;
    maxScore: number;
    percentage: number;
    results: { [questionId: string]: { isCorrect: boolean; pointsEarned: number } };
  } | null>(null);

  // Check if this is preview mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Shuffled questions for randomization
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  
  // Custom confirmation message from form settings
  const [confirmationMessage, setConfirmationMessage] = useState('Your response has been recorded.');
  
  // Response editing states
  const [editLink, setEditLink] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState<Date | null>(null);

  // 🆕 Section Navigation States (Safe Addition - No Impact on Existing Code)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionProgress, setSectionProgress] = useState({
    current: 1,
    total: 0
  });

  // 🆕 Section Navigation Helper Functions (Safe - Inside Component)
  const getCurrentSection = (): Section | null => {
    if (!formData || !formData.sections.length) return null;
    return formData.sections[currentSectionIndex] || null;
  };

  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = formData ? currentSectionIndex === (formData.sections.length - 1) : false;

  const goToNextSection = () => {
    if (formData && currentSectionIndex < formData.sections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      updateProgress(currentSectionIndex + 2, formData.sections.length);
    }
  };

  const goToPreviousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      if (formData) {
        updateProgress(currentSectionIndex, formData.sections.length);
      }
    }
  };

  const updateProgress = (current: number, total: number) => {
    setSectionProgress({ current, total });
  };

  const getProgressPercentage = () => {
    if (!formData?.sections.length) return 0;
    return Math.round(((currentSectionIndex + 1) / formData.sections.length) * 100);
  };

  const shouldUseSectionView = () => {
    // Show section view if form has any sections (even single section)
    return formData && formData.sections && formData.sections.length >= 1;
  };

  // Helper function to get all questions from sections
  const getAllQuestionsFromSections = (sections: Section[]): any[] => {
    if (!sections || sections.length === 0) return [];
    return sections.flatMap(section => section.questions || []);
  };

  // Check if user has submitted this form before
  const checkPreviousSubmission = () => {
    const submittedForms = JSON.parse(localStorage.getItem('submittedForms') || '[]');
    return submittedForms.includes(formId);
  };

  // Mark form as submitted by current user
  const markFormAsSubmitted = () => {
    const submittedForms = JSON.parse(localStorage.getItem('submittedForms') || '[]');
    if (!submittedForms.includes(formId)) {
      submittedForms.push(formId);
      localStorage.setItem('submittedForms', JSON.stringify(submittedForms));
    }
  };

  // Smart text scoring function
  const calculateTextScore = (userAnswer: string, correctAnswers: string[], maxPoints: number, questionType: string) => {
    if (!userAnswer || !correctAnswers.length) {
      return { points: 0, percentage: 0 };
    }

    const userText = userAnswer.toLowerCase().trim().replace(/\s+/g, ' ');
    let bestMatch = 0;

    for (const correctAnswer of correctAnswers) {
      const correctText = correctAnswer.toLowerCase().trim().replace(/\s+/g, ' ');
      
      // Remove common punctuation for comparison
      const cleanUser = userText.replace(/[.,!?;:"'\-()]/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanCorrect = correctText.replace(/[.,!?;:"'\-()]/g, ' ').replace(/\s+/g, ' ').trim();
      
      let matchPercentage = 0;
      
      // Exact match (100%)
      if (cleanUser === cleanCorrect) {
        matchPercentage = 100;
      } else {
        // Word-based matching for partial credit
        let userWords = cleanUser.split(' ').filter(w => w.length > 1);
        let correctWords = cleanCorrect.split(' ').filter(w => w.length > 1);
        
        if (correctWords.length === 0) continue;
        
        // Remove common question words that don't affect the core answer
        const questionWords = ['what', 'is', 'are', 'define', 'explain', 'describe', 'how', 'why', 'when', 'where', 'which', 'who'];
        const filteredCorrectWords = correctWords.filter(word => !questionWords.includes(word.toLowerCase()));
        
        // If we removed question words, use filtered list for scoring
        const wordsToMatch = filteredCorrectWords.length > 0 ? filteredCorrectWords : correctWords;
        
        // Count matching words
        const matchingWords = wordsToMatch.filter(word => 
          userWords.some(userWord => 
            userWord === word || 
            (word.length > 3 && userWord.includes(word)) ||
            (userWord.length > 3 && word.includes(userWord))
          )
        );
        
        // Calculate percentage based on matching words (using filtered words for scoring)
        const wordMatchPercentage = (matchingWords.length / wordsToMatch.length) * 100;
        
        // Different scoring logic based on question type
        if (questionType === 'SHORT_ANSWER') {
          // SHORT_ANSWER: Strict - Must match ALL important words to get any points
          if (matchingWords.length === wordsToMatch.length && wordsToMatch.length > 0) {
            matchPercentage = 100; // Only give points if complete answer
          } else {
            matchPercentage = 0; // No partial credit for short answers
          }
        } else {
          // PARAGRAPH: Flexible scoring with partial credit
          if (wordMatchPercentage >= 80) {
            matchPercentage = 100; // Excellent match
          } else if (wordMatchPercentage >= 60) {
            matchPercentage = 80; // Good match  
          } else if (wordMatchPercentage >= 40) {
            matchPercentage = 60; // Fair match
          } else if (wordMatchPercentage >= 20) {
            matchPercentage = 30; // Poor match
          } else {
            matchPercentage = 0; // Too few matching words
          }
        }
      }
      
      bestMatch = Math.max(bestMatch, matchPercentage);
    }
    
    // Calculate points based on percentage
    const earnedPoints = Math.round((bestMatch / 100) * maxPoints * 100) / 100; // Round to 2 decimals
    
    return {
      points: earnedPoints,
      percentage: Math.round(bestMatch)
    };
  };

  // Calculate quiz score
  const calculateQuizScore = () => {
    if (!formData?.isQuiz || !shuffledQuestions.length) return null;
    
    let totalScore = 0;
    let maxScore = 0;
    const results: { [questionId: string]: { isCorrect: boolean; pointsEarned: number } } = {};
    
    shuffledQuestions.forEach(question => {
      const userResponse = responses[question.id];
      const questionPoints = question.points || 1;
      maxScore += questionPoints;
      
      let isCorrect = false;
      let pointsEarned = 0;
      
      if (question.type === 'MULTIPLE_CHOICE') {
        // Single correct answer
        isCorrect = question.correctAnswers?.includes(userResponse as string) || false;
        pointsEarned = isCorrect ? questionPoints : 0;
      } else if (question.type === 'CHECKBOXES') {
        // Multiple correct answers
        const userAnswers = userResponse as string[] || [];
        const correctAnswers = question.correctAnswers || [];
        
        // Check if user selected exactly the correct answers
        isCorrect = userAnswers.length === correctAnswers.length && 
                   userAnswers.every((ans: string) => correctAnswers.includes(ans)) &&
                   correctAnswers.every((ans: string) => userAnswers.includes(ans));
        pointsEarned = isCorrect ? questionPoints : 0;
      } else if (question.type === 'SHORT_ANSWER' || question.type === 'PARAGRAPH') {
        // Smart text matching with partial scoring
        const result = calculateTextScore(userResponse as string, question.correctAnswers || [], questionPoints, question.type);
        isCorrect = result.percentage >= 100;
        pointsEarned = result.points;
      } else {
        // Other question types - no scoring yet
        isCorrect = false;
        pointsEarned = 0;
      }
      
      totalScore += pointsEarned;
      results[question.id] = { isCorrect, pointsEarned };
    });
    
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return {
      totalScore,
      maxScore,
      percentage,
      results
    };
  };

  // Calculate form completion progress
  const calculateProgress = () => {
    if (!shuffledQuestions.length) return 0;
    
    const answeredQuestions = shuffledQuestions.filter(question => {
      const response = responses[question.id];
      if (!response) return false;
      
      if (typeof response === 'string') {
        return response.trim() !== '';
      } else if (Array.isArray(response)) {
        return response.length > 0;
      }
      return false;
    });
    
    return Math.round((answeredQuestions.length / shuffledQuestions.length) * 100);
  };

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Fetch form data on component mount
  useEffect(() => {
    // Check URL for preview parameter
    const urlParams = new URLSearchParams(window.location.search);
    const isPreview = urlParams.get('preview') === 'true';
    setIsPreviewMode(isPreview);
    
    // Check if user has submitted this form before
    setHasSubmittedBefore(checkPreviousSubmission());
    
    fetchFormData(isPreview);
  }, [formId]);

  const fetchFormData = async (isPreview = false) => {
    try {
      // For preview mode, use the form API that shows even unpublished forms (owner access)
      const apiUrl = isPreview ? `/api/forms/${formId}` : `/api/forms/${formId}/public`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.success) {
        setFormData(data.form);
        
        // 🆕 Initialize section progress (Safe Addition)
        if (data.form.sections && data.form.sections.length > 0) {
          updateProgress(1, data.form.sections.length);
        }
        
        // Process sections and questions.
        // - Shuffle options per-question when enabled
        // - If `shuffleQuestions` is enabled, shuffle question order WITHIN each section (preserves sections)
        const processedSections = (data.form.sections || []).map((section: Section) => {
          const processedQuestions = (section.questions || []).map((question: Question) => {
            // For preview mode, don't shuffle anything
            if (isPreview) return question;

            // Shuffle options if enabled for this question
            if (question.shuffleOptionsOrder && 
                (question.type === 'MULTIPLE_CHOICE' || question.type === 'CHECKBOXES' || question.type === 'DROPDOWN')) {
              return {
                ...question,
                options: shuffleArray(question.options)
              };
            }

            return question;
          });

          const finalQuestions = (data.form.shuffleQuestions && !isPreview)
            ? shuffleArray(processedQuestions)
            : processedQuestions;

          return {
            ...section,
            questions: finalQuestions
          };
        });


        const allQuestionsFlat = processedSections.flatMap((s: any) => s.questions || []);

        // Update formData to include processed (and possibly shuffled) sections
        setFormData({ ...data.form, sections: processedSections });

        // Also set flattened questions used for quiz/progress logic
        setShuffledQuestions(allQuestionsFlat);
      } else {
        // Form is either not published or doesn't exist
        setNotFound(true);
      }
    } catch (error) {
      // Network or other error occurred
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (questionId: string, value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors(prev => ({
        ...prev,
        [questionId]: ''
      }));
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    // Check email if collection is enabled
    if (formData?.collectEmail) {
      if (!email.trim()) {
        newErrors['email'] = 'Email address is required';
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newErrors['email'] = 'Please enter a valid email address';
      }
    }
    
    // Check if user has provided any responses at all
    const hasAnyResponses = Object.keys(responses).length > 0 && 
                           Object.values(responses).some(response => {
                             if (typeof response === 'string') {
                               return response.trim() !== '';
                             } else if (Array.isArray(response)) {
                               return response.length > 0;
                             }
                             return false;
                           });

    if (!hasAnyResponses) {
      return false;
    }
    
    // Check required fields
    shuffledQuestions.forEach(question => {
      if (question.required) {
        const response = responses[question.id];
        if (!response || 
            (typeof response === 'string' && response.trim() === '') ||
            (Array.isArray(response) && response.length === 0)) {
          newErrors[question.id] = 'This field is required';
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Check if multiple responses are allowed
    if (!formData?.allowMultipleResponses && hasSubmittedBefore) {
      return;
    }

    // Check if user has provided any responses at all before validation
    const hasAnyResponses = Object.keys(responses).length > 0 && 
                           Object.values(responses).some(response => {
                             if (typeof response === 'string') {
                               return response.trim() !== '';
                             } else if (Array.isArray(response)) {
                               return response.length > 0;
                             }
                             return false;
                           });

    if (!hasAnyResponses) {
      alert('Please answer at least one question before submitting.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Calculate quiz score if this is a quiz
      const quizScore = formData?.isQuiz ? calculateQuizScore() : null;
      
      // Set quiz results if available
      if (quizScore) {
        setQuizResults(quizScore);
      }
      
      // Submit responses to API
      const response = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          responses: responses,
          email: formData?.collectEmail ? email : undefined,
          ...(quizScore && {
            totalScore: quizScore.totalScore,
            maxScore: quizScore.maxScore,
            quizResults: quizScore.results
          })
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Store the custom confirmation message from API response
        if (result.confirmationMessage) {
          setConfirmationMessage(result.confirmationMessage);
        }
        
        // Handle edit link if response editing is enabled
        if (result.editLink) {
          setEditLink(result.editLink);
          setCanEdit(result.canEdit || false);
          setEditExpiresAt(result.editExpiresAt ? new Date(result.editExpiresAt) : null);
        }
        
        // Mark form as submitted for this user
        markFormAsSubmitted();
        setHasSubmittedBefore(true);
        setSubmitted(true);
      } else {
        console.error('Submission error:', result.error);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearForm = () => {
    // Check if there are any responses to clear
    const hasResponses = Object.keys(responses).length > 0 && 
                        Object.values(responses).some(response => {
                          if (typeof response === 'string') {
                            return response.trim() !== '';
                          } else if (Array.isArray(response)) {
                            return response.length > 0;
                          }
                          return false;
                        });

    if (!hasResponses) {
      return;
    }

    if (confirm('Are you sure you want to clear all responses?')) {
      setResponses({});
      setErrors({});
    }
  };

  // Render question based on type
  const renderQuestion = (question: Question) => {
    const response = responses[question.id];
    const hasError = errors[question.id];

    switch (question.type) {
      case 'SHORT_ANSWER':
        return (
          <input
            type="text"
            value={response as string || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className={`w-full px-2 sm:px-3 py-2 sm:py-3 border rounded-md focus:outline-none focus:ring-2 text-sm sm:text-base ${
              hasError ? 'border-red-500' : 'border-gray-300'
            }`}
            style={{
              '--tw-ring-color': formData?.themeColor || '#4285F4'
            } as React.CSSProperties}
            placeholder="Your answer"
          />
        );

      case 'PARAGRAPH':
        return (
          <textarea
            value={response as string || ''}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className={`w-full px-2 sm:px-3 py-2 sm:py-3 border rounded-md focus:outline-none focus:ring-2 resize-y min-h-[100px] text-sm sm:text-base ${
              hasError ? 'border-red-500' : 'border-gray-300'
            }`}
            style={{
              '--tw-ring-color': formData?.themeColor || '#4285F4'
            } as React.CSSProperties}
            placeholder="Your answer"
          />
        );

      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-3">
            {question.options
              .filter((option) => option.text?.trim() || option.imageUrl) // Only show options with text or image
              .map((option) => (
              <label key={option.id} className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name={question.id}
                  value={option.text || `image-option-${option.id}`} // Use unique value for image-only options
                  checked={response === (option.text || `image-option-${option.id}`)}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="w-4 h-4 mt-1"
                  style={{
                    accentColor: formData?.themeColor || '#4285F4'
                  }}
                />
                <div className="flex-1">
                  {option.imageUrl && (
                    <div className={option.text?.trim() ? "mb-2" : ""}>
                      <img 
                        src={option.imageUrl} 
                        alt={option.text ? `Option image for ${option.text}` : "Option image"}
                        className="w-full max-w-xs h-auto rounded-md border border-gray-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  {option.text?.trim() && (
                    <span className="text-gray-900">{option.text}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        );

      case 'CHECKBOXES':
        return (
          <div className="space-y-2 sm:space-y-3">
            {question.options
              .filter((option) => option.text?.trim() || option.imageUrl) // Only show options with text or image
              .map((option) => {
                const optionValue = option.text || `image-option-${option.id}`;
                return (
                <label key={option.id} className="flex items-start gap-2 sm:gap-3 cursor-pointer p-2 sm:p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={(response as string[] || []).includes(optionValue)}
                    onChange={(e) => {
                      const currentResponses = response as string[] || [];
                      if (e.target.checked) {
                        handleInputChange(question.id, [...currentResponses, optionValue]);
                      } else {
                        handleInputChange(question.id, currentResponses.filter(r => r !== optionValue));
                      }
                    }}
                    className="w-4 h-4 mt-0.5 sm:mt-1 flex-shrink-0"
                    style={{
                      accentColor: formData?.themeColor || '#4285F4'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {option.imageUrl && (
                      <div className={option.text?.trim() ? "mb-2" : ""}>
                        <img 
                          src={option.imageUrl} 
                          alt={option.text ? `Option image for ${option.text}` : "Option image"}
                          className="w-full max-w-full h-auto rounded-md border border-gray-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    {option.text?.trim() && (
                      <span className="text-gray-900 text-sm sm:text-base break-words">{option.text}</span>
                    )}
                  </div>
                </label>
              )})}
          </div>
        );

      case 'DROPDOWN':
        return (
          <div className="relative">
            <select
              value={response as string || ''}
              onChange={(e) => handleInputChange(question.id, e.target.value)}
              className={`w-full appearance-none px-2 sm:px-3 py-2 sm:py-3 pr-8 sm:pr-10 border rounded-md focus:outline-none focus:ring-2 bg-white cursor-pointer transition-all duration-200 hover:border-gray-400 text-sm sm:text-base ${
                hasError ? 'border-red-500' : 'border-gray-300'
              }`}
              style={{
                '--tw-ring-color': formData?.themeColor || '#4285F4'
              } as React.CSSProperties}
            >
              <option value="" disabled className="text-gray-500">Select an option</option>
              {question.options
                .filter((option) => option.text?.trim() || option.imageUrl)
                .map((option) => {
                  const optionValue = option.text || `image-option-${option.id}`;
                  const displayText = option.text?.trim() 
                    ? option.text 
                    : (option.imageUrl ? "Image Option" : "");
                  return (
                    <option key={option.id} value={optionValue} className="text-gray-900">
                      {displayText}
                    </option>
                  );
                })}
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSpinner message="Loading form..." />;
  }

  // Form not found or not published
  if (notFound || !formData) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-sm border border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 break-words">Form Not Available</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 break-words">This form is not published or doesn't exist.</p>
          <p className="text-xs sm:text-sm text-gray-500 break-words">Please check the URL or contact the form owner.</p>
        </div>
      </div>
    );
  }

  // Form not found
  if (!formData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 break-words">Form Not Found</h2>
          <p className="text-sm sm:text-base text-gray-600 break-words">The form you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div 
        className="min-h-screen" 
        style={{ 
          backgroundColor: formData?.themeBackground || 'rgba(66, 133, 244, 0.1)'
        }}
      >
        <div className="max-w-2xl mx-auto pt-2 sm:pt-4 px-4 sm:px-6">
          <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6 overflow-hidden">
            <div className="h-2" style={{ backgroundColor: formData?.themeColor || '#4285F4' }}></div>
            <div className="p-4 sm:p-6 lg:p-8">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 break-words">{formData?.title}</h1>
              <p className="text-gray-600 text-sm sm:text-base mb-4 sm:mb-6 break-words">{confirmationMessage}</p>
              
              {/* Quiz notification when grades are not released immediately */}
              {formData?.isQuiz && !formData.releaseGrades && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-yellow-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-medium text-yellow-800">Quiz Submitted Successfully</h3>
                      <p className="text-xs sm:text-sm text-yellow-700 mt-1">Your quiz has been graded and results will be shared later.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quiz Results - Only show if quiz mode AND release grades is enabled */}
              {formData?.isQuiz && quizResults && formData.releaseGrades && (
                <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Quiz Results</h2>
                  
                  {/* Score Display */}
                  <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-lg border">
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">
                        {quizResults.totalScore}/{quizResults.maxScore}
                      </div>
                      <div className="text-base sm:text-lg font-medium text-gray-700 mb-1">
                        {quizResults.percentage}%
                      </div>
                      <div className="text-sm text-gray-600">
                        {quizResults.totalScore === quizResults.maxScore 
                          ? "Perfect Score! 🎉" 
                          : quizResults.percentage >= 80 
                          ? "Great Job! 👍" 
                          : quizResults.percentage >= 60 
                          ? "Good Effort! 👌" 
                          : "Keep Practicing! 📚"}
                      </div>
                    </div>
                  </div>
                  
                  {/* Question Results - Only if showCorrectAnswers is ALSO enabled */}
                  {formData.showCorrectAnswers && (
                    <div className="space-y-3 sm:space-y-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800">Answer Review</h3>
                      {shuffledQuestions.map((question) => {
                        const result = quizResults.results[question.id];
                        const userResponse = responses[question.id];
                        
                        return (
                          <div key={question.id} className="p-3 sm:p-4 bg-white rounded-lg border">
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 
                                  className="font-medium text-gray-900 text-sm sm:text-base break-words [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
                                  dangerouslySetInnerHTML={{ __html: question.text }}
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.tagName === 'A') {
                                      e.preventDefault();
                                      window.open((target as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                />
                                
                                {/* Display Question Image in Quiz Results */}
                                {question.imageUrl && (
                                  <div className="mt-2">
                                    <img 
                                      src={question.imageUrl} 
                                      alt="Question image" 
                                      className="max-w-full w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                                      style={{ maxHeight: '300px' }}
                                    />
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1.5 sm:gap-2 ml-2 sm:ml-4 flex-shrink-0">
                                <span className="text-xs sm:text-sm text-gray-600">
                                  {result.pointsEarned}/{question.points || 1} pts
                                </span>
                                {result.pointsEarned === 0 ? (
                                  <span className="text-red-600 text-xs sm:text-sm font-medium">✗ Incorrect</span>
                                ) : result.isCorrect ? (
                                  <span className="text-green-600 text-xs sm:text-sm font-medium">✓ Correct</span>
                                ) : (
                                  <span className="text-orange-600 text-xs sm:text-sm font-medium">◐ Partially Correct</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">Your answer: </span>
                                <span className={
                                  result.pointsEarned === 0 
                                    ? "text-red-700" 
                                    : result.isCorrect 
                                    ? "text-green-700" 
                                    : "text-orange-700"
                                }>
                                  {Array.isArray(userResponse) 
                                    ? userResponse.join(', ') 
                                    : userResponse || 'No answer'}
                                </span>
                              </div>
                              
                              {!result.isCorrect && question.correctAnswers && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    {result.pointsEarned > 0 ? 'Complete answer: ' : 'Correct answer: '}
                                  </span>
                                  <span className="text-green-700">
                                    {Array.isArray(question.correctAnswers) 
                                      ? question.correctAnswers.join(', ') 
                                      : question.correctAnswers}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Edit response link - Only show if editing is enabled and not a quiz */}
              {canEdit && editLink && !formData?.isQuiz && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="text-green-600 mt-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-green-800 font-medium text-xs sm:text-sm">Response Submitted Successfully</h3>
                      <p className="text-green-700 text-xs sm:text-sm mt-1 break-words">
                        You can edit your response if needed.
                        {editExpiresAt && (
                          <span className="block mt-1 text-xs">
                            {formatTimeRemaining(editExpiresAt)} to make changes.
                          </span>
                        )}
                      </p>
                      <a
                        href={editLink}
                        className="inline-flex items-center gap-1.5 sm:gap-2 mt-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit Response</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit another response link - Google Forms style */}
              {formData?.allowMultipleResponses && (
                <div className="mt-3 sm:mt-4">
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setResponses({});
                      setEmail('');
                      setErrors({});
                      setQuizResults(null);
                      // Reset edit states
                      setEditLink(null);
                      setCanEdit(false);
                      setEditExpiresAt(null);
                    }}
                    className="underline text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                  style={{ color: formData?.themeColor || '#4285F4' }}
                  onMouseEnter={(e) => {
                    const color = formData?.themeColor || '#4285F4';
                    e.currentTarget.style.color = `${color}cc`; // Add opacity on hover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = formData?.themeColor || '#4285F4';
                  }}
                  >
                    Submit another response
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main form view
  return (
    <div 
      className="min-h-screen" 
      style={{ 
        backgroundColor: formData?.themeBackground || '#f3f4f6',
        overscrollBehavior: 'none'
      }}
    >
      <div className="max-w-2xl mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6">
        {/* Preview Mode Header */}
        {isPreviewMode && (
          <div className="border rounded-lg p-3 sm:p-4 mb-4 sm:mb-6" style={{ 
            backgroundColor: `${formData?.themeColor || '#4285F4'}15`, 
            borderColor: `${formData?.themeColor || '#4285F4'}33`
          }}>
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: formData?.themeColor || '#4285F4' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="font-medium text-xs sm:text-sm" style={{ color: `${formData?.themeColor || '#4285F4'}dd` }}>Preview Mode</span>
              </div>
              <button 
                onClick={() => window.close()} 
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded-md hover:opacity-80 transition-opacity flex-shrink-0"
                style={{
                  borderColor: `${formData?.themeColor || '#4285F4'}66`,
                  color: formData?.themeColor || '#4285F4',
                  backgroundColor: `${formData?.themeColor || '#4285F4'}10`
                }}
              >
                Close Preview
              </button>
            </div>
            <p className="text-xs sm:text-sm mt-2 break-words" style={{ color: `${formData?.themeColor || '#4285F4'}cc` }}>This is how your form will appear to respondents. Form submission is disabled in preview mode.</p>
          </div>
        )}

        {/* Not Accepting Responses Message */}
        {!formData.acceptingResponses && !isPreviewMode ? (
          <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6 overflow-hidden">
            <div className="h-2" style={{ backgroundColor: formData.themeColor || '#4285F4' }}></div>
            <div className="p-4 sm:p-6 text-center">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4 break-words">{formData.title}</h1>
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 break-words">This form is no longer accepting responses</h2>
              <p className="text-sm sm:text-base text-gray-600 break-words">Try contacting the owner of the form if you think this is a mistake.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Multiple Response Warning */}
            {!formData.allowMultipleResponses && hasSubmittedBefore && !isPreviewMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-yellow-800 font-medium text-xs sm:text-sm">Already Submitted</span>
                </div>
                <p className="text-yellow-700 text-xs sm:text-sm mt-2 break-words">
                  You have already submitted a response to this form. Multiple responses are not allowed.
                </p>
              </div>
            )}

            {/* Form Header */}
            <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6 overflow-hidden">
              {/* Theme colored top line */}
              <div className="h-2" style={{ backgroundColor: formData.themeColor || '#4285F4' }}></div>
              <div className="p-4 sm:p-6">
                <h1 
                  className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 break-words [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: formData.title || 'Untitled Form' }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'A') {
                      e.preventDefault();
                      window.open((target as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
                    }
                  }}
                />
                {formData.description && (
                  <div 
                    className="text-sm sm:text-base text-gray-600 break-words [&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
                    dangerouslySetInnerHTML={{ __html: formData.description }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'A') {
                        e.preventDefault();
                        window.open((target as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* 🆕 Section Progress Indicator (Only show for multi-section forms) */}
            {shouldUseSectionView() && formData.sections.length > 1 && (
              <div className="bg-white rounded-lg shadow-sm mb-3 sm:mb-4 p-3 sm:p-4">
                <div className="flex items-center justify-center">
                  <span className="text-xs sm:text-sm text-gray-600 font-medium">
                    Section {currentSectionIndex + 1} of {formData.sections.length}
                  </span>
                </div>
              </div>
            )}

            {/* Email Field */}
            {formData?.collectEmail && (
              <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6 p-4 sm:p-6">
                <div className="mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-1">
                    Email address <span className="text-red-500">*</span>
                  </h3>
                </div>
                
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Clear email error when user starts typing
                    if (errors['email']) {
                      setErrors(prev => ({
                        ...prev,
                        email: ''
                      }));
                    }
                  }}
                  className={`w-full px-2 sm:px-3 py-2 sm:py-3 border rounded-md focus:outline-none focus:ring-2 text-sm sm:text-base ${
                    errors['email'] ? 'border-red-500' : 'border-gray-300'
                  }`}
                  style={{
                    '--tw-ring-color': formData?.themeColor || '#4285F4'
                  } as React.CSSProperties}
                  placeholder="your.email@example.com"
                />
                
                {/* Error message */}
                {errors['email'] && (
                  <p className="mt-2 text-sm text-red-600">{errors['email']}</p>
                )}
              </div>
            )}

            {/* Questions */}
            {shouldUseSectionView() ? (
              // 🆕 Section-Based Rendering (Google Forms Style)
              <>
                {getCurrentSection() && (
                  <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6 p-4 sm:p-6">
                    {/* Section Header - Only show when multiple sections exist OR custom title/description */}
                    {(formData.sections.length > 1 && (getCurrentSection()!.title !== 'Section 1' || getCurrentSection()!.description)) && (
                      <div className="mb-4 sm:mb-6 border-b border-gray-200 pb-3 sm:pb-4">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 break-words">
                          {getCurrentSection()!.title}
                        </h2>
                        {getCurrentSection()!.description && (
                          <p className="text-sm sm:text-base text-gray-600 break-words">
                            {getCurrentSection()!.description}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Section Questions */}
                    <div className="space-y-4 sm:space-y-6">
                      {getCurrentSection()!.questions.map((question, index) => {
                        // Find the question index across all sections for proper numbering
                        const allQuestions = getAllQuestionsFromSections(formData.sections);
                        const globalIndex = allQuestions.findIndex(q => q.id === question.id);
                        
                        return (
                          <div key={question.id}>
                            <div className="mb-3 sm:mb-4">
                              <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-1 break-words">
                                {globalIndex + 1}. <span 
                                  className="[&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
                                  dangerouslySetInnerHTML={{ __html: question.text }}
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.tagName === 'A') {
                                      e.preventDefault();
                                      window.open((target as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                />
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                              </h3>
                              
                              {/* Question Description */}
                              {question.description && (
                                <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2 mb-2 sm:mb-3 break-words">{question.description}</p>
                              )}
                              
                              {/* Question Image */}
                              {question.imageUrl && (
                                <div className="mt-2 sm:mt-3 mb-3 sm:mb-4">
                                  <img 
                                    src={question.imageUrl} 
                                    alt="Question image" 
                                    className="max-w-full w-full h-auto rounded-lg border border-gray-200"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            
                            {renderQuestion(question)}
                            
                            {/* Error message */}
                            {errors[question.id] && (
                              <p className="mt-2 text-sm text-red-600">{errors[question.id]}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // 🔄 Original Rendering (Fallback for Single Section or Legacy Forms)
              <div className="space-y-4 sm:space-y-6">
                {shuffledQuestions.map((question, index) => (
                  <div key={question.id} className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                    <div className="mb-3 sm:mb-4">
                      <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-1 break-words">
                        {index + 1}. <span 
                          className="[&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer"
                          dangerouslySetInnerHTML={{ __html: question.text }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'A') {
                              e.preventDefault();
                              window.open((target as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        />
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      
                      {/* Display Question Description */}
                      {question.description && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2 mb-2 sm:mb-3 break-words">{question.description}</p>
                      )}
                      
                      {/* Display Question Image */}
                      {question.imageUrl && (
                        <div className="mt-2 sm:mt-3 mb-3 sm:mb-4">
                          <img 
                            src={question.imageUrl} 
                            alt="Question image" 
                            className="max-w-full w-full h-auto rounded-lg border border-gray-200"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {renderQuestion(question)}
                    
                    {/* Error message */}
                    {errors[question.id] && (
                      <p className="mt-2 text-sm text-red-600">{errors[question.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons with Integrated Progress */}
            <div className="mt-6 sm:mt-8 flex justify-between items-center">
              {shouldUseSectionView() && formData.sections.length > 1 ? (
                // 🆕 Section Navigation Buttons (Google Forms Style) - For Multi-Section Forms
                <div className="w-full flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-2">
                  {/* Previous Button */}
                  <Button
                    onClick={goToPreviousSection}
                    disabled={isFirstSection}
                    className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white shadow-sm transition-all duration-200 min-w-[100px] sm:min-w-[120px] ${isFirstSection ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{
                      color: formData?.themeColor || '#4285F4',
                      background: '#fff',
                      border: 'none',
                    }}
                  >
                    ← Previous
                  </Button>

                  {/* Clear Form Button (Always Center) */}
                  <Button
                    onClick={isPreviewMode ? undefined : handleClearForm}
                    variant="ghost"
                    disabled={isPreviewMode || (!formData?.allowMultipleResponses && hasSubmittedBefore)}
                    className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white shadow-sm transition-all duration-200 order-3 sm:order-2 ${(isPreviewMode || (!formData?.allowMultipleResponses && hasSubmittedBefore)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{
                      color: formData?.themeColor || '#4285F4',
                      background: '#fff',
                      border: 'none',
                    }}
                  >
                    Clear Form
                  </Button>

                  {/* Next/Submit Button (Always Right, Same Width) */}
                  {isLastSection ? (
                    <Button
                      onClick={isPreviewMode ? undefined : handleSubmit}
                      disabled={submitting || isPreviewMode || (!formData?.allowMultipleResponses && hasSubmittedBefore)}
                      className="px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white shadow-sm transition-all duration-200 min-w-[100px] sm:min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-3"
                      style={{
                        color: formData?.themeColor || '#4285F4',
                        background: '#fff',
                        border: 'none',
                      }}
                    >
                      {isPreviewMode ? 'Submit' : 
                        (!formData?.allowMultipleResponses && hasSubmittedBefore) ? 'Already Submitted' :
                        (submitting ? 'Submitting...' : 'Submit')}
                    </Button>
                  ) : (
                    <Button
                      onClick={goToNextSection}
                      className="px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white shadow-sm transition-all duration-200 min-w-[100px] sm:min-w-[120px] order-2 sm:order-3"
                      style={{
                        color: formData?.themeColor || '#4285F4',
                        background: '#fff',
                        border: 'none',
                      }}
                    >
                      Next →
                    </Button>
                  )}
                </div>
              ) : (
                // 🔄 Standard Submit Buttons (For Single Section or Legacy Forms)
                <>
                  {/* Clear Form Button */}
                  <Button
                    onClick={isPreviewMode ? undefined : handleClearForm}
                    variant="ghost"
                    disabled={isPreviewMode || (!formData?.allowMultipleResponses && hasSubmittedBefore)}
                    className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white shadow-sm transition-all duration-200 ml-0 sm:ml-2 ${(isPreviewMode || (!formData?.allowMultipleResponses && hasSubmittedBefore)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{
                      color: formData?.themeColor || '#4285F4',
                      background: '#fff',
                      border: 'none',
                    }}
                  >
                    Clear Form
                  </Button>
                  
                  {/* Progress Bar in Center */}
                  {formData?.showProgress && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-16 sm:w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ 
                            width: `${calculateProgress()}%`,
                            backgroundColor: formData?.themeColor || '#4285F4'
                          }}
                        ></div>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-600 font-medium">{calculateProgress()}%</span>
                    </div>
                  )}
                  
                  {/* Submit Button */}
                  <Button
                    onClick={isPreviewMode ? undefined : handleSubmit}
                    disabled={submitting || isPreviewMode || (!formData?.allowMultipleResponses && hasSubmittedBefore)}
                    className="px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-white shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      color: formData?.themeColor || '#4285F4',
                      background: '#fff',
                      border: 'none',
                    }}
                  >
                    {isPreviewMode ? 'Submit' : 
                     (!formData?.allowMultipleResponses && hasSubmittedBefore) ? 'Already Submitted' :
                     (submitting ? 'Submitting...' : 'Submit')}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}