import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/services/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth();
    const userId = authResult.userId;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: formId } = await params;

    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        createdBy: userId // Ensure user owns this form
      },
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
        { success: false, error: 'Form not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        published: form.published,
        acceptingResponses: form.acceptingResponses,
        shuffleQuestions: form.shuffleQuestions,
        collectEmail: form.collectEmail,
        allowMultipleResponses: form.allowMultipleResponses,
        showProgress: form.showProgress,
        confirmationMessage: form.confirmationMessage,
        defaultRequired: form.defaultRequired,
        // Quiz settings
        isQuiz: form.isQuiz,
        showCorrectAnswers: form.showCorrectAnswers,
        releaseGrades: form.releaseGrades,
        // Theme settings
        themeColor: form.themeColor,
        themeBackground: form.themeBackground,
        sections: form.sections.map(section => ({
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
            // Quiz fields
            points: question.points,
            correctAnswers: question.correctAnswers,
            // Option settings
            shuffleOptionsOrder: question.shuffleOptionsOrder,
            options: question.options.map(option => ({
              id: option.id,
              text: option.text,
              imageUrl: option.imageUrl
            }))
          }))
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update existing form
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth();
    const userId = authResult.userId;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: formId } = await params;
    const data = await request.json();
    const { title, description, questions, published, settings } = data;

    // Verify form ownership
    const existingForm = await prisma.form.findFirst({
      where: {
        id: formId,
        createdBy: userId
      }
    });

    if (!existingForm) {
      return NextResponse.json(
        { success: false, error: 'Form not found or access denied' },
        { status: 404 }
      );
    }

    // TODO: Fix these operations for sections-based structure
    // Delete existing answers first (to avoid constraint violation)
    // await prisma.answer.deleteMany({
    //   where: {
    //     question: {
    //       section: {
    //         formId: formId
    //       }
    //     }
    //   }
    // });

    // Delete existing questions and their options  
    // await prisma.option.deleteMany({
    //   where: {
    //     question: {
    //       section: {
    //         formId: formId
    //       }
    //     }
    //   }
    // });

    // await prisma.question.deleteMany({
    //   where: {
    //     section: {
    //       formId: formId
    //     }
    //   }
    // });

    // Delete existing sections
    await prisma.section.deleteMany({
      where: {
        formId: formId
      }
    });

    // Update form with new data
    const updatedForm = await prisma.form.update({
      where: { id: formId },
      data: {
        title,
        description,
        published: published ?? existingForm.published,
        // Form settings
        shuffleQuestions: settings?.shuffleQuestions ?? existingForm.shuffleQuestions,
        collectEmail: settings?.collectEmail ?? existingForm.collectEmail,
        allowMultipleResponses: settings?.allowMultipleResponses ?? existingForm.allowMultipleResponses,
        showProgress: settings?.showProgress ?? existingForm.showProgress,
        confirmationMessage: settings?.confirmationMessage ?? existingForm.confirmationMessage,
        defaultRequired: settings?.defaultRequired ?? existingForm.defaultRequired,
        // Quiz settings
        isQuiz: settings?.isQuiz ?? existingForm.isQuiz,
        showCorrectAnswers: settings?.showCorrectAnswers ?? existingForm.showCorrectAnswers,
        releaseGrades: settings?.releaseGrades ?? existingForm.releaseGrades,
        // Response editing settings (automatically disabled if quiz mode)
        allowResponseEditing: ((settings?.isQuiz ?? existingForm.isQuiz) ? false : (settings?.allowResponseEditing ?? existingForm.allowResponseEditing)),
        editTimeLimit: settings?.editTimeLimit ?? existingForm.editTimeLimit,
        sections: {
          create: [{
            title: "Section 1",
            description: null,
            order: 0,
            questions: {
              create: questions.map((question: any, index: number) => ({
                text: question.question || question.text,
                type: question.type,
                required: question.required || false,
                imageUrl: question.imageUrl || null,
                // Quiz fields
                points: question.points || 1,
                correctAnswers: question.correctAnswers || [],
                // Option settings
                shuffleOptionsOrder: question.shuffleOptionsOrder || false,
                options: question.options
                  ? {
                      create: question.options.map((option: any, optionIndex: number) => ({
                        text: typeof option === 'string' ? option : option.text,
                        imageUrl: typeof option === 'string' ? null : (option.imageUrl || null)
                      }))
                    }
                  : undefined
              }))
            }
          }]
        }
      },
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

    return NextResponse.json({
      success: true,
      message: published ? 'Form published successfully!' : 'Form updated successfully!',
      formId: updatedForm.id
    });

  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}