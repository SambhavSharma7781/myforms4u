import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/services/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Please sign in to create forms" },
        { status: 401 }
      );
    }

    // Get data from request
    const data = await request.json();
    const { title, description, questions, sections, published = false, settings } = data;

    // Create or find user in our database
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      // Get real user data from Clerk
      const clerkUser = await currentUser();
      const userEmail = clerkUser?.emailAddresses[0]?.emailAddress || "no-email@example.com";
      
      // Create user with real email
      user = await prisma.user.create({
        data: { 
          id: userId,
          email: userEmail
        }
      });
    }

    const form = await prisma.form.create({
      data: {
        title,
        description,
        published,
        createdBy: userId,
        // Form settings
        shuffleQuestions: settings?.shuffleQuestions || false,
        collectEmail: settings?.collectEmail || false,
        allowMultipleResponses: settings?.allowMultipleResponses ?? true,
        showProgress: settings?.showProgress ?? true,
        confirmationMessage: settings?.confirmationMessage || 'Your response has been recorded.',
        defaultRequired: settings?.defaultRequired || false,
        // Quiz settings
        isQuiz: settings?.isQuiz || false,
        showCorrectAnswers: settings?.showCorrectAnswers ?? true,
        releaseGrades: settings?.releaseGrades ?? true,
        // Response editing settings (automatically disabled if quiz mode)
        allowResponseEditing: (settings?.isQuiz ? false : (settings?.allowResponseEditing || false)),
        editTimeLimit: settings?.editTimeLimit || '24h'
      }
    });

    if (sections && sections.length > 0) {
      // Create sections with their questions
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const sectionData = sections[sectionIndex];
        
        const createdSection = await prisma.section.create({
          data: {
            title: sectionData.title ?? "",
            description: sectionData.description ?? "",
            order: sectionIndex,
            formId: form.id
          }
        });

        // Create questions for this section
        if (sectionData.questions && sectionData.questions.length > 0) {
          for (const question of sectionData.questions) {
            const createdQuestion = await prisma.question.create({
              data: {
                text: question.text || '',
                description: question.description || null,
                type: question.type || 'SHORT_ANSWER',
                required: question.required || false,
                imageUrl: question.imageUrl || null,
                sectionId: createdSection.id,
                points: question.points || 1,
                correctAnswers: question.correctAnswers || [],
                shuffleOptionsOrder: question.shuffleOptionsOrder || false
              }
            });

            // Create options for the question if they exist
            if (question.options && question.options.length > 0) {
              await prisma.option.createMany({
                data: question.options
                  .filter((opt: any) => opt.text?.trim()) // Only save options with text
                  .map((option: any) => ({
                    text: option.text,
                    imageUrl: option.imageUrl || null,
                    questionId: createdQuestion.id
                  }))
              });
            }
          }
        }
      }
    } else if (questions && questions.length > 0) {
      // Legacy: Create questions with default section (for backward compatibility)
      const defaultSection = await prisma.section.create({
        data: {
          title: "Section 1",
          description: null,
          order: 0,
          formId: form.id
        }
      });

      // Create questions for the default section
      for (const question of questions) {
        const questionText = question.question || question.text || '';
        const createdQuestion = await prisma.question.create({
          data: {
            text: questionText.trim() === '' ? 'Untitled Question' : questionText,
            description: question.description || null,
            type: question.type,
            required: question.required || false,
            imageUrl: question.imageUrl || null,
            sectionId: defaultSection.id,
            points: question.points || 1,
            correctAnswers: question.correctAnswers || [],
            shuffleOptionsOrder: question.shuffleOptionsOrder || false
          }
        });

        // Create options for the question if they exist
        if (question.options && question.options.length > 0) {
          await prisma.option.createMany({
            data: question.options.map((option: any) => ({
              text: typeof option === 'string' ? option : option.text,
              imageUrl: typeof option === 'string' ? null : (option.imageUrl || null),
              questionId: createdQuestion.id
            }))
          });
        }
      }
    } else {
      // Create a default empty section
      await prisma.section.create({
        data: {
          title: "Section 1",
          description: null,
          order: 0,
          formId: form.id
        }
      });
    }

    // Fetch the complete form with sections, questions and options
    const completeForm = await prisma.form.findUnique({
      where: { id: form.id },
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
      message: "Form saved successfully!",
      formId: form.id 
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error saving form: ${error}` },
      { status: 500 }
    );
  }
}