import ffmpegPath from "ffmpeg-static";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.resolve(__dirname, "../docs/demo_frames");
const OUT_DIR = path.resolve(__dirname, "../docs");
const MP4_PATH = path.join(OUT_DIR, "demo_video.mp4");
const CONCAT_FILE = path.join(OUT_DIR, "ffmpeg_concat.txt");

console.log("Using FFmpeg at:", ffmpegPath);

// Find all frame files
const frames = fs
  .readdirSync(FRAMES_DIR)
  .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
  .sort();

console.log(`Found ${frames.length} frames.`);

if (frames.length === 0) {
  console.error("No frames found!");
  process.exit(1);
}

// Target duration: ~120 seconds (2 minutes).
// 120s / frames.length = seconds per frame
const secondsPerFrame = (120 / frames.length).toFixed(3);
console.log(`Duration per frame: ${secondsPerFrame}s (Total video duration: ~120s / 2.0 mins)`);

let concatContent = "";
for (const frame of frames) {
  const fullPath = path.join(FRAMES_DIR, frame).replace(/\\/g, "/");
  concatContent += `file '${fullPath}'\n`;
  concatContent += `duration ${secondsPerFrame}\n`;
}
// Repeat the last frame once as required by ffmpeg concat demuxer
const lastFramePath = path.join(FRAMES_DIR, frames[frames.length - 1]).replace(/\\/g, "/");
concatContent += `file '${lastFramePath}'\n`;

fs.writeFileSync(CONCAT_FILE, concatContent);
console.log("Wrote concat instructions to:", CONCAT_FILE);

// Encode with H.264, standard 1080p canvas with padding, yuv420p for universal compatibility (QuickTime, Chrome, Windows Media Player, VLC)
const ffmpegCmd = `"${ffmpegPath}" -y -f concat -safe 0 -i "${CONCAT_FILE}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0c,format=yuv420p" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -movflags +faststart "${MP4_PATH}"`;

console.log("Encoding 2-minute MP4 video...");
try {
  execSync(ffmpegCmd, { stdio: "inherit" });
  console.log("MP4 encoding finished successfully!");
  const stats = fs.statSync(MP4_PATH);
  console.log(`Output: ${MP4_PATH}`);
  console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} catch (err) {
  console.error("Encoding failed:", err);
  process.exit(1);
}

