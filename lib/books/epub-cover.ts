import * as fflate from "fflate";
import { parseEpubMetadata, type EpubCoverItem } from "./epub-parser";

export interface ExtractedCover {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

/**
 * Sniffs image format from magic bytes for robust MIME type detection.
 */
function sniffImageMimeType(buf: Uint8Array): { mimeType: string; extension: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { mimeType: "image/gif", extension: "gif" };
  }
  return null;
}

function getExtensionFromMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "jpg";
  }
}

/**
 * Extracts cover image from EPUB archive as-is, without any conversion.
 */
export function extractEpubCover(
  buffer: Uint8Array | Buffer,
  coverItem?: EpubCoverItem
): ExtractedCover | null {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  let targetItem = coverItem;
  if (!targetItem) {
    try {
      const meta = parseEpubMetadata(uint8);
      targetItem = meta.coverItem;
    } catch {
      return null;
    }
  }

  if (!targetItem || !targetItem.zipPath) {
    return null;
  }

  const targetPath = targetItem.zipPath.replace(/^\//, "");
  const targetPathLower = targetPath.toLowerCase();

  const unzipped = fflate.unzipSync(uint8, {
    filter: (file) => {
      const name = file.name.replace(/^\//, "");
      return name === targetPath || name.toLowerCase() === targetPathLower;
    },
  });

  const matchingEntry =
    unzipped[targetPath] ||
    Object.entries(unzipped).find(([k]) => k.replace(/^\//, "").toLowerCase() === targetPathLower)?.[1];

  if (!matchingEntry || matchingEntry.length === 0) {
    return null;
  }

  // Sniff magic bytes or fallback to OPF manifest mediaType
  const sniffed = sniffImageMimeType(matchingEntry);
  const mimeType = sniffed?.mimeType || targetItem.mediaType || "image/jpeg";
  const extension = sniffed?.extension || getExtensionFromMime(mimeType);

  return {
    buffer: Buffer.from(matchingEntry),
    mimeType,
    extension,
  };
}
