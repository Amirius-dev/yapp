import { z } from "zod";
import { accentColorSchema, templateIdSchema } from "./templates.js";

const finite = () => z.number().finite();

export const imageAdjustmentsSchema = z
  .object({
    brightness: finite().min(0).max(200),
    exposure: finite().min(-2).max(2),
    contrast: finite().min(0).max(200),
    saturation: finite().min(0).max(200),
    temperature: finite().min(-100).max(100),
    tint: finite().min(-100).max(100),
    sharpness: finite().min(0).max(100),
    blur: finite().min(0).max(20),
    vignette: finite().min(0).max(100),
    opacity: finite().min(0).max(100),
    rotation: finite().min(-180).max(180),
    flipHorizontal: z.boolean(),
    zoom: finite().min(1).max(2),
    positionX: finite().min(0).max(100),
    positionY: finite().min(0).max(100),
    backgroundBlur: finite().min(0).max(80),
    backgroundDim: finite().min(0).max(0.8),
    backgroundSaturation: finite().min(0).max(2),
  })
  .strict();

export const DEFAULT_IMAGE_ADJUSTMENTS = {
  brightness: 100,
  exposure: 0,
  contrast: 100,
  saturation: 100,
  temperature: 0,
  tint: 0,
  sharpness: 0,
  blur: 0,
  vignette: 0,
  opacity: 100,
  rotation: 0,
  flipHorizontal: false,
  zoom: 1,
  positionX: 50,
  positionY: 50,
  backgroundBlur: 42,
  backgroundDim: 0.28,
  backgroundSaturation: 0.78,
} satisfies z.infer<typeof imageAdjustmentsSchema>;

export const musicSettingsSchema = z
  .object({
    fileName: z.string().regex(/^[a-zA-Z0-9._-]+$/u),
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.enum([
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
    ]),
    volume: finite().min(0).max(2),
    startSeconds: finite().min(0).max(90),
    loop: z.boolean(),
    fadeInSeconds: finite().min(0).max(10),
    fadeOutSeconds: finite().min(0).max(10),
    duckDuringSpeech: z.boolean(),
  })
  .strict();

export const audioSettingsSchema = z
  .object({
    volume: finite().min(0).max(2),
    muted: z.boolean(),
    fadeInSeconds: finite().min(0).max(10),
    fadeOutSeconds: finite().min(0).max(10),
    normalize: z.boolean(),
    noiseReduction: z.boolean(),
    music: musicSettingsSchema.nullable(),
  })
  .strict();

export const DEFAULT_AUDIO_SETTINGS = {
  volume: 1,
  muted: false,
  fadeInSeconds: 0,
  fadeOutSeconds: 0,
  normalize: false,
  noiseReduction: false,
  music: null,
} satisfies z.infer<typeof audioSettingsSchema>;

export const subtitleFontFamilySchema = z.enum([
  "Arial",
  "Helvetica",
  "Georgia",
  "Courier New",
  "Trebuchet MS",
]);

export const subtitleAnimationSchema = z.enum([
  "none",
  "fade",
  "pop",
  "minimal",
]);

export const subtitleStyleSchema = z
  .object({
    fontFamily: subtitleFontFamilySchema,
    fontWeight: z.number().int().min(400).max(900),
    textColor: accentColorSchema,
    activeWordColor: accentColorSchema,
    backgroundColor: accentColorSchema,
    backgroundOpacity: finite().min(0).max(1),
    outlineColor: accentColorSchema,
    outlineWidth: finite().min(0).max(8),
    shadow: z.boolean(),
    borderRadius: finite().min(0).max(40),
    paddingHorizontal: finite().min(0).max(48),
    paddingVertical: finite().min(0).max(32),
    maxWords: z.number().int().min(1).max(12),
    maxLines: z.number().int().min(1).max(3),
    animation: subtitleAnimationSchema,
    uppercase: z.boolean(),
  })
  .strict();

