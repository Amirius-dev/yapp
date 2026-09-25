import { z } from "zod";

export const templateIdSchema = z.enum(["clean", "motivational", "podcast"]);
export type TemplateId = z.infer<typeof templateIdSchema>;

export const accentColorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/iu, "Используйте HEX-цвет вида #ffd166.");

export const VIDEO_TEMPLATES = {
  clean: {
    id: "clean",
    name: "Clean",
    description: "Белый текст, спокойная тень и минимальная анимация.",
    fontSize: 64,
    fontWeight: 900,
    openingFontSize: 62,
    textColor: "#ffffff",
    defaultAccentColor: "#8f7cff",
    animation: "minimal",
  },
  motivational: {
    id: "motivational",
    name: "Motivational",
    description: "Крупный текст, жёлтый акцент и энергичная подача.",
    fontSize: 72,
    fontWeight: 900,
    openingFontSize: 76,
    textColor: "#ffffff",
    defaultAccentColor: "#ffd166",
    animation: "energetic",
  },
  podcast: {
    id: "podcast",
    name: "Podcast",
    description: "Компактная нижняя зона с высокой читаемостью.",
    fontSize: 56,
    fontWeight: 800,
    openingFontSize: 56,
    textColor: "#ffffff",
    defaultAccentColor: "#68e0bd",
    animation: "minimal",
  },
} as const;

export function videoTemplate(id: TemplateId) {
  return VIDEO_TEMPLATES[id];
}
