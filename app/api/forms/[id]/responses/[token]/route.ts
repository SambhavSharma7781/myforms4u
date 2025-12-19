import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/services/prisma';
import { isTokenValid } from '@/lib/editToken';

// GET: Fetch response data for editing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const { id: formId, token } = await params;


    // Find response by token
    const response = await prisma.response.findFirst({
      where: {
        formId: formId,
        editToken: token
      },
      include: {
        answers: true,
        form: {
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
        }
      }
    });

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'Response not found or invalid token' },
        { status: 404 }
      );
    }

    // Check if form allows editing
    if (!response.form.allowResponseEditing) {
      return NextResponse.json(
        { success: false, error: 'Response editing is not enabled for this form' },
        { status: 403 }
      );
    }

    // Check if quiz mode (should not allow editing)
    if (response.form.isQuiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz responses cannot be edited' },
        { status: 403 }
      );
    }

    // Check if token is still valid
    if (!isTokenValid(response.editTokenExpiry)) {
      return NextResponse.json(
        { success: false, error: 'Edit time limit has expired' },
        { status: 403 }
      );
    }

    // Return form and response data
    return NextResponse.json({
      success: true,
      form: {
        id: response.form.id,
        title: response.form.title,
        description: response.form.description,
        allowResponseEditing: response.form.allowResponseEditing,
        editTimeLimit: response.form.editTimeLimit,
        sections: response.form.sections.map(section => ({
          id: section.id,
          title: section.title,
          description: section.description,
          order: section.order,
          questions: section.questions.map(question => ({
            id: question.id,
            text: question.text,
            description: question.description,
            type: question.type,
            required: question.required,
            imageUrl: question.imageUrl,
            points: question.points,
            correctAnswers: question.correctAnswers,
            shuffleOptionsOrder: question.shuffleOptionsOrder,
            options: question.options.map(option => ({
              id: option.id,
              text: option.text,
              imageUrl: option.imageUrl
            }))
          }))
        }))
      },
      response: {
        id: response.id,
        editTokenExpiry: response.editTokenExpiry,
        answers: response.answers
      }
    });

  } catch (error) {
    console.error('Error fetching response for editing:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update response
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const { id: formId, token } = await params;
    const body = await request.json();
    const { responses } = body;


    // Find response by token
    const responseRecord = await prisma.response.findFirst({
      where: {
        formId: formId,
        editToken: token
      },
      include: {
        form: {
          include: {
            sections: {
              include: {
                questions: true
              }
            }
          }
        },
        answers: true
      }
    });

    if (!responseRecord) {
      return NextResponse.json(
        { success: false, error: 'Response not found or invalid token' },
        { status: 404 }
      );
    }

    // Check if form allows editing
    if (!responseRecord.form.allowResponseEditing) {
      return NextResponse.json(
        { success: false, error: 'Response editing is not enabled for this form' },
        { status: 403 }
      );
    }

    // Check if quiz mode
    if (responseRecord.form.isQuiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz responses cannot be edited' },
        { status: 403 }
      );
    }

    // Check if token is still valid
    if (!isTokenValid(responseRecord.editTokenExpiry)) {
      return NextResponse.json(
        { success: false, error: 'Edit time limit has expired' },
        { status: 403 }
      );
    }

    // Validate required fields
    const allQuestions = responseRecord.form.sections.flatMap(section => section.questions);
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

    // Delete existing answers
    await prisma.answer.deleteMany({
      where: {
        responseId: responseRecord.id
      }
    });

    // Create new answers
    const answerPromises = Object.entries(responses).map(async ([questionId, answerData]) => {
      
      let answerText = null;
      let selectedOptions: string[] = [];

      // Handle different answer types (same logic as submit)
      if (typeof answerData === 'string') {
        answerText = answerData;
        selectedOptions = [];
      } else if (Array.isArray(answerData)) {
        selectedOptions = answerData.filter(item => item && item.trim() !== '');
        answerText = selectedOptions.join(', ');
      }

      return await prisma.answer.create({
        data: {
          responseId: responseRecord.id,
          questionId: questionId,
          answerText: answerText,
          selectedOptions: selectedOptions,
          // Note: Quiz fields (isCorrect, pointsEarned) not relevant for regular forms
        }
      });
    });

    await Promise.all(answerPromises);


    return NextResponse.json({
      success: true,
      message: 'Response updated successfully'
    });

  } catch (error) {
    console.error('Error updating response:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}