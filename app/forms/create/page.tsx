"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/QuestionCard";
import { navbarEvents } from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";

type QuestionType = "SHORT_ANSWER" | "PARAGRAPH" | "MULTIPLE_CHOICE" | "CHECKBOXES" | "DROPDOWN";

interface OptionWithImage {
  text: string;
  imageUrl?: string;
}

interface Question {
  id: string;
  question: string;
  description?: string; // Add description field for helper text
  type: QuestionType;
  required: boolean;
  options?: OptionWithImage[];
  shuffleOptionsOrder?: boolean;
  imageUrl?: string; // Add image URL field
  // Quiz fields
  points?: number;
  correctAnswers?: string[];
}

export default function CreateFormPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  const [formTitle, setFormTitle] = useState("Untitled form");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  
  // Track if there are unsaved changes
  const hasUnsavedChanges = () => {
    const hasContent = formTitle.trim() !== "Untitled form" || 
                      formDescription.trim() !== "" || 
                      questions.some(q => q.question.trim() !== "");
    return hasContent;
  };
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: "1",
      question: "",
      type: "SHORT_ANSWER",
      required: false
    }
  ]);
  
  // Tab system
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');
  
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
    editTimeLimit: '24h'
  });

  // Redirect to sign-in if not authenticated
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

  const handlePreviewForm = () => {
    // Create a temporary form preview with current data
    const previewData = {
      title: formTitle,
      description: formDescription,
      questions: questions.map(q => ({
        id: q.id,
        text: q.question,
        type: q.type,
        required: q.required,
        options: q.options || [],
        imageUrl: q.imageUrl // Add image URL to preview data
      }))
    };
    
    // Store in sessionStorage for preview
    sessionStorage.setItem('previewFormData', JSON.stringify(previewData));
    
    // Open preview in new tab
    window.open('/forms/preview', '_blank');
  };

  const handleSaveForm = async (published = false) => {
    if (!formTitle.trim()) {
      return;
    }

    // Check if there are any questions with content
    const hasValidQuestions = questions.some(q => q.question.trim() !== "");
    if (!hasValidQuestions) {
      alert('Please add at least one question to the form.');
      return;
    }

    setSaving(true);
    setJustSaved(false);
    setTimeout(() => {
      if (process.env.NODE_ENV === 'development') console.log("Current questions state before validation:", questions);
      const validQuestions = questions.filter(q => {
        if (process.env.NODE_ENV === 'development') console.log("Checking question validity:", q.question);
        const isValid = q.question.trim() !== "";
        if (process.env.NODE_ENV === 'development') console.log("Is question valid?", isValid);
        return isValid;
      }).map(q => ({
        ...q,
        options: q.options?.filter(opt => opt.text.trim() !== '' || opt.imageUrl) || []
      }));

      if (process.env.NODE_ENV === 'development') console.log("Filtered valid questions:", validQuestions);

      if (validQuestions.length === 0) {
        // alert("Please add at least one question with text");
        setSaving(false);
        return;
      }

      const formData = {
        title: formTitle,
        description: formDescription,
        questions: validQuestions,
        published: published,
        settings: formSettings
      };

      fetch('/api/forms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            setJustSaved(true);
            setSaving(false);
            setTimeout(() => {
              if (published) {
                window.location.href = '/';
              } else {
                window.location.href = `/forms/${result.formId}`;
              }
            }, 1000);
          } else {
            setSaving(false);
            alert('Error saving form: ' + (result.message || 'Unknown error'));
          }
        })
        .catch(() => {
          setSaving(false);
        });
    }, 0);
  };

  // Listen for navbar button clicks
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    // Add a small delay to ensure component is fully mounted
    const timeoutId = setTimeout(() => {
      const handleNavbarPublish = () => {
        // Check for unsaved changes before publishing
        if (hasUnsavedChanges()) {
          alert('Please save the draft before publishing.');
          return;
        }
        if (typeof handleSaveForm === 'function') {
          handleSaveForm(true); // Save and publish
        }
      };

      const handleNavbarPreview = () => {
        if (typeof handlePreviewForm === 'function') {
          handlePreviewForm(); // Show preview
        }
      };

      const handleNavbarSave = () => {
        if (typeof handleSaveForm === 'function') {
          handleSaveForm(false); // Save as draft
        }
      };

      navbarEvents.subscribe('publishForm', handleNavbarPublish);
      navbarEvents.subscribe('previewForm', handleNavbarPreview);
      navbarEvents.subscribe('saveForm', handleNavbarSave);
      
      // Store cleanup function
      cleanup = () => {
        navbarEvents.unsubscribe('publishForm', handleNavbarPublish);
        navbarEvents.unsubscribe('previewForm', handleNavbarPreview);
        navbarEvents.unsubscribe('saveForm', handleNavbarSave);
      };
    }, 10);
    
    return () => {
      clearTimeout(timeoutId);
      cleanup?.();
    };
  }, [formTitle, formDescription, questions]);

  // Effect to show/hide preview button based on changes
  useEffect(() => {
    const previewButton = document.getElementById('preview-button');
    const saveButton = document.getElementById('save-button-create');
    const saveText = document.getElementById('save-text-create');
    
    if (previewButton && saveButton && saveText) {
      const hasChanges = hasUnsavedChanges();
      
      if (saving) {
        saveButton.setAttribute('disabled', 'true');
        saveText.textContent = 'Saving...';
        previewButton.style.display = 'none';
      } else if (justSaved) {
        saveButton.setAttribute('disabled', 'true');
        saveText.textContent = 'Saved!';
        previewButton.style.display = 'flex';
        // Reset justSaved after 2 seconds
        setTimeout(() => setJustSaved(false), 2000);
      } else if (hasChanges) {
        previewButton.style.display = 'none';
        saveButton.removeAttribute('disabled');
        saveText.textContent = 'Save Draft';
      } else {
        previewButton.style.display = 'flex';
        saveButton.setAttribute('disabled', 'true');
        saveText.textContent = 'No Changes';
      }
    }
  }, [formTitle, formDescription, questions, saving, justSaved]);

  // Show loading or redirect content (after all hooks)
  if (!isLoaded) {
    return <LoadingSpinner message="Loading..." />;
  }
  
  if (!isSignedIn) {
    return <LoadingSpinner message="Redirecting to sign in..." />;
  }

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      question: "",
      type: "SHORT_ANSWER",
      required: formSettings.defaultRequired
    };
    setQuestions([...questions, newQuestion]);
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length > 1) { // Keep at least one question
      setQuestions(questions.filter(q => q.id !== id));
    }
  };

  const handleDuplicateQuestion = (id: string) => {
    const questionToDuplicate = questions.find(q => q.id === id);
    if (questionToDuplicate) {
      const newQuestion: Question = {
        ...questionToDuplicate,
        id: Date.now().toString(),
        question: questionToDuplicate.question + " (copy)"
      };
      const index = questions.findIndex(q => q.id === id);
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, newQuestion);
      setQuestions(newQuestions);
    }
  };

  const handleUpdateQuestion = (updatedData: {
    id: string;
    question: string;
    description?: string; // Add description field
    type: QuestionType;
    required: boolean;
    options: OptionWithImage[];
    shuffleOptionsOrder?: boolean;
    imageUrl?: string; // Add image URL field
    points?: number;
    correctAnswers?: string[];
  }) => {
    setQuestions((prevQuestions) => {
      const updatedQuestions = prevQuestions.map((q) =>
        q.id === updatedData.id
          ? {
              ...q,
              question: updatedData.question,
              description: updatedData.description,
              type: updatedData.type,
              required: updatedData.required,
              options: updatedData.options,
              shuffleOptionsOrder: updatedData.shuffleOptionsOrder,
              imageUrl: updatedData.imageUrl,
              points: updatedData.points,
              correctAnswers: updatedData.correctAnswers,
            }
          : q
      );
      if (process.env.NODE_ENV === 'development') console.log("Updated questions state:", updatedQuestions);
      return updatedQuestions;
    });
  };

  return (
    <div className="bg-blue-50 flex-1">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        
        {/* Form Header Card - Our Style */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          {/* Blue header bar - Our brand color */}
          <div className="h-3 bg-blue-600 rounded-t-lg"></div>
          
          {/* Form header content */}
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Form title - Google Forms style */}
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full text-xl sm:text-2xl lg:text-3xl font-normal text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1 -mx-2 transition-colors"
              placeholder="Untitled form"
            />
            
            {/* Form description */}
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Form description"
              rows={2}
              className="w-full mt-3 sm:mt-4 text-sm sm:text-base text-gray-600 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1 -mx-2 resize-none transition-colors"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex justify-between items-center">
            <nav className="-mb-px flex space-x-4 sm:space-x-6 lg:space-x-8">
              <button
                onClick={() => setActiveTab('questions')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Questions
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Settings
              </button>
            </nav>
            
            {/* Total Points Display */}
            {formSettings.isQuiz && questions.length > 0 && (
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                <span className="font-medium text-gray-700">
                  Total points: {questions.reduce((total, q) => total + (q.points || 1), 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-6">
        {activeTab === 'questions' && (
          <>
                {/* Questions Section */}
            <div className="space-y-6">
              {questions.map((q) => (
                <QuestionCard 
                  key={q.id}
                  id={q.id}
                  initialQuestion={q.question}
                  initialDescription={q.description || ""} // Pass description to QuestionCard
                  initialType={q.type}
                  initialRequired={q.required}
                  initialOptions={q.options}
                  initialShuffleOptionsOrder={q.shuffleOptionsOrder}
                  initialImageUrl={q.imageUrl || ""}
                  // Quiz props
                  isQuiz={formSettings.isQuiz}
                  initialPoints={q.points || 1}
                  initialCorrectAnswers={q.correctAnswers || []}
                  onDelete={() => handleDeleteQuestion(q.id)}
                  onDuplicate={() => handleDuplicateQuestion(q.id)}
                  onUpdate={handleUpdateQuestion}
                />
              ))}
            </div>

            {/* Add Question Button */}
            <div className="mt-6">
              <button 
                onClick={handleAddQuestion}
                className="flex items-center justify-center sm:justify-start space-x-2 px-4 py-2 w-full sm:w-auto text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Question</span>
              </button>
            </div>
          </>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6">Form Settings</h3>
            
            <div className="space-y-6 sm:space-y-8">
              {/* Question Settings */}
              <div className="space-y-4">
                <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                  Question Settings
                </h4>
                
                {/* Shuffle Questions */}
                <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Shuffle Question Order</label>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Present questions in random order to each respondent
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
                <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Show Progress Bar</label>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Display completion progress to respondents
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
                <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Make Questions Required by Default</label>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
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
              <div className="space-y-4">
                <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                  Response Settings
                </h4>
                
                {/* Collect Email */}
                <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Collect Email Addresses</label>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
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
                <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Allow Multiple Responses</label>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
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
              </div>

              {/* Quiz Settings */}
              <div className="space-y-4">
                <h4 className="text-sm sm:text-base font-medium text-gray-800 border-b border-gray-200 pb-2">
                  Quiz Settings
                </h4>
                
                {/* Make this a quiz */}
                <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Make this a quiz</label>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
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

                {/* Quiz-specific options */}
                {formSettings.isQuiz && (
                  <>
                    {/* Release grades */}
                    <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0 pr-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700">Release grades immediately</label>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
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
                    <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0 pr-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700">Show correct answers</label>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          Display correct answers after quiz submission
                        </p>
                      </div>
                      <button
                        onClick={() => setFormSettings(prev => ({ ...prev, showCorrectAnswers: !prev.showCorrectAnswers }))}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
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
              <div className="space-y-4">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                    rows={3}
                    placeholder="Enter confirmation message..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
          <Link href="/">
            <Button variant="outline">← Back to Home</Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
