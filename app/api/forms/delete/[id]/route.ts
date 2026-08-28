import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/services/prisma';
import { auth } from '@clerk/nextjs/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Please sign in" },
        { status: 401 }
      );
    }

    const { id: formId } = await params;

    // Check if form belongs to user
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: { createdBy: true }
    });

    if (!form) {
      return NextResponse.json(
        { success: false, message: "Form not found" },
        { status: 404 }
      );
    }

    if (form.createdBy !== userId) {
      return NextResponse.json(
        { success: false, message: "Not authorized" },
        { status: 403 }
      );
    }

    // Delete related data first, then form.
    // Answers and responses must go first: Question.answers and Form.responses
    // are required relations, so question/form deletes fail if they still exist.
    await prisma.answer.deleteMany({
      where: {
        response: {
          formId: formId
        }
      }
    });

    await prisma.response.deleteMany({
      where: { formId: formId }
    });

    await prisma.option.deleteMany({
      where: {
        question: {
          section: {
            formId: formId
          }
        }
      }
    });

    await prisma.question.deleteMany({
      where: {
        section: {
          formId: formId
        }
      }
    });

    await prisma.section.deleteMany({
      where: {
        formId: formId
      }
    });

    await prisma.form.delete({
      where: { id: formId }
    });

    return NextResponse.json({
      success: true,
      message: "Form deleted successfully"
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to delete form' },
      { status: 500 }
    );
  }
}
