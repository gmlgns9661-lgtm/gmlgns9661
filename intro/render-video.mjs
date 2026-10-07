// 인트로를 MP4 영상으로 렌더링: node render-video.mjs [출력경로] [fps]
// 필요: playwright, ffmpeg
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || path.join(dir, 'intro.mp4');
const fps = Number(process.argv[3] || 30);
const seconds = 15;
const shotsDir = process.env.SHOTS; // 설정 시 특정 프레임 PNG도 저장

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?capture=1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

const canvas = page.locator('#stage');
const total = seconds * fps;
for (let i = 0; i < total; i++) {
  await page.evaluate(f => window.__frame(f), fps);
  const buf = await canvas.screenshot({ type: 'png' });
  if (shotsDir && i % fps === Math.floor(fps / 2)) await import('node:fs').then(fs => fs.writeFileSync(path.join(shotsDir, `t${String(i / fps).padStart(5, '0')}.png`), buf));
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\r${i / fps}s / ${seconds}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\n완료: ${out}`);
