import type { HighlightType } from "@/lib/types";

export const highlightTypes: {
  type: HighlightType;
  name: string;
  colorName: string;
  description: string;
  menuClassName: string;
}[] = [
  {
    type: "protein",
    name: "Белки",
    colorName: "Красный",
    description: "Лайфхаки, приемы, инструменты, которые я могу немедленно применить в своей жизни.",
    menuClassName: "bg-red-200 text-red-950 hover:bg-red-300",
  },
  {
    type: "carbohydrate",
    name: "Углеводы",
    colorName: "Оранжевый",
    description: "Мотивация, заставляет задуматься, чем-то удивил.",
    menuClassName: "bg-orange-200 text-orange-950 hover:bg-orange-300",
  },
  {
    type: "fat",
    name: "Жиры",
    colorName: "Жёлтый",
    description: "Интересное, приятно читать, приносит удовольствие, случаи, которые нужно запомнить, интригующие вещи",
    menuClassName: "bg-amber-200 text-amber-950 hover:bg-amber-300",
  },
  {
    type: "vitamin",
    name: "Витамины",
    colorName: "Зелёный",
    description: "Анекдоты, курьезные случаи, забавные случаи, красивые цитаты.",
    menuClassName: "bg-emerald-200 text-emerald-950 hover:bg-emerald-300",
  },
  {
    type: "fiber",
    name: "Клетчатка",
    colorName: "Синий",
    description: "Ссылки, цифры, факты, статистика,  истории, даты.",
    menuClassName: "bg-sky-200 text-sky-950 hover:bg-sky-300",
  },
];

export const highlightTypeByName = Object.fromEntries(
  highlightTypes.map((item) => [item.type, item])
) as Record<HighlightType, (typeof highlightTypes)[number]>;

export function isHighlightType(value: string | undefined): value is HighlightType {
  return highlightTypes.some((item) => item.type === value);
}
