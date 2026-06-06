import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;

const getFfmpegPath = (): string => {
  const packagedPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'ffmpeg-static', 'ffmpeg')
    : '';
  if (packagedPath && existsSync(packagedPath)) {
    return packagedPath;
  }

  if (!ffmpegPath) {
    throw new Error('ffmpeg binary was not found.');
  }
  return ffmpegPath;
};

const escapeConcatPath = (filePath: string): string => filePath.replace(/'/g, "'\\''");

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args);
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });
  });

export const concatMp3Files = async (inputPaths: string[], outputPath: string): Promise<void> => {
  if (inputPaths.length === 0) {
    throw new Error('Cannot assemble an MP3 with no input files.');
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'longread-ffmpeg-'));
  const listPath = path.join(tempDir, 'inputs.txt');
  const listBody = inputPaths.map((inputPath) => `file '${escapeConcatPath(inputPath)}'`).join('\n');
  await writeFile(listPath, `${listBody}\n`, 'utf8');

  await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-c',
    'copy',
    outputPath
  ]);
};

export const writeSilentMp3 = async (outputPath: string, durationSeconds: number): Promise<void> => {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-t',
    String(durationSeconds),
    '-q:a',
    '9',
    '-acodec',
    'libmp3lame',
    outputPath
  ]);
};
