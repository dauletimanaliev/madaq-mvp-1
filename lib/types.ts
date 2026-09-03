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

export type Highlight = {
  id: string;
  bookId: string;
  chapterId: string;
  startPosition: number;
  endPosition: number;
  type: HighlightType | null;
  legacyColor: string | null;
  createdAt: string;
};
