import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/services/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();
    
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'Title is required' }, { status: 400 });
    }

    const params = await context.params;
    const formId = params.id;

    // Check if form exists and belongs to user
    const existingForm = await prisma.form.findFirst({
      where: {
        id: formId,
        createdBy: authResult.userId,
      },
    });

    if (!existingForm) {
      return NextResponse.json({ success: false, message: 'Form not found' }, { status: 404 });
    }

    // Update form title
    const updatedForm = await prisma.form.update({
      where: { id: formId },
      data: { title: title.trim() },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Form renamed successfully',
      form: updatedForm 
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to rename form' },
      { status: 500 }
    );
  }
}