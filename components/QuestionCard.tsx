"use client";

import { useState, useEffect } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUpload from "@/components/ImageUpload";
import { 
  MoreVertical, 
  Copy, 
  Trash2, 
  Plus,
  ToggleLeft,
  ToggleRight,
  Shuffle
} from "lucide-react";

type QuestionType = "SHORT_ANSWER" | "PARAGRAPH" | "MULTIPLE_CHOICE" | "CHECKBOXES" | "DROPDOWN";

interface OptionWithImage {
  text: string;
  imageUrl?: string;
}

interface QuestionCardProps {
  id?: string;
  initialQuestion?: string;
  initialDescription?: string;
  initialType?: QuestionType;
  initialRequired?: boolean;
  initialOptions?: OptionWithImage[];
  initialShuffleOptionsOrder?: boolean;
  initialImageUrl?: string;
  isQuiz?: boolean;
  initialPoints?: number;
  initialCorrectAnswers?: string[];
  themeColor?: string;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onAddSectionAfter?: () => void; // 🆕 NEW: Add section after this question
  onUpdate?: (data: {
    id: string;
    question: string;
    description?: string;
    type: QuestionType;
    required: boolean;
    options: OptionWithImage[];
    shuffleOptionsOrder?: boolean;
    imageUrl?: string;
    points?: number;
    correctAnswers?: string[];
  }) => void;
}

