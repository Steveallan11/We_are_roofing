import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);

export type ExtractedFrame = {
  buffer: Buffer;
  base64: string;
  timestamp: number;
  filename: string;
  width: number | null;
  height: number | null;
};

export async function extractFrames(
  videoBuffer: Buffer,
  opts: { intervalSeconds: number; maxFrames: number; surveyId: string }
): Promise<ExtractedFrame[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `survey-video-${opts.surveyId}-`));
  const inputPath = path.join(tmpDir, "input.webm");
  fs.writeFileSync(inputPath, videoBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([`-vf fps=1/${opts.intervalSeconds}`, "-q:v 2"])
        .output(path.join(tmpDir, "frame-%03d.jpg"))
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });

    const frameFiles = fs
      .readdirSync(tmpDir)
      .filter((file) => file.endsWith(".jpg"))
      .sort((left, right) => left.localeCompare(right));

    if (frameFiles.length === 0) {
      throw new Error("No frames could be extracted from the uploaded video.");
    }

    const selectedFiles = selectEvenly(frameFiles, opts.maxFrames);
    const frames: ExtractedFrame[] = [];

    for (const [index, file] of selectedFiles.entries()) {
      const buffer = await sharp(path.join(tmpDir, file)).jpeg({ quality: 82 }).toBuffer();
      const metadata = await sharp(buffer).metadata();
      frames.push({
        buffer,
        base64: buffer.toString("base64"),
        timestamp: indexFromFilename(file, index) * opts.intervalSeconds,
        filename: file,
        width: metadata.width ?? null,
        height: metadata.height ?? null
      });
    }

    return frames;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function selectEvenly(items: string[], maxItems: number) {
  if (items.length <= maxItems) return items;

  const result: string[] = [];
  const lastIndex = items.length - 1;
  for (let index = 0; index < maxItems; index += 1) {
    const sourceIndex = Math.round((index / Math.max(1, maxItems - 1)) * lastIndex);
    result.push(items[sourceIndex]);
  }
  return Array.from(new Set(result));
}

function indexFromFilename(filename: string, fallback: number) {
  const match = filename.match(/(\d+)/);
  if (!match) return fallback;
  const numeric = Number.parseInt(match[1], 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}
