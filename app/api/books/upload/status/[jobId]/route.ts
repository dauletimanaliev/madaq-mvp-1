import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = await prisma.uploadJob.findUnique({
      where: { id: jobId },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            totalPages: true,
            author: { select: { name: true } },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      step: job.step,
      stepText: job.stepText,
      errorLog: job.errorLog,
      bookId: job.bookId,
      book: job.book,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error("Upload job status query error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
