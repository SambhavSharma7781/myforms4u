import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/services/prisma';
import { generateEditToken, calculateTokenExpiry } from '@/lib/editToken';

// POST: Submit form response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formId } = await params;
    const body = await request.json();
    const { responses, email, totalScore, maxScore, quizResults } = body;



    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        sections: {
          include: {
            questions: {
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    if (!form) {
      return NextResponse.json(
        { success: false, error: 'Form not found' },
        { status: 404 }
      );
    }

    if (form.collectEmail) {
      if (!email || !email.trim()) {
        return NextResponse.json(
          { success: false, error: 'Email address is required' },
          { status: 400 }
        );
      }
      
      // Basic email validation
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid email address' },
          { status: 400 }
        );
      }
    }

    // Check multiple responses setting
    // Note: For anonymous users, multiple response validation is handled on the frontend
    // using localStorage. For logged-in users, you could add server-side validation here.
    
    const allQuestions = form.sections.flatMap(section => section.questions);
    const requiredQuestions = allQuestions.filter(q => q.required);
    for (const question of requiredQuestions) {
      const response = responses[question.id];
      if (!response || 
          (typeof response === 'string' && response.trim() === '') ||
          (Array.isArray(response) && response.length === 0)) {
        return NextResponse.json(
          { success: false, error: `Question "${question.text}" is required` },
          { status: 400 }
        );
      }
    }

    let editToken = null;
    let editTokenExpiry = null;
    
    if (form.allowResponseEditing && !form.isQuiz) {
      editToken = generateEditToken();
      editTokenExpiry = calculateTokenExpiry(form.editTimeLimit || '24h');
    }

    const responseRecord = await prisma.response.create({
      data: {
        formId: formId,
        email: form.collectEmail ? email : null,
        // Quiz fields
        totalScore: totalScore ?? null,
        maxScore: maxScore || null,
        // Edit token fields
        editToken: editToken,
        editTokenExpiry: editTokenExpiry,
        // userId is optional for anonymous responses
      }
    });

    const answerPromises = Object.entries(responses).map(async ([questionId, answerData]) => {
      const question = allQuestions.find(q => q.id === questionId);
      if (!question) {
        return null;
      }

      let answerText = null;
      let selectedOptions: string[] = [];
      let isCorrect = null;
      let pointsEarned = null;

      // Handle different answer types
      if (typeof answerData === 'string') {
        // Single text answer or single choice
        answerText = answerData;
        selectedOptions = []; // Empty for single answers
      } else if (Array.isArray(answerData)) {
        // Multiple choice (checkboxes)
        selectedOptions = answerData.filter(item => item && item.trim() !== ''); // Filter out empty strings
        answerText = selectedOptions.join(', '); // Store as comma-separated text too
      } else {
      }

      // Add quiz result data if available
      if (quizResults && quizResults[questionId]) {
        isCorrect = quizResults[questionId].isCorrect;
        pointsEarned = quizResults[questionId].pointsEarned;
      }

      const answerRecord = await prisma.answer.create({
        data: {
          responseId: responseRecord.id,
          questionId: questionId,
          answerText: answerText,
          selectedOptions: selectedOptions,
          isCorrect: isCorrect,
          pointsEarned: pointsEarned,
        }
      });

      return answerRecord;
    });

    // Execute all answer creation promises
    const createdAnswers = await Promise.all(answerPromises.filter(promise => promise !== null));
    

    // Prepare response with edit link if editing is enabled
    const responseData: any = {
      success: true,
      message: 'Response submitted successfully',
      confirmationMessage: form.confirmationMessage || 'Your response has been recorded.',
      responseId: responseRecord.id
    };

    // Add edit link if response editing is enabled
    if (editToken) {
      responseData.editLink = `/forms/${formId}/edit-response/${editToken}`;
      responseData.canEdit = true;
      responseData.editExpiresAt = editTokenExpiry;
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}