import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { verticalClipPropsSchema, type VerticalClipProps } from "./schema.js";

export async function renderVerticalClip(options: {
  publicDir: string;
  outputPath: string;
  props: VerticalClipProps;
  onProgress: (progress: number) => void;
  browserExecutable?: string;
}) {
  const props = verticalClipPropsSchema.parse(options.props);
  const serveUrl = await bundle({
    entryPoint: fileURLToPath(new URL("./remotion-entry.tsx", import.meta.url)),
    publicDir: options.publicDir,
    webpackOverride: (configuration) => ({
      ...configuration,
      resolve: {
        ...configuration.resolve,
        extensionAlias: {
          ...configuration.resolve?.extensionAlias,
          ".js": [".ts", ".tsx", ".js"],
          ".mjs": [".mts", ".mjs"],
          ".cjs": [".cts", ".cjs"],
        },
      },
    }),
  });
  const composition = await selectComposition({
    serveUrl,
    id: "VerticalClip",
    inputProps: props,
    browserExecutable: options.browserExecutable,
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    pixelFormat: "yuv420p",
    outputLocation: options.outputPath,
    inputProps: props,
    onProgress: ({ progress }) => options.onProgress(progress),
    browserExecutable: options.browserExecutable,
  });
}
