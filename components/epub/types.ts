export interface EpubTocItem {
  label: string;
  href: string;
  subitems?: EpubTocItem[];
}

export interface EpubViewportHandle {
  goTo: (href: string) => void | Promise<any>;
  next: () => void | Promise<any>;
  prev: () => void | Promise<any>;
}
