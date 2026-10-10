import * as fflate from "fflate";
import { XMLParser } from "fast-xml-parser";
import path from "path";

export interface EpubCoverItem {
  id?: string;
  href: string;
  zipPath: string;
  mediaType: string;
}

export interface EpubMetadata {
  title?: string;
  author?: string;
  description?: string;
  language?: string;
  opfPath: string;
  coverItem?: EpubCoverItem;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseAttributeValue: false,
});

/**
 * Validates basic EPUB archive signature (ZIP magic PK\x03\x04).
 */
export function validateEpubBytes(buffer: Uint8Array | Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function extractNodeText(node: unknown): string | undefined {
  if (node === null || node === undefined) return undefined;
  if (typeof node === "string") {
    const trimmed = node.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const item of node) {
      const text = extractNodeText(item);
      if (text) return text;
    }
    return undefined;
  }
  if (typeof node === "object") {
    const textProp = (node as Record<string, unknown>)["#text"];
    if (textProp !== undefined) {
      return extractNodeText(textProp);
    }
  }
  return undefined;
}

function findNodeBySuffix(obj: Record<string, unknown>, suffix: string): unknown {
  for (const [key, val] of Object.entries(obj)) {
    if (key.toLowerCase() === suffix.toLowerCase() || key.toLowerCase().endsWith(`:${suffix.toLowerCase()}`)) {
      return val;
    }
  }
  return undefined;
}

/**
 * Normalizes relative file paths inside EPUB ZIP archive.
 */
