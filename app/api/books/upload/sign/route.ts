import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const fileName = body?.fileName;

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json(
      { error: "Имя файла не указано" },
      { status: 400 }
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Хранилище не сконфигурировано" },
      { status: 500 }
    );
  }

  const cleanExt = fileName.toLowerCase().endsWith(".pdf")
    ? ".pdf"
    : fileName.toLowerCase().endsWith(".json")
    ? ".json"
    : ".txt";

  const randomId =
    Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  const storagePath = `temp-uploads/${randomId}${cleanExt}`;

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/book-covers/${storagePath}`,
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
    const errText = await res.text();
    console.error("Failed to create signed upload URL:", errText);
    return NextResponse.json(
      { error: "Не удалось подготовить загрузку" },
      { status: 500 }
    );
  }

  const signData = await res.json();
  const uploadUrl = `${supabaseUrl}/storage/v1${signData.url}`;

  return NextResponse.json({
    uploadUrl,
    storagePath,
  });
}