export default function QuestionCard({
  id,
  initialQuestion = "",
  initialDescription = "",
  initialType = "SHORT_ANSWER",
  initialRequired = false,
  initialOptions = [],
  initialShuffleOptionsOrder = false,
  initialImageUrl = "",
  isQuiz = false,
  initialPoints = 1,
  initialCorrectAnswers = [],
  themeColor = "#4285F4",
  onDelete,
  onDuplicate,
  onAddSectionAfter, // 🆕 NEW: Add section callback
  onUpdate
}: QuestionCardProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [description, setDescription] = useState(initialDescription);
  const [showDescription, setShowDescription] = useState(!!initialDescription);
  const [questionType, setQuestionType] = useState<QuestionType>(initialType);
  const [required, setRequired] = useState(initialRequired);
  const [isEditing, setIsEditing] = useState(!initialQuestion);
  const [shuffleOptionsOrder, setShuffleOptionsOrder] = useState(initialShuffleOptionsOrder);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');
  const [menuSide, setMenuSide] = useState<'left' | 'right'>('left');
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [points, setPoints] = useState(initialPoints);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(() => {
    if (initialCorrectAnswers.length > 0) {
      return initialCorrectAnswers;
    }
    if (questionType === 'SHORT_ANSWER' || questionType === 'PARAGRAPH') {
      return [''];
    }
    return [];
  });
  const [options, setOptions] = useState<OptionWithImage[]>(() => {
    if (initialOptions.length > 0) {
      return initialOptions;
    }
    if (questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOXES" || questionType === "DROPDOWN") {
      return [{ text: "Option 1", imageUrl: undefined }, { text: "", imageUrl: undefined }];
    }
    return [];
  });

  const notifyParent = () => {
    if (onUpdate && id) {
      const filteredOptions = options.filter(opt => opt.text.trim() !== "" || opt.imageUrl);
      
      onUpdate({
        id,
        question,
        description: description || undefined,
        type: questionType,
        required,
        options: filteredOptions,
        shuffleOptionsOrder,
        imageUrl: imageUrl || undefined,
        points: isQuiz ? points : undefined,
        correctAnswers: isQuiz ? correctAnswers : undefined
      });
    }
  };

  useEffect(() => {
    notifyParent();
  }, [question, description, questionType, required, options, shuffleOptionsOrder, imageUrl, points, correctAnswers, isQuiz]);
  
  useEffect(() => {
    if (questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOXES" || questionType === "DROPDOWN") {
      if (options.length === 0) {
        setOptions([{ text: "Option 1", imageUrl: undefined }, { text: "", imageUrl: undefined }]);
      }
    } else {
      if (options.length > 0) {
        setOptions([]);
      }
    }
  }, [questionType]);

  const handleImageUpload = (newImageUrl: string) => {
    setImageUrl(newImageUrl);
  };

  const handleImageRemove = () => {
    setImageUrl('');
  };

  const handleMenuToggle = (event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const buttonRect = target.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const menuHeight = 350; // approximate
    const menuWidth = 300; // approximate

    // Vertical placement
    if (buttonRect.bottom + menuHeight > windowHeight) {
      setMenuPosition('top');
    } else {
      setMenuPosition('bottom');
    }

    // Horizontal placement - prefer left unless not enough space
    const spaceRight = windowWidth - buttonRect.right;
    if (spaceRight < menuWidth) {
      setMenuSide('right');
    } else {
      setMenuSide('left');
    }

    setShowOptionsMenu((prev) => !prev);
  };

  const questionTypes = [
    { value: "SHORT_ANSWER", label: "Short answer" },
    { value: "PARAGRAPH", label: "Paragraph" },
    { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
    { value: "CHECKBOXES", label: "Checkboxes" },
    { value: "DROPDOWN", label: "Dropdown" }
  ];

  const handleTypeChange = (newType: QuestionType) => {
    setQuestionType(newType);
    
    // Initialize correct answers for text questions
    if ((newType === 'SHORT_ANSWER' || newType === 'PARAGRAPH') && correctAnswers.length === 0) {
      setCorrectAnswers(['']);
    }
  };

  const addOption = () => {
    setOptions([...options, { text: "", imageUrl: undefined }]);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text: value };
    setOptions(newOptions);
  };

  const updateOptionImage = (index: number, imageUrl?: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], imageUrl };
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length > 1) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const renderQuestionInput = () => {
    switch (questionType) {
      case "SHORT_ANSWER":
        return (
          <div className="mt-6">
            <input
              type="text"
              placeholder="Short answer text"
              disabled
              className="w-full border-b border-gray-300 pb-2 text-gray-400 text-sm bg-transparent outline-none"
            />
          </div>
        );
      
      case "PARAGRAPH":
        return (
          <div className="mt-6">
            <textarea
              placeholder="Long answer text"
              disabled
              rows={3}
              className="w-full border border-gray-300 rounded p-3 text-gray-400 text-sm bg-transparent outline-none resize-none"
            />
          </div>
        );
      
      case "MULTIPLE_CHOICE":
        return (
          <div className="mt-6 space-y-4">
            {options.map((option, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                {/* Option Header */}
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 border-b border-gray-300 pb-1 outline-none focus:border-blue-500 bg-transparent"
                  />
                  {options.length > 1 && (
                    <button
                      onClick={() => removeOption(index)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Option Image Section */}
                <div className="ml-7">
                  <ImageUpload
                    imageUrl={option.imageUrl}
                    onImageUpload={(imageUrl) => updateOptionImage(index, imageUrl)}
                    onImageRemove={() => updateOptionImage(index, undefined)}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addOption}
              className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add option</span>
            </button>
          </div>
        );
      
      case "CHECKBOXES":
        return (
          <div className="mt-6 space-y-4">
            {options.map((option, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                {/* Option Header */}
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 border-b border-gray-300 pb-1 outline-none focus:border-blue-500 bg-transparent"
                  />
                  {options.length > 1 && (
                    <button
                      onClick={() => removeOption(index)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Option Image Section */}
                <div className="ml-7">
                  <ImageUpload
                    imageUrl={option.imageUrl}
                    onImageUpload={(imageUrl) => updateOptionImage(index, imageUrl)}
                    onImageRemove={() => updateOptionImage(index, undefined)}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addOption}
              className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add option</span>
            </button>
          </div>
        );
      
      case "DROPDOWN":
        return (
          <div className="mt-6">
            <div className="relative">
              <select disabled className="w-full appearance-none border border-gray-300 rounded-md px-4 py-3 text-gray-500 text-sm bg-gray-50 cursor-not-allowed shadow-sm">
                <option>Choose an option</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {options.map((option, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {/* Option Header */}
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-gray-400 text-sm">{index + 1}.</span>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 border-b border-gray-300 pb-1 outline-none focus:border-blue-500 bg-transparent"
                    />
                    {options.length > 1 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {/* Option Image Section */}
                  <div className="ml-6">
                    <ImageUpload
                      imageUrl={option.imageUrl}
                      onImageUpload={(imageUrl) => updateOptionImage(index, imageUrl)}
                      onImageRemove={() => updateOptionImage(index, undefined)}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addOption}
                className="flex items-center space-x-2 text-gray-500 hover:text-blue-600 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add option</span>
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6 group hover:shadow-md transition-all duration-200 relative" style={{ overflow: 'visible' }}>
      {/* Left accent - perfectly rounded corners */}
      <div 
        className="absolute left-0 top-0 w-1" 
        style={{ 
          height: '100%', 
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px',
          backgroundColor: themeColor
        }}
      ></div>
      
      <div className="pl-8 pr-6 py-6">
        
        {/* Question header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 pr-4">
            <RichTextEditor
              value={question || ''}
              onChange={(value) => setQuestion(value)}
              placeholder="Untitled question"
              className="w-full text-lg font-medium text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 rounded-md px-3 py-2.5 -mx-3 transition-colors"
              style={{ minHeight: '40px', lineHeight: '1.5' }}
            />
            
            {/* Description input - Shows when user enables it from 3-dot menu */}
            {showDescription && (
                <div className="mt-4">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add description"
                    rows={2}
                    className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:bg-gray-50 rounded-md px-3 py-2 -mx-3 transition-colors resize-none"
                    style={{ lineHeight: '1.4' }}
                  />
                </div>
              )}
              
              {/* Image Upload Component */}
              <div className="mt-4">
                <ImageUpload
                  imageUrl={imageUrl}
                  onImageUpload={handleImageUpload}
                  onImageRemove={handleImageRemove}
                />
              </div>
            </div>
            
            {/* Question type selector - Professional styling */}
            <div className="relative flex-shrink-0">
              <select
                value={questionType}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 outline-none cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md min-w-[140px]"
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {/* Custom dropdown arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Question input area */}
          {renderQuestionInput()}

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            {/* Required toggle */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 font-medium">Required</span>
              <button
                onClick={() => setRequired(!required)}
                className={`transition-colors`}
                style={{ color: required ? themeColor : '#9CA3AF' }}
                title={required ? 'Make optional' : 'Make required'}
              >
                {required ? <ToggleRight className="w-8 h-5" /> : <ToggleLeft className="w-8 h-5" />}
              </button>
            </div>
            
            <div className="flex items-center space-x-1">
              {/* Action buttons */}
              <button
                onClick={onDuplicate}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Duplicate question"
              >
                <Copy className="w-4 h-4" />
              </button> 
              
              <button
                onClick={onDelete}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Delete question"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              {/* 3-dots menu - now available for all question types */}
              <div className="relative z-10">
                <button 
                  onClick={handleMenuToggle}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 relative z-20 transform hover:scale-105"
                  title="Question Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {/* Dropdown Menu */}
                {showOptionsMenu && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-50" 
                      onClick={() => setShowOptionsMenu(false)}
                    />
                    
                    {/* Menu Content - Professional absolute positioning */}
                    <div className={`absolute bg-white rounded-xl shadow-2xl border border-gray-200 max-h-96 overflow-y-auto w-72 transform transition-all duration-200 ease-out ${
                      menuPosition === 'top' 
                        ? 'bottom-full mb-2' 
                        : 'top-full mt-2'
                    } ${
                      menuSide === 'left' 
                        ? 'left-0 origin-top-left' 
                        : 'right-0 origin-top-right'
                    }`}
                         style={{ 
                           boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.08)',
                           minWidth: '280px',
                           zIndex: 1000
                         }}>
                      {/* Show shuffle option only for option-based questions */}
                      {(questionType === "MULTIPLE_CHOICE" || questionType === "CHECKBOXES" || questionType === "DROPDOWN") && (
                        <div className="p-1">
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                            Question Options
                          </div>
                          
                          <button
                            onClick={() => {
                              setShuffleOptionsOrder(!shuffleOptionsOrder);
                              setShowOptionsMenu(false);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 group rounded-lg mx-1 my-1"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`p-1.5 rounded-md ${shuffleOptionsOrder ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'} transition-colors`}>
                                <Shuffle className="w-3.5 h-3.5" />
                              </div>
                              <div className="text-left">
                                <div className="font-medium">Shuffle Options Order</div>
                                <div className="text-xs text-gray-500 mt-0.5">Randomize option order for respondents</div>
                              </div>
                            </div>
                            <div 
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${shuffleOptionsOrder ? 'border-2' : 'border-gray-300 group-hover:border-gray-400'}`}
                              style={shuffleOptionsOrder ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
                            >
                              {shuffleOptionsOrder && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </button>
                        </div>
                      )}
                      
                      {/* Description Option - Available for all question types */}
                      <div className="p-1 border-t border-gray-100">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Additional Fields
                        </div>
                        
                        <button
                          onClick={() => {
                            setShowDescription(!showDescription);
                            setShowOptionsMenu(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 group rounded-lg mx-1 my-1"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-1.5 rounded-md ${showDescription ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'} transition-colors`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-medium">Description</div>
                              <div className="text-xs text-gray-500 mt-0.5">Add helper text for this question</div>
                            </div>
                          </div>
                          <div 
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${showDescription ? 'border-2' : 'border-gray-300 group-hover:border-gray-400'}`}
                            style={showDescription ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
                          >
                            {showDescription && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      </div>
                      
                      {/* 🆕 Section Management */}
                      <div className="p-1 border-t border-gray-100">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Section Management
                        </div>
                        
                        <button
                          onClick={() => {
                            onAddSectionAfter?.();
                            setShowOptionsMenu(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-all duration-200 group rounded-lg mx-1 my-1"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-1.5 rounded-md bg-gray-100 text-gray-500 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-medium">Add Section After This</div>
                              <div className="text-xs text-gray-500 mt-0.5">Create a new section after this question</div>
                            </div>
                          </div>
                        </button>
                      </div>
                      
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quiz Configuration */}
          {isQuiz && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-blue-900">Quiz Settings</h4>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-blue-700">Points:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={points}
                    onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1.5 text-sm border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Correct Answer Configuration */}
              {(questionType === 'MULTIPLE_CHOICE' || questionType === 'CHECKBOXES') && options.length > 0 && (
                <div>
                  <p className="text-sm text-blue-700 mb-2">
                    {questionType === 'MULTIPLE_CHOICE' ? 'Select the correct answer:' : 'Select all correct answers:'}
                  </p>
                  <div className="space-y-2">
                    {options.map((option, index) => (
                      option.text.trim() && (
                        <label key={index} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type={questionType === 'MULTIPLE_CHOICE' ? 'radio' : 'checkbox'}
                            name={`correct-${id}`}
                            value={option.text}
                            checked={correctAnswers.includes(option.text)}
                            onChange={(e) => {
                              if (questionType === 'MULTIPLE_CHOICE') {
                                // Single selection for multiple choice
                                setCorrectAnswers([option.text]); // Always set to the clicked option
                              } else {
                                // Multiple selection for checkboxes
                                if (e.target.checked) {
                                  setCorrectAnswers([...correctAnswers, option.text]);
                                } else {
                                  setCorrectAnswers(correctAnswers.filter(ans => ans !== option.text));
                                }
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-blue-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-800">{option.text}</span>
                        </label>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Text question answer input */}
              {(questionType === 'SHORT_ANSWER' || questionType === 'PARAGRAPH') && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Correct Answer(s) - Add multiple acceptable answers
                    </label>
                    <div className="space-y-2">
                      {correctAnswers.map((answer, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={answer}
                            onChange={(e) => {
                              const newAnswers = [...correctAnswers];
                              newAnswers[index] = e.target.value;
                              setCorrectAnswers(newAnswers);
                              notifyParent();
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder={`Correct answer ${index + 1}`}
                          />
                          {correctAnswers.length > 1 && (
                            <button
                              onClick={() => {
                                const newAnswers = correctAnswers.filter((_, i) => i !== index);
                                setCorrectAnswers(newAnswers);
                                notifyParent();
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          setCorrectAnswers([...correctAnswers, '']);
                          notifyParent();
                        }}
                        className="flex items-center space-x-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add another acceptable answer</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
    </div>
  );
}