export function resolveZipPath(baseDir: string, relativePath: string): string {
  const decoded = decodeURIComponent(relativePath.split("#")[0].split("?")[0]);
  const joined = baseDir ? path.posix.join(baseDir, decoded) : decoded;
  return path.posix.normalize(joined).replace(/^\//, "");
}

/**
 * Parses container.xml to locate the OPF rootfile path.
 */
function findOpfPath(containerXmlStr: string): string | null {
  const parsed = xmlParser.parse(containerXmlStr);
  const container = parsed?.container || parsed?.["oci:container"];
  if (!container) return null;

  const rootfiles = container.rootfiles?.rootfile;
  if (!rootfiles) return null;

  if (Array.isArray(rootfiles)) {
    const opfFile = rootfiles.find(
      (rf: Record<string, unknown>) =>
        rf["@_media-type"] === "application/oebps-package+xml" ||
        String(rf["@_full-path"] || "").endsWith(".opf")
    );
    return opfFile?.["@_full-path"] || rootfiles[0]?.["@_full-path"] || null;
  }

  if (typeof rootfiles === "object") {
    return (rootfiles as Record<string, unknown>)["@_full-path"] as string || null;
  }

  return null;
}

/**
 * Extracts and parses metadata + manifest cover info from an EPUB buffer.
 */
export function parseEpubMetadata(buffer: Uint8Array | Buffer): EpubMetadata {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // 1. Unzip META-INF/container.xml
  const unzipped = fflate.unzipSync(uint8, {
    filter: (file) => file.name.replace(/^\//, "").toLowerCase() === "meta-inf/container.xml",
  });
  const containerEntry =
    unzipped["META-INF/container.xml"] ||
    Object.entries(unzipped).find(([k]) => k.replace(/^\//, "").toLowerCase() === "meta-inf/container.xml")?.[1];

  if (!containerEntry) {
    throw new Error("Некорректный EPUB: отсутствует META-INF/container.xml");
  }

  const containerXmlStr = fflate.strFromU8(containerEntry);

  const opfRelativePath = findOpfPath(containerXmlStr);
  if (!opfRelativePath) {
    throw new Error("Некорректный EPUB: не найден путь к OPF файлу в container.xml");
  }

  const normalizedOpfPath = path.posix.normalize(opfRelativePath).replace(/^\//, "");
  const opfDir = path.posix.dirname(normalizedOpfPath) === "." ? "" : path.posix.dirname(normalizedOpfPath);

  // 2. Unzip OPF file
  const unzippedOpf = fflate.unzipSync(uint8, {
    filter: (file) => file.name.replace(/^\//, "") === normalizedOpfPath,
  });

  const opfFileEntry = unzippedOpf[normalizedOpfPath] ||
    Object.entries(unzippedOpf).find(([k]) => k.replace(/^\//, "") === normalizedOpfPath)?.[1];

  if (!opfFileEntry) {
    throw new Error(`Некорректный EPUB: файл пакета ${normalizedOpfPath} не найден в архиве`);
  }

  const opfXmlStr = fflate.strFromU8(opfFileEntry);
  const parsedOpf = xmlParser.parse(opfXmlStr);
  const pkg = parsedOpf?.package || parsedOpf?.["opf:package"];

  if (!pkg) {
    throw new Error("Некорректный OPF: корневой элемент package отсутствует");
  }

  const metadataNode = pkg.metadata || pkg["opf:metadata"] || {};
  const manifestNode = pkg.manifest || pkg["opf:manifest"] || {};
  const guideNode = pkg.guide || pkg["opf:guide"];

  // 3. Extract Metadata fields
  const titleNode = findNodeBySuffix(metadataNode, "title");
  const authorNode = findNodeBySuffix(metadataNode, "creator");
  const descriptionNode = findNodeBySuffix(metadataNode, "description");
  const languageNode = findNodeBySuffix(metadataNode, "language");

  const title = extractNodeText(titleNode);
  const author = extractNodeText(authorNode);
  const description = extractNodeText(descriptionNode);
  const language = extractNodeText(languageNode);

  // 4. Build manifest item lookup
  type ManifestRawItem = {
    "@_id"?: string;
    "@_href"?: string;
    "@_media-type"?: string;
    "@_properties"?: string;
  };

  const rawItems = manifestNode.item || manifestNode["opf:item"] || [];
  const items: ManifestRawItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  const manifestItems = items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: item["@_id"],
      href: item["@_href"] || "",
      mediaType: item["@_media-type"] || "",
      properties: item["@_properties"] || "",
    }));

  // 5. Detect Cover Item
  let coverItem: EpubCoverItem | undefined;

  // Strategy A: EPUB 3 cover-image property
  const epub3Cover = manifestItems.find(
    (item) => item.properties && item.properties.split(/\s+/).includes("cover-image")
  );
  if (epub3Cover && epub3Cover.href) {
    coverItem = {
      id: epub3Cover.id,
      href: epub3Cover.href,
      zipPath: resolveZipPath(opfDir, epub3Cover.href),
      mediaType: epub3Cover.mediaType,
    };
  }

  // Strategy B: EPUB 2 meta name="cover" content="item_id"
  if (!coverItem) {
    const rawMeta = metadataNode.meta || metadataNode["opf:meta"] || [];
    const metaList = Array.isArray(rawMeta) ? rawMeta : [rawMeta];
    const coverMeta = metaList.find(
      (m: Record<string, unknown>) =>
        m && typeof m === "object" && m["@_name"]?.toString().toLowerCase() === "cover"
    );
    const coverId = coverMeta?.["@_content"];
    if (coverId) {
      const itemById = manifestItems.find((it) => it.id === coverId);
      if (itemById && itemById.href) {
        coverItem = {
          id: itemById.id,
          href: itemById.href,
          zipPath: resolveZipPath(opfDir, itemById.href),
          mediaType: itemById.mediaType,
        };
      }
    }
  }

  // Strategy C: EPUB guide cover reference
  if (!coverItem && guideNode) {
    const rawRefs = guideNode.reference || guideNode["opf:reference"] || [];
    const refList = Array.isArray(rawRefs) ? rawRefs : [rawRefs];
    const coverRef = refList.find(
      (r: Record<string, unknown>) =>
        r && typeof r === "object" && r["@_type"]?.toString().toLowerCase() === "cover"
    );
    if (coverRef?.["@_href"]) {
      const guideHref = String(coverRef["@_href"]);
      // Check if reference points directly to an image in manifest
      const itemByHref = manifestItems.find(
        (it) => it.href === guideHref || it.href.toLowerCase() === guideHref.toLowerCase()
      );
      if (itemByHref && itemByHref.mediaType.startsWith("image/")) {
        coverItem = {
          id: itemByHref.id,
          href: itemByHref.href,
          zipPath: resolveZipPath(opfDir, itemByHref.href),
          mediaType: itemByHref.mediaType,
        };
      }
    }
  }

  // Strategy D: Manifest item with id or href containing 'cover' and image media-type
  if (!coverItem) {
    const coverMatch = manifestItems.find((it) => {
      const isImage = it.mediaType.startsWith("image/");
      const hasCoverInId = it.id?.toLowerCase().includes("cover");
      const hasCoverInHref = it.href?.toLowerCase().includes("cover");
      return isImage && (hasCoverInId || hasCoverInHref);
    });
    if (coverMatch && coverMatch.href) {
      coverItem = {
        id: coverMatch.id,
        href: coverMatch.href,
        zipPath: resolveZipPath(opfDir, coverMatch.href),
        mediaType: coverMatch.mediaType,
      };
    }
  }

  // Strategy E: First image item in manifest
  if (!coverItem) {
    const firstImage = manifestItems.find((it) => it.mediaType.startsWith("image/"));
    if (firstImage && firstImage.href) {
      coverItem = {
        id: firstImage.id,
        href: firstImage.href,
        zipPath: resolveZipPath(opfDir, firstImage.href),
        mediaType: firstImage.mediaType,
      };
    }
  }

  return {
    title,
    author,
    description,
    language,
    opfPath: normalizedOpfPath,
    coverItem,
  };
}
