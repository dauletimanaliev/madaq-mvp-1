import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const bucketId = "book-covers";
const objectPath = "new-cafe-guest/cover.png";
const sourcePath = resolve("public/covers/new-cafe-guest.png");
const supabaseUrl =
  process.env.SUPABASE_URL ?? "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function storageUrl(path) {
  return `${supabaseUrl}/storage/v1${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(storageUrl(path), {
    ...options,
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase Storage request failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function main() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for safe server-side Storage setup and upload."
    );
  }

  const buckets = await request("/bucket").then((response) => response.json());
  const bucketExists = buckets.some((bucket) => bucket.id === bucketId);

  if (!bucketExists) {
    await request("/bucket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: bucketId, name: bucketId, public: true }),
    });
    console.log(`Created public bucket: ${bucketId}`);
  } else {
    console.log(`Using existing bucket: ${bucketId}`);
  }

  const file = await readFile(sourcePath);
  await request(`/object/${bucketId}/${objectPath}`, {
    method: "POST",
    headers: {
      "content-type": "image/png",
      "x-upsert": "true",
    },
    body: file,
  });

  const coverUrl = storageUrl(`/object/public/${bucketId}/${objectPath}`);
  const book = await prisma.book.findUnique({
    where: { id: "book_new_cafe_guest" },
    select: { id: true },
  });

  if (!book) {
    throw new Error("book_new_cafe_guest does not exist; refusing to update coverUrl.");
  }

  await prisma.book.update({
    where: { id: book.id },
    data: { coverUrl },
  });

  console.log(`Uploaded ${bucketId}/${objectPath} and updated Book.coverUrl.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
