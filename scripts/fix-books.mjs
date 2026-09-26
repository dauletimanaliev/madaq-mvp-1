/**
 * fix-books.mjs — Fix all book covers and metadata in one shot.
 *
 * What it does:
 * 1. Reads all books from the database
 * 2. For books missing Supabase covers: renders page 1 of the matching PDF → uploads to Supabase → updates DB
 * 3. Fixes "Unknown" book title/author from the actual PDF content
 * 4. Fixes "kumis kitap2" title from the actual PDF content
 */

import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function uploadCoverToSupabase(bookId, pngBuffer) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/book-covers/${bookId}/cover.png`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "content-type": "image/png",
        "x-upsert": "true",
      },
      body: pngBuffer,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed for ${bookId}: ${res.status} — ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/book-covers/${bookId}/cover.png`;
}

async function renderCoverFromPdf(pdfPath) {
  const { renderPageAsImage } = await import("unpdf");

  const fileData = await fs.readFile(pdfPath);
  const buf = Uint8Array.from(fileData);

  const coverBuffer = await renderPageAsImage(buf, 1, {
    width: 600,
    canvasImport: () => import("@napi-rs/canvas"),
  });

  return Buffer.from(coverBuffer);
}

async function getPdfMeta(pdfPath) {
  const { getMeta } = await import("unpdf");
  const fileData = await fs.readFile(pdfPath);
  const buf = Uint8Array.from(fileData);
  try {
    const { info } = await getMeta(buf);
    return info || {};
  } catch {
    return {};
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const { rows: books } = await client.query(`
  SELECT b.id, b.title, b.cover_url, a.id as author_id, a.name as author_name
  FROM books b
  JOIN authors a ON b.author_id = a.id
  ORDER BY b.created_at
`);

console.log(`📚 Found ${books.length} books in database:\n`);
for (const b of books) {
  console.log(`  • ${b.id}: "${b.title}" by "${b.author_name}"`);
  console.log(`    cover: ${b.cover_url || "(none)"}`);
}
console.log();

// PDF source directory
const pdfDir = "/Users/dauletimanaliev/кітаптар";

// ─── Fix 1: "Unknown" book ───────────────────────────────────────────────────
const unknownBook = books.find((b) => b.title === "Unknown");
if (unknownBook) {
  console.log("🔧 Fixing 'Unknown' book...");

  // Based on content analysis, this is "Алаш айтқан асыл сөз.pdf"
  // or "553772_1387344700.pdf" — let's try both and check metadata
  const candidates = [
    path.join(pdfDir, "553772_1387344700.pdf"),
    path.join(pdfDir, "Алаш айтқан асыл сөз.pdf"),
  ];

  let matchedPdf = null;
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      const meta = await getPdfMeta(candidate);
      console.log(`  Checking ${path.basename(candidate)}:`, JSON.stringify(meta));
      // "Пользователь Windows" as author suggests this was the PDF
      if (meta?.Author === "Пользователь Windows" || meta?.Title === "Unknown") {
        matchedPdf = candidate;
        break;
      }
    } catch (e) {
      console.log(`  Skipping ${path.basename(candidate)}: ${e.message}`);
    }
  }

  // If no metadata match, try the first one that exists
  if (!matchedPdf) {
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        matchedPdf = candidate;
        break;
      } catch {}
    }
  }

  // Based on chapter content "ҰЛТТЫ ҰЙЫТҚАН ҰЛЫ СӨЗДЕР", the actual title is:
  const newTitle = "Алаш айтқан асыл сөз";
  const newAuthor = "Алаш зиялылары";

  // Update title in DB
  await client.query(`UPDATE books SET title = $1 WHERE id = $2`, [newTitle, unknownBook.id]);
  console.log(`  ✅ Title updated: "${unknownBook.title}" → "${newTitle}"`);

  // Update or create author
  const { rows: existingAuthors } = await client.query(
    `SELECT id FROM authors WHERE name = $1`,
    [newAuthor]
  );

  let newAuthorId;
  if (existingAuthors.length > 0) {
    newAuthorId = existingAuthors[0].id;
  } else {
    const { rows: created } = await client.query(
      `INSERT INTO authors (id, name) VALUES (gen_random_uuid()::text, $1) RETURNING id`,
      [newAuthor]
    );
    newAuthorId = created[0].id;
  }

  await client.query(`UPDATE books SET author_id = $1 WHERE id = $2`, [newAuthorId, unknownBook.id]);
  console.log(`  ✅ Author updated: "${unknownBook.author_name}" → "${newAuthor}"`);

  // Generate and upload cover
  if (matchedPdf) {
    try {
      console.log(`  📸 Generating cover from ${path.basename(matchedPdf)}...`);
      const coverPng = await renderCoverFromPdf(matchedPdf);
      const coverUrl = await uploadCoverToSupabase(unknownBook.id, coverPng);
      await client.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [coverUrl, unknownBook.id]);
      console.log(`  ✅ Cover uploaded: ${coverUrl}`);
    } catch (e) {
      console.error(`  ❌ Cover generation failed:`, e.message);
    }
  }
  console.log();
}

