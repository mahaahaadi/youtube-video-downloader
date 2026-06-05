import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

function getYtdlpBinaryPath(): string {
  const packageJsonPath = require.resolve('youtube-dl-exec/package.json');
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  return join(packageJsonPath, '..', 'bin', binaryName);
}

function runYtdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const processRef = spawn(getYtdlpBinaryPath(), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    processRef.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    processRef.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    processRef.on('error', reject);
    processRef.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
  });
}

export function spawnYtdlp(args: string[]) {
  return spawn(getYtdlpBinaryPath(), args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

export async function fetchYtdlpJson<T>(url: string): Promise<T> {
  const output = await runYtdlp([
    '--dump-single-json',
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    url,
  ]);

  return JSON.parse(output) as T;
}

export async function fetchYtdlpDirectUrl(url: string, formatSelector: string): Promise<string> {
  const output = await runYtdlp(['--get-url', '-f', formatSelector, '--no-playlist', '--no-warnings', url]);
  return output.trim();
}
