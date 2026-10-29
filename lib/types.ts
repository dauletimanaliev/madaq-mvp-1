export type Author = {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
};

export type Book = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  language: string;
  publishedYear: number | null;
  fileHashSha256?: string | null;
  fileSizeBytes?: number | null;
  totalPages?: number | null;
  isLinearized?: boolean;
  storageS3Key?: string | null;
  contentFormat?: "TEXT" | "PDF" | "EPUB";
  epubStorageKey?: string | null;
  author: Author;
};

export type Chapter = {
  id: string;
  bookId: string;
  number: number;
  title: string | null;
  content: string;
};

export type ReadingProgress = {
  bookId: string;
  chapterId: string;
  position: number;
  progressPercent: number;
};

export type Bookmark = {
  id: string;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  bookTitle: string;
  position: number;
  note: string | null;
  createdAt: string;
};

export type HighlightType =
  | "protein"
  | "carbohydrate"
  | "fat"
  | "vitamin"
  | "fiber";

export type PdfHighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Highlight = {
  id: string;
  bookId: string;
  chapterId?: string | null;
  startPosition?: number | null;
  endPosition?: number | null;
  pageNumber?: number | null;
  rects?: PdfHighlightRect[] | null;
  selectedText?: string | null;
  type: HighlightType | null;
  legacyColor?: string | null;
  cfi?: string | null;
  sectionHref?: string | null;
  sectionIndex?: number | null;
  textQuotePrefix?: string | null;
  textQuoteSuffix?: string | null;
  note?: string | null;
  createdAt: string;
};