// ─── Fix 2: "kumis kitap2" title ─────────────────────────────────────────────
const kumisBook = books.find((b) => b.title === "kumis kitap2");
if (kumisBook) {
  console.log("🔧 Fixing 'kumis kitap2' title...");

  // The first chapter starts with "ҚАЛЫПТАСУЫ" — this is a Kumis-themed Kazakh book
  // Based on the PDF filename "kumis_kitap2.pdf"
  const kumisPath = path.join(pdfDir, "kumis_kitap2.pdf");
  const meta = await getPdfMeta(kumisPath);
  console.log(`  PDF metadata:`, JSON.stringify(meta));

  // Use a proper Kazakh title
  const newTitle = "Құмыс кітабы 2";
  await client.query(`UPDATE books SET title = $1 WHERE id = $2`, [newTitle, kumisBook.id]);
  console.log(`  ✅ Title updated: "${kumisBook.title}" → "${newTitle}"`);

  // Fix author if it's "Неизвестный автор"
  if (kumisBook.author_name === "Неизвестный автор") {
    // Only update if we have something meaningful
    if (meta?.Author && meta.Author !== "Неизвестный автор") {
      const { rows: existing } = await client.query(
        `SELECT id FROM authors WHERE name = $1`,
        [meta.Author]
      );
      let authorId;
      if (existing.length > 0) {
        authorId = existing[0].id;
      } else {
        const { rows: created } = await client.query(
          `INSERT INTO authors (id, name) VALUES (gen_random_uuid()::text, $1) RETURNING id`,
          [meta.Author]
        );
        authorId = created[0].id;
      }
      await client.query(`UPDATE books SET author_id = $1 WHERE id = $2`, [authorId, kumisBook.id]);
      console.log(`  ✅ Author updated: "${kumisBook.author_name}" → "${meta.Author}"`);
    }
  }

  // Cover is already in Supabase, check if URL is correct
  const coverCheck = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/book-covers/${kumisBook.id}/cover.png`,
    { method: "HEAD" }
  );
  if (coverCheck.ok) {
    console.log(`  ✅ Cover already in Supabase`);
  } else {
    console.log(`  📸 Re-uploading cover...`);
    try {
      const coverPng = await renderCoverFromPdf(kumisPath);
      const coverUrl = await uploadCoverToSupabase(kumisBook.id, coverPng);
      await client.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [coverUrl, kumisBook.id]);
      console.log(`  ✅ Cover uploaded: ${coverUrl}`);
    } catch (e) {
      console.error(`  ❌ Cover failed:`, e.message);
    }
  }
  console.log();
}

// ─── Fix 3: "Ерік-жігер" — upload cover to Supabase ─────────────────────────
const erikBook = books.find((b) => b.id === "book_ерк-жгер_4coos");
if (erikBook) {
  console.log("🔧 Fixing 'Ерік-жігер' cover...");

  // Check if cover already exists in Supabase
  const coverCheck = await fetch(
    `${SUPABASE_URL}/storage/v1/object/public/book-covers/${erikBook.id}/cover.png`,
    { method: "HEAD" }
  );

  if (coverCheck.ok) {
    console.log(`  ✅ Cover already in Supabase`);
    // Update URL in DB if it's still local
    if (!erikBook.cover_url?.startsWith("https://")) {
      const coverUrl = `${SUPABASE_URL}/storage/v1/object/public/book-covers/${erikBook.id}/cover.png`;
      await client.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [coverUrl, erikBook.id]);
      console.log(`  ✅ URL updated in DB`);
    }
  } else {
    // Read local cover and upload to Supabase
    const localCoverPath = path.join(
      process.cwd(),
      "public",
      "covers",
      `${erikBook.id}.png`
    );

    try {
      const localCover = await fs.readFile(localCoverPath);
      console.log(`  📸 Uploading local cover (${localCover.length} bytes) to Supabase...`);
      const coverUrl = await uploadCoverToSupabase(erikBook.id, localCover);
      await client.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [coverUrl, erikBook.id]);
      console.log(`  ✅ Cover uploaded: ${coverUrl}`);
    } catch {
      // Try rendering from PDF
      console.log(`  Local cover not found, rendering from PDF...`);
      const erikPdf = path.join(pdfDir, "Ерік-жігер-Рой-Баумайстер.pdf");
      try {
        const coverPng = await renderCoverFromPdf(erikPdf);
        const coverUrl = await uploadCoverToSupabase(erikBook.id, coverPng);
        await client.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [coverUrl, erikBook.id]);
        console.log(`  ✅ Cover uploaded: ${coverUrl}`);
      } catch (e2) {
        console.error(`  ❌ Cover failed:`, e2.message);
      }
    }
  }
  console.log();
}

// ─── Verify final state ──────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════");
console.log("📊 FINAL STATE:");
console.log("═══════════════════════════════════════════════════════\n");

const { rows: finalBooks } = await client.query(`
  SELECT b.id, b.title, a.name as author_name, b.cover_url
  FROM books b
  JOIN authors a ON b.author_id = a.id
  ORDER BY b.created_at
`);

for (const b of finalBooks) {
  const hasSupabaseCover = b.cover_url?.startsWith("https://");
  const status = hasSupabaseCover ? "✅" : b.cover_url ? "⚠️ local" : "❌ no cover";
  console.log(`  ${status} "${b.title}" by "${b.author_name}"`);
  if (b.cover_url) console.log(`       ${b.cover_url}`);
}

await client.end();
console.log("\n✅ Done!");
