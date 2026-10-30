import { NextRequest, NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/db/prisma";
import {
  MAX_BOOKS_PER_USER,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  TEMP_UPLOAD_BUCKET,
  uploadExtension,
} from "@/lib/books/upload-limits";

export const maxDuration = 15;

/**
 * Returns a one-time URL for uploading a book file straight to storage
 * (bypasses the 4.5 MB request limit of serverless functions).
 * Checks everything that can be checked before the bytes are sent.
 */
export async function POST(request: NextRequest) {
  const userId = await getOptionalUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Войдите, чтобы загружать книги" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const fileName = body?.fileName;
  const fileSize = Number(body?.fileSize);

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "Имя файла не указано" }, { status: 400 });
  }
  const ext = uploadExtension(fileName);
  if (!ext) {
    return NextResponse.json(
      { error: "Этот формат не поддерживается. Загрузите PDF, EPUB, TXT, MD или JSON." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  }
  if (fileSize > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Файл слишком большой (макс. ${MAX_UPLOAD_MB} МБ)` },
      { status: 413 }
    );
  }
  if (body?.rightsConfirmed !== true) {
    return NextResponse.json(
      { error: "Подтвердите, что у вас есть право загружать этот файл" },
      { status: 400 }
    );
  }

  const bookCount = await prisma.userLibrary.count({ where: { userId } });
  if (bookCount >= MAX_BOOKS_PER_USER) {
    return NextResponse.json(
      {
        error: `В библиотеке уже ${MAX_BOOKS_PER_USER} книг — это максимум. Удалите ненужные, чтобы добавить новые.`,
      },
      { status: 403 }
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Хранилище не сконфигурировано" }, { status: 500 });
  }

  const randomId = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const storagePath = `temp-uploads/${userId}/${randomId}${ext}`;

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/${TEMP_UPLOAD_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 600 }),
    }
  );

  if (!res.ok) {
    console.error("Failed to create signed upload URL:", await res.text());
    return NextResponse.json({ error: "Не удалось подготовить загрузку" }, { status: 500 });
  }

  const signData = await res.json();
  return NextResponse.json({
    uploadUrl: `${supabaseUrl}/storage/v1${signData.url}`,
    storagePath,
  });
}
