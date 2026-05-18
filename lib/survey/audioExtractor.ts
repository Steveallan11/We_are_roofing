import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegInstaller.path);

export async function transcribeAudio(videoBuffer: Buffer): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for video survey transcription.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "survey-audio-"));
  const inputPath = path.join(tmpDir, "input.webm");
  const outputPath = path.join(tmpDir, "audio.mp3");
  fs.writeFileSync(inputPath, videoBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("64k")
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .run();
    });

    const file = fs.createReadStream(outputPath);
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en",
      prompt:
        "Roofing survey. Terms: ridge, hip, valley, eaves, verge, flashing, parapet, EPDM, GRP, felt flat, concrete tile, slate, batten, underlay, fascia, soffit, scaffold, mortar, pointing."
    });

    return transcription.text.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio transcription failed.";
    console.warn(`Video survey audio transcription skipped: ${message}`);
    return "";
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
