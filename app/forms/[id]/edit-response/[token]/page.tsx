'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatTimeRemaining } from '@/lib/editToken';
import { useToast } from '@/hooks/use-toast';

interface FormData {
  id: string;
  title: string;
  description: string;
  questions: any[];
  allowResponseEditing: boolean;
  editTimeLimit: string;
}

interface ResponseData {
  id: string;
  editTokenExpiry: Date | null;
  answers: any[];
}

export default function EditResponsePage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;
  const token = params.token as string;
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData | null>(null);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [answers, setAnswers] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load form and response data
  useEffect(() => {
    loadResponseData();
  }, [formId, token]);

  const loadResponseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch response data with form details
      const response = await fetch(`/api/forms/${formId}/responses/${token}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Response not found or expired');
        return;
      }

      setFormData(data.form);
      setResponseData(data.response);
      
      // Convert answers to form format
      const answerMap: {[key: string]: any} = {};
      data.response.answers.forEach((answer: any) => {
        if (answer.selectedOptions && answer.selectedOptions.length > 0) {
          // Multiple choice answers
          answerMap[answer.questionId] = answer.selectedOptions;
        } else if (answer.answerText) {
          // Text answers
          answerMap[answer.questionId] = answer.answerText;
        }
      });
      
      setAnswers(answerMap);
    } catch (err) {
      console.error('Error loading response:', err);
      setError('Failed to load response data');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData || !responseData) return;

    setSaving(true);
    setError(null);

    try {
      // Validate required fields
      const requiredQuestions = formData.questions.filter(q => q.required);
      for (const question of requiredQuestions) {
        const answer = answers[question.id];
        if (!answer || 
            (typeof answer === 'string' && answer.trim() === '') ||
            (Array.isArray(answer) && answer.length === 0)) {
          setError(`Question "${question.text}" is required`);
          setSaving(false);
          return;
        }
      }

      const updateResponse = await fetch(`/api/forms/${formId}/responses/${token}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responses: answers
        }),
      });

      const result = await updateResponse.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Response updated successfully!",
        });
        router.push('/'); // Redirect to home or success page
      } else {
        setError(result.error || 'Failed to update response');
      }
    } catch (err) {
      console.error('Error updating response:', err);
      setError('Failed to update response');
    } finally {
      setSaving(false);
    }
  };

  const renderQuestion = (question: any) => {
    const currentAnswer = answers[question.id] || '';

    switch (question.type) {
      case 'SHORT_ANSWER':
        return (
          <input
            type="text"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Your answer..."
          />
        );

      case 'PARAGRAPH':
        return (
          <textarea
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
            placeholder="Your answer..."
          />
        );

      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-2">
            {question.options?.map((option: any) => (
              <label key={option.id} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={question.id}
                  value={option.text}
                  checked={currentAnswer === option.text}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
        );

      case 'CHECKBOXES':
        const selectedOptions = Array.isArray(currentAnswer) ? currentAnswer : [];
        return (
          <div className="space-y-2">
            {question.options?.map((option: any) => (
              <label key={option.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option.text}
                  checked={selectedOptions.includes(option.text)}
                  onChange={(e) => {
                    const newSelection = e.target.checked
                      ? [...selectedOptions, option.text]
                      : selectedOptions.filter((item: string) => item !== option.text);
                    handleAnswerChange(question.id, newSelection);
                  }}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
        );

      case 'DROPDOWN':
        return (
          <select
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an option...</option>
            {question.options?.map((option: any) => (
              <option key={option.id} value={option.text}>
                {option.text}
              </option>
            ))}
          </select>
        );

      default:
        return <div>Unsupported question type</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p>Loading your response...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border border-red-200 p-8 max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Cannot Edit Response</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!formData || !responseData) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p>No data found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="h-3 bg-orange-600 rounded-t-lg"></div>
          <div className="p-8">
            <h1 className="text-3xl font-normal text-gray-900 mb-2">
              Edit Response
            </h1>
            <h2 className="text-xl text-gray-700 mb-2">
              {formData.title}
            </h2>
            {formData.description && (
              <p className="text-gray-600">{formData.description}</p>
            )}
            
            {/* Time remaining notice */}
            {responseData.editTokenExpiry && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-orange-800 text-sm font-medium">
                    {formatTimeRemaining(new Date(responseData.editTokenExpiry))} to edit
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {formData.questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-4">
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  {question.text}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </h3>
                {question.description && (
                  <p className="text-sm text-gray-600 mb-3">{question.description}</p>
                )}
              </div>
              
              {renderQuestion(question)}
            </div>
          ))}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Updating...' : 'Update Response'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}