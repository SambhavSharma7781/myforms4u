import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/services/prisma';

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
    const body = await request.json();
    const { title, description, questions, sections, published = false, acceptingResponses = true, settings } = body;

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

    // Check if form has existing responses
    const hasResponses = await prisma.response.count({
      where: { formId: formId }
    }) > 0;

    // Update form in transaction
    await prisma.$transaction(async (tx) => {
      // Update form title, description, published status, accepting responses, and settings
      // Declare updatedForm outside the try block
      let updatedForm = null;
      try {
        updatedForm = await tx.form.update({
          where: { id: formId },
          data: {
            title,
            description,
            published,
            acceptingResponses,
            // Update form settings if provided
            ...(settings && {
              shuffleQuestions: settings.shuffleQuestions || false,
              collectEmail: settings.collectEmail || false,
              allowMultipleResponses: settings.allowMultipleResponses ?? true,
              showProgress: settings.showProgress ?? true,
              confirmationMessage: settings.confirmationMessage || 'Your response has been recorded.',
              defaultRequired: settings.defaultRequired || false,
              isQuiz: settings.isQuiz || false,
              showCorrectAnswers: settings.showCorrectAnswers ?? true,
              releaseGrades: settings.releaseGrades ?? true,
              allowResponseEditing: (settings.isQuiz ? false : (settings.allowResponseEditing || false)),
              editTimeLimit: settings.editTimeLimit || '24h',
              themeColor: settings.themeColor || '#4285F4',
              themeBackground: settings.themeBackground || 'rgba(66, 133, 244, 0.1)'
            })
          }
        });
        
        // Add a small delay after the update to ensure database consistency
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('❌ ERROR - Failed to update form:', error);
        throw error;
      }

      if (!hasResponses) {
        // If no responses exist, we can safely delete and recreate all data
        // Delete existing data in correct order (due to foreign key constraints)
        // 1. Delete options first
        await tx.option.deleteMany({
          where: {
            question: {
              section: {
                formId: formId
              }
            }
          }
        });

        // 2. Then delete questions
        await tx.question.deleteMany({
          where: { 
            section: {
              formId: formId
            }
          }
        });

        // 3. Then delete sections
        await tx.section.deleteMany({
          where: { formId: formId }
        });

        // Handle sections or legacy questions
        if (sections && sections.length > 0) {
          // Create sections with their questions
          for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const sectionData = sections[sectionIndex];
            
            const createdSection = await tx.section.create({
              data: {
                title: sectionData.title || `Section ${sectionIndex + 1}`,
                description: sectionData.description || null,
                order: sectionIndex,
                formId: formId
              }
            });

            // Create questions for this section
            if (sectionData.questions && sectionData.questions.length > 0) {
              for (const question of sectionData.questions) {
                const createdQuestion = await tx.question.create({
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
                  await tx.option.createMany({
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
          const defaultSection = await tx.section.create({
            data: {
              title: "Section 1",
              description: null,
              order: 0,
              formId: formId
            }
          });

          for (const question of questions) {
            const createdQuestion = await tx.question.create({
              data: {
                text: question.text,
                description: question.description || null,
                type: question.type,
                required: question.required,
                imageUrl: question.imageUrl || null,
                sectionId: defaultSection.id,
                points: question.points || 1,
                correctAnswers: question.correctAnswers || [],
                shuffleOptionsOrder: question.shuffleOptionsOrder || false
              }
            });

            // Create options if question type requires them
            if ((question.type === 'MULTIPLE_CHOICE' || question.type === 'CHECKBOXES' || question.type === 'DROPDOWN') && question.options.length > 0) {
              await tx.option.createMany({
                data: question.options.map((option: any) => ({
                  text: typeof option === 'string' ? option : option.text,
                  imageUrl: typeof option === 'string' ? null : (option.imageUrl || null),
                  questionId: createdQuestion.id
                }))
              });
            }
          }
        }
      } else {
        // If responses exist, we need to be more careful to preserve existing data
        // We can still update section titles and descriptions safely
        
        // Handle sections - update existing ones and create new ones
        if (sections && sections.length > 0) {
          
          // First, process all sections (update existing, create new)
          // This must happen BEFORE deleting sections, so moved questions don't get deleted
          for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const sectionData = sections[sectionIndex];
            
            if (sectionData.id && !sectionData.id.startsWith('temp_')) {
              // Update existing section
              await tx.section.update({
                where: { id: sectionData.id },
                data: {
                  title: sectionData.title || 'Untitled Section',
                  description: sectionData.description || null,
                  order: sectionIndex
                }
              });

              // Also handle questions in existing sections (new questions or updates)
              if (sectionData.questions && sectionData.questions.length > 0) {
                for (const question of sectionData.questions) {
                  if (question.id && !question.id.startsWith('temp_')) {
                    // Existing question - update it (including sectionId in case it was moved)
                    await tx.question.update({
                      where: { id: question.id },
                      data: {
                        text: question.text,
                        description: question.description || null,
                        type: question.type,
                        required: question.required,
                        imageUrl: question.imageUrl || null,
                        sectionId: sectionData.id, // Update sectionId in case question was moved
                        points: question.points || 1,
                        correctAnswers: question.correctAnswers || [],
                        shuffleOptionsOrder: question.shuffleOptionsOrder || false
                      }
                    });

                    // Update options
                    if (['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(question.type)) {
                      await tx.option.deleteMany({
                        where: { questionId: question.id }
                      });
                      
                      if (question.options && question.options.length > 0) {
                        await tx.option.createMany({
                          data: question.options
                            .filter((opt: any) => opt.text?.trim())
                            .map((option: any) => ({
                              text: option.text,
                              imageUrl: option.imageUrl || null,
                              questionId: question.id
                            }))
                        });
                      }
                    }
                  } else {
                    // New question in existing section
                    const createdQuestion = await tx.question.create({
                      data: {
                        text: question.text || '',
                        description: question.description || null,
                        type: question.type || 'SHORT_ANSWER',
                        required: question.required || false,
                        imageUrl: question.imageUrl || null,
                        sectionId: sectionData.id,
                        points: question.points || 1,
                        correctAnswers: question.correctAnswers || [],
                        shuffleOptionsOrder: question.shuffleOptionsOrder || false
                      }
                    });

                    if (question.options && question.options.length > 0) {
                      await tx.option.createMany({
                        data: question.options
                          .filter((opt: any) => opt.text?.trim())
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
            } else {
              // Create new section (no ID or temporary ID)
              const createdSection = await tx.section.create({
                data: {
                  title: sectionData.title || 'Untitled Section',
                  description: sectionData.description || null,
                  order: sectionIndex,
                  formId: formId
                }
              });

              // Create questions for the new section
              if (sectionData.questions && sectionData.questions.length > 0) {
                for (const question of sectionData.questions) {
                  const createdQuestion = await tx.question.create({
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
                    await tx.option.createMany({
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
          }
          
          // Delete questions that are no longer in the payload
          // Get all question IDs that are in the payload (real IDs only)
          const payloadQuestionIds = new Set<string>();
          sections.forEach((section: any) => {
            if (section.questions) {
              section.questions.forEach((q: any) => {
                if (q.id && !q.id.startsWith('temp_')) {
                  payloadQuestionIds.add(q.id);
                }
              });
            }
          });
          
          // Count how many NEW questions are in the payload (undefined or temp IDs)
          let newQuestionsCount = 0;
          sections.forEach((section: any) => {
            if (section.questions) {
              section.questions.forEach((q: any) => {
                if (!q.id || q.id.startsWith('temp_')) {
                  newQuestionsCount++;
                }
              });
            }
          });
          
          // Get all existing questions in the form AFTER creates/updates
          const existingQuestions = await tx.question.findMany({
            where: {
              section: {
                formId: formId
              }
            },
            select: { id: true }
          });
          
          // Expected question count = questions with real IDs + new questions just created
          const expectedQuestionCount = payloadQuestionIds.size + newQuestionsCount;
          const actualQuestionCount = existingQuestions.length;
          
          // Only delete questions if we have MORE than expected
          // Find questions to delete (exist in DB but not in payload, and only excess ones)
          const questionsToDelete = existingQuestions
            .filter(q => !payloadQuestionIds.has(q.id))
            .slice(0, Math.max(0, actualQuestionCount - expectedQuestionCount)) // Only delete excess
            .map(q => q.id);
          
          if (questionsToDelete.length > 0) {
            // Delete answers first
            await tx.answer.deleteMany({
              where: {
                questionId: { in: questionsToDelete }
              }
            });
            
            // Delete options
            await tx.option.deleteMany({
              where: {
                questionId: { in: questionsToDelete }
              }
            });
            
            // Delete the questions
            await tx.question.deleteMany({
              where: {
                id: { in: questionsToDelete }
              }
            });
          }
          
          // NOW delete sections that are not in the payload (after all updates are done)
          // This ensures that moved questions have been reassigned before their old section is deleted
          // Get current sections AFTER all creates/updates
          const existingSections = await tx.section.findMany({
            where: { formId: formId },
            select: { id: true }
          });
          
          // Get the section IDs from the payload (only real IDs, not temp ones or undefined)
          // Also, if there are NEW sections (undefined ID), we should NOT delete them
          const payloadSectionIds = sections
            .filter((s: any) => s.id && typeof s.id === 'string' && !s.id.startsWith('temp_'))
            .map((s: any) => s.id);
          
          // Count how many sections have undefined or temp IDs (these are new sections that were just created)
          const newSectionsCount = sections.filter((s: any) => !s.id || s.id.startsWith('temp_')).length;
          
          // Only delete sections if:
          // 1. They exist in DB
          // 2. They are NOT in the payload
          // 3. Taking into account that new sections were just created (so total should match)
          const expectedSectionCount = payloadSectionIds.length + newSectionsCount;
          const actualSectionCount = existingSections.length;
          
          // Only delete if we have MORE sections in DB than expected
          // (This means some old sections should be removed)
          const sectionsToDelete = existingSections
            .filter(s => !payloadSectionIds.includes(s.id))
            .slice(0, Math.max(0, actualSectionCount - expectedSectionCount)) // Only delete excess sections
            .map(s => s.id);
          
          if (sectionsToDelete.length > 0) {
            try {
              // Delete answers first (for forms with responses)
              await tx.answer.deleteMany({
                where: {
                  question: {
                    section: {
                      id: { in: sectionsToDelete }
                    }
                  }
                }
              });
              
              // Delete options
              await tx.option.deleteMany({
                where: {
                  question: {
                    section: {
                      id: { in: sectionsToDelete }
                    }
                  }
                }
              });
              
              // Delete questions in those sections (should be none if they were moved)
              await tx.question.deleteMany({
                where: {
                  section: {
                    id: { in: sectionsToDelete }
                  }
                }
              });
              
              // Delete the sections themselves
              await tx.section.deleteMany({
                where: {
                  id: { in: sectionsToDelete }
                }
              });
            } catch (deleteError) {
              console.error('❌ Error deleting sections:', deleteError);
              throw deleteError;
            }
          }
        }
        
        // Only process flattened questions array if sections weren't provided (legacy support)
        // If sections are provided, all questions are already handled within sections
        if (!sections || sections.length === 0) {
          // Get existing questions to check if they match (through sections)
          const existingQuestions = await tx.question.findMany({
            where: { 
              section: {
                formId: formId
              }
            },
            include: { options: true },
            orderBy: { id: 'asc' }
          });

          // For forms with responses, we'll be more flexible but still preserve data
          // Allow safe changes and warn about unsafe ones
          
          // Map questions by their permanent IDs (non-temp IDs)
          const existingQuestionsMap = new Map();
          existingQuestions.forEach(q => {
            existingQuestionsMap.set(q.id, q);
          });

          // Process each question in the new set
          for (const newQuestion of questions) {
          if (newQuestion.id && !newQuestion.id.toString().startsWith('temp_')) {
            // Existing question - update it
            const existingQuestion = existingQuestionsMap.get(newQuestion.id);
            if (existingQuestion) {
              // Allow text, required, and options updates
              // For type changes, we'll allow safe ones
              const isSafeTypeChange = (
                existingQuestion.type === newQuestion.type ||
                // Allow changes between similar text types
                (existingQuestion.type === 'SHORT_ANSWER' && newQuestion.type === 'PARAGRAPH') ||
                (existingQuestion.type === 'PARAGRAPH' && newQuestion.type === 'SHORT_ANSWER') ||
                // Allow changes between choice types (they have similar structure)
                (['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(existingQuestion.type) && 
                 ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(newQuestion.type))
              );

              if (!isSafeTypeChange) {
                console.warn(`Unsafe type change detected for question ${existingQuestion.id}: ${existingQuestion.type} -> ${newQuestion.type}`);
                // Skip this question or handle it differently
                continue;
              }
              
              await tx.question.update({
                where: { id: existingQuestion.id },
                data: {
                  text: newQuestion.text,
                  description: newQuestion.description || null, // Add description field
                  type: newQuestion.type,
                  required: newQuestion.required,
                  imageUrl: newQuestion.imageUrl || null // Add imageUrl field
                }
              });

              // Update options for choice-based questions
              if (['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(newQuestion.type) && newQuestion.options) {
                // Delete existing options
                await tx.option.deleteMany({
                  where: { questionId: existingQuestion.id }
                });
                
                // Create new options
                if (newQuestion.options.length > 0) {
                  await tx.option.createMany({
                    data: newQuestion.options.map((option: any) => ({
                      text: typeof option === 'string' ? option : option.text,
                      imageUrl: typeof option === 'string' ? null : (option.imageUrl || null),
                      questionId: existingQuestion.id
                    }))
                  });
                }
              }
            }
          } else {
            // New question (temp ID) - create it
            
            // Get or create default section
            let defaultSection = await tx.section.findFirst({
              where: { formId: formId }
            });
            
            if (!defaultSection) {
              defaultSection = await tx.section.create({
                data: {
                  title: "Section 1",
                  description: null,
                  order: 0,
                  formId: formId
                }
              });
            }
            
            const createdQuestion = await tx.question.create({
              data: {
                text: newQuestion.text,
                description: newQuestion.description || null,
                type: newQuestion.type,
                required: newQuestion.required,
                imageUrl: newQuestion.imageUrl || null,
                sectionId: defaultSection.id
              }
            });

            // Create options if needed
            if (['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(newQuestion.type) && newQuestion.options && newQuestion.options.length > 0) {
              await tx.option.createMany({
                data: newQuestion.options.map((option: any) => ({
                  text: typeof option === 'string' ? option : option.text,
                  imageUrl: typeof option === 'string' ? null : (option.imageUrl || null),
                  questionId: createdQuestion.id
                }))
              });
            }
          }
        }

          // Handle question deletions - identify questions that are no longer in the new list
          const newQuestionIds = new Set(
            questions
              .filter((q: any) => q.id && !q.id.toString().startsWith('temp_'))
              .map((q: any) => q.id)
          );
          
          const questionsToDelete = existingQuestions.filter(q => !newQuestionIds.has(q.id));
        
          if (questionsToDelete.length > 0) {
            // Delete questions and their related data
            for (const questionToDelete of questionsToDelete) {
              // First delete related answers
              await tx.answer.deleteMany({
                where: { questionId: questionToDelete.id }
              });
              
              // Then delete options
              await tx.option.deleteMany({
                where: { questionId: questionToDelete.id }
              });
              
              // Finally delete the question
              await tx.question.delete({
                where: { id: questionToDelete.id }
              });
            }
          }
        } // End of if (!sections || sections.length === 0)
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Form updated successfully',
      form: {
        id: formId,
        title,
        description,
        published,
        acceptingResponses
      }
    });

  } catch (error) {
    console.error('🔴 API UPDATE - Transaction failed:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}