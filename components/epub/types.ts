export interface EpubTocItem {
  label: string;
  href: string;
  subitems?: EpubTocItem[];
}

export interface EpubViewportHandle {
  goTo: (href: string) => void | Promise<unknown>;
  next: () => void | Promise<unknown>;
  prev: () => void | Promise<unknown>;
}

export type EpubTheme = "paper" | "sepia" | "dark";

export interface EpubReaderSettings {
  theme: EpubTheme;
  fontSize: number; // in percentage: 80 - 150
}
