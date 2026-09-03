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
    menuClassName: "bg-red-400",
  },
  {
    type: "carbohydrate",
    name: "Углеводы",
    colorName: "Оранжевый",
    description: "Мотивация, заставляет задуматься, чем-то удивил.",
    menuClassName: "bg-orange-400",
  },
  {
    type: "fat",
    name: "Жиры",
    colorName: "Жёлтый",
    description: "Интересное, приятно читать, приносит удовольствие, случаи, которые нужно запомнить, интригующие вещи",
    menuClassName: "bg-yellow-300",
  },
  {
    type: "vitamin",
    name: "Витамины",
    colorName: "Зелёный",
    description: "Анекдоты, курьезные случаи, забавные случаи, красивые цитаты.",
    menuClassName: "bg-green-400",
  },
  {
    type: "fiber",
    name: "Клетчатка",
    colorName: "Синий",
    description: "Ссылки, цифры, факты, статистика,  истории, даты.",
    menuClassName: "bg-blue-400",
  },
];

export const highlightTypeByName = Object.fromEntries(
  highlightTypes.map((item) => [item.type, item])
) as Record<HighlightType, (typeof highlightTypes)[number]>;

export function isHighlightType(value: string | undefined): value is HighlightType {
  return highlightTypes.some((item) => item.type === value);
}