export const DEFAULT_SUBTITLE_STYLE = {
  fontFamily: "Arial",
  fontWeight: 900,
  textColor: "#ffffff",
  activeWordColor: "#ff6b00",
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  outlineColor: "#000000",
  outlineWidth: 4,
  shadow: true,
  borderRadius: 10,
  paddingHorizontal: 20,
  paddingVertical: 10,
  maxWords: 6,
  maxLines: 2,
  animation: "minimal",
  uppercase: false,
} satisfies z.infer<typeof subtitleStyleSchema>;

export const openingCaptionSettingsSchema = z
  .object({
    enabled: z.boolean(),
    text: z.string().max(300),
    x: finite().min(15).max(85),
    y: finite().min(10).max(90),
    scale: finite().min(0.5).max(2),
    color: accentColorSchema,
    backgroundColor: accentColorSchema,
    backgroundOpacity: finite().min(0).max(1),
    durationSeconds: finite().min(0.5).max(10),
    animation: z.enum(["none", "fade", "pop", "slide"]),
  })
  .strict();

export const DEFAULT_OPENING_CAPTION_SETTINGS = {
  enabled: false,
  text: "",
  x: 50,
  y: 22,
  scale: 1,
  color: "#ffffff",
  backgroundColor: "#000000",
  backgroundOpacity: 0.55,
  durationSeconds: 3,
  animation: "fade",
} satisfies z.infer<typeof openingCaptionSettingsSchema>;

export const editorPresetSettingsSchema = z
  .object({
    frameMode: z.enum(["fill", "fit"]),
    image: imageAdjustmentsSchema,
    audio: audioSettingsSchema.omit({ music: true }),
    subtitles: subtitleStyleSchema,
    openingCaption: openingCaptionSettingsSchema,
    templateId: templateIdSchema,
    accentColor: accentColorSchema,
  })
  .strict();

export const editorPresetSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    settings: editorPresetSettingsSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const editorPresetCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    settings: editorPresetSettingsSchema,
  })
  .strict();

export const musicAssetSchema = z
  .object({
    fileName: z.string().regex(/^[a-zA-Z0-9._-]+$/u),
    originalName: z.string().trim().min(1).max(255),
    mimeType: musicSettingsSchema.shape.mimeType,
    mediaUrl: z.string().min(1),
  })
  .strict();

export const editorPresetListSchema = z.array(editorPresetSchema);

export type ImageAdjustments = z.infer<typeof imageAdjustmentsSchema>;
export type AudioSettings = z.infer<typeof audioSettingsSchema>;
export type SubtitleStyle = z.infer<typeof subtitleStyleSchema>;
export type OpeningCaptionSettings = z.infer<
  typeof openingCaptionSettingsSchema
>;
export type EditorPreset = z.infer<typeof editorPresetSchema>;
export type EditorPresetCreateInput = z.infer<typeof editorPresetCreateSchema>;
export type MusicAsset = z.infer<typeof musicAssetSchema>;

export function imageFilterCss(settings: ImageAdjustments) {
  const exposureFactor = 2 ** settings.exposure;
  const brightness = (settings.brightness / 100) * exposureFactor;
  const contrast = settings.contrast / 100 + (settings.sharpness / 100) * 0.18;
  const saturation = settings.saturation / 100;
  const warmth = Math.abs(settings.temperature) / 100;
  const hue = settings.temperature * -0.12 + settings.tint * 0.18;
  return [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrast.toFixed(3)})`,
    `saturate(${saturation.toFixed(3)})`,
    warmth ? `sepia(${(warmth * 0.16).toFixed(3)})` : "",
    hue ? `hue-rotate(${hue.toFixed(2)}deg)` : "",
    settings.blur ? `blur(${settings.blur.toFixed(2)}px)` : "",
    `opacity(${(settings.opacity / 100).toFixed(3)})`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function imageTransformCss(
  settings: ImageAdjustments,
  animatedZoom = settings.zoom,
) {
  const flip = settings.flipHorizontal ? -1 : 1;
  return `rotate(${settings.rotation}deg) scale(${animatedZoom * flip}, ${animatedZoom})`;
}
