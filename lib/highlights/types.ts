import type { HighlightType } from "@/lib/types";

export const highlightTypes: {
  type: HighlightType;
  name: string;
  shortLabel: string;
  colorName: string;
  description: string;
  menuClassName: string;
  /** Classes for the notes page: marker behind the text, card stripe, label, dot. */
  noteStyle: NoteStyle;
}[] = [
  {
    type: "protein",
    name: "Белки",
    shortLabel: "Б",
    colorName: "Красный",
    description: "Лайфхаки, приемы, инструменты, которые я могу немедленно применить в своей жизни.",
    menuClassName: "bg-red-200 text-red-950 hover:bg-red-300",
    noteStyle: {
      mark: "bg-red-200/80",
      stripe: "border-l-red-400",
      label: "bg-red-50 text-red-800",
      dot: "bg-red-400",
    },
  },
  {
    type: "carbohydrate",
    name: "Углеводы",
    shortLabel: "У",
    colorName: "Оранжевый",
    description: "Мотивация, заставляет задуматься, чем-то удивил.",
    menuClassName: "bg-orange-200 text-orange-950 hover:bg-orange-300",
    noteStyle: {
      mark: "bg-orange-200/80",
      stripe: "border-l-orange-400",
      label: "bg-orange-50 text-orange-800",
      dot: "bg-orange-400",
    },
  },
  {
    type: "fat",
    name: "Жиры",
    shortLabel: "Ж",
    colorName: "Жёлтый",
    description: "Интересное, приятно читать, приносит удовольствие, случаи, которые нужно запомнить, интригующие вещи",
    menuClassName: "bg-amber-200 text-amber-950 hover:bg-amber-300",
    noteStyle: {
      mark: "bg-amber-200/80",
      stripe: "border-l-amber-400",
      label: "bg-amber-50 text-amber-800",
      dot: "bg-amber-400",
    },
  },
  {
    type: "vitamin",
    name: "Витамины",
    shortLabel: "В",
    colorName: "Зелёный",
    description: "Анекдоты, курьезные случаи, забавные случаи, красивые цитаты.",
    menuClassName: "bg-emerald-200 text-emerald-950 hover:bg-emerald-300",
    noteStyle: {
      mark: "bg-emerald-200/80",
      stripe: "border-l-emerald-400",
      label: "bg-emerald-50 text-emerald-800",
      dot: "bg-emerald-400",
    },
  },
  {
    type: "fiber",
    name: "Клетчатка",
    shortLabel: "К",
    colorName: "Синий",
    description: "Ссылки, цифры, факты, статистика,  истории, даты.",
    menuClassName: "bg-sky-200 text-sky-950 hover:bg-sky-300",
    noteStyle: {
      mark: "bg-sky-200/80",
      stripe: "border-l-sky-400",
      label: "bg-sky-50 text-sky-800",
      dot: "bg-sky-400",
    },
  },
];

export type NoteStyle = {
  mark: string;
  stripe: string;
  label: string;
  dot: string;
};

export const uncategorizedHighlight = {
  type: null,
  name: "Без категории",
  shortLabel: "—",
  colorName: "Серый",
  description: "Быстрое выделение, можно классифицировать позже.",
  menuClassName: "bg-stone-200 text-stone-900 hover:bg-stone-300",
  noteStyle: {
    mark: "bg-stone-100",
    stripe: "border-l-stone-300",
    label: "bg-stone-100 text-stone-700",
    dot: "bg-stone-400",
  } satisfies NoteStyle,
} as const;

export const highlightTypeByName = Object.fromEntries(
  highlightTypes.map((item) => [item.type, item])
) as Record<HighlightType, (typeof highlightTypes)[number]>;

export function isHighlightType(value: string | undefined): value is HighlightType {
  return highlightTypes.some((item) => item.type === value);
}

export function isHighlightFilter(
  value: string | undefined
): value is HighlightType | "none" {
  return value === "none" || highlightTypes.some((item) => item.type === value);
}
