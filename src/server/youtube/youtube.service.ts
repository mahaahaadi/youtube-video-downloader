import {
  extractVideoId,
  resolutionLabel,
  type ParsedFormat,
} from './format-parser';
import {
  extractYtdlpFormatId,
  parseYtdlpFormats,
  parseYtdlpSubtitles,
  parseYtdlpThumbnails,
  type YtdlpInfo,
} from './ytdlp-parser';
import { fetchYtdlpDirectUrl, fetchYtdlpJson, spawnYtdlp } from './ytdlp-runner';
import { computeRecommendations } from './recommendations';

export interface VideoAnalysis {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  durationLabel: string;
  viewCount?: string;
  description: string;
  thumbnailUrl: string;
  formats: ParsedFormat[];
  maxResolution: number;
  maxResolutionLabel: string;
  recommendations: {
    videoId?: string;
    audioId?: string;
    videoLabel: string;
    audioLabel: string;
  };
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function fetchVideoInfo(urlOrId: string): Promise<YtdlpInfo> {
  const videoId = extractVideoId(urlOrId);

  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please paste a valid watch, shorts, or youtu.be link.');
  }

  const url = urlOrId.includes('http') ? urlOrId : `https://www.youtube.com/watch?v=${videoId}`;
  return fetchYtdlpJson<YtdlpInfo>(url);
}

export async function analyzeVideo(urlOrId: string): Promise<VideoAnalysis> {
  const info = await fetchVideoInfo(urlOrId);
  const streamingFormats = parseYtdlpFormats(info.formats ?? []);
  const subtitleFormats = parseYtdlpSubtitles(info);
  const thumbnailFormats = parseYtdlpThumbnails(info);
  const formats = [...streamingFormats, ...subtitleFormats, ...thumbnailFormats];

  const videoHeights = formats
    .filter((format) => format.category === 'video' && format.height)
    .map((format) => format.height as number);

  const maxResolution = videoHeights.length ? Math.max(...videoHeights) : 0;

  return {
    videoId: info.id,
    title: info.title ?? 'Untitled video',
    author: info.uploader ?? info.channel ?? 'Unknown channel',
    duration: info.duration ?? 0,
    durationLabel: formatDuration(info.duration ?? 0),
    viewCount: info.view_count?.toString(),
    description: info.description ?? '',
    thumbnailUrl: info.thumbnail ?? '',
    formats,
    maxResolution,
    maxResolutionLabel: maxResolution
      ? `${resolutionLabel(maxResolution)} max available (${maxResolution}p)`
      : 'No video formats',
    recommendations: computeRecommendations(formats),
  };
}

export async function resolveDownloadFormat(
  urlOrId: string,
  formatId: string,
): Promise<{
  url: string;
  filename: string;
  mimeType: string;
  needsConversion: boolean;
  targetExtension?: string;
  ytdlpFormat?: string;
}> {
  const analysis = await analyzeVideo(urlOrId);
  const format = analysis.formats.find((item) => item.id === formatId);

  if (!format) {
    throw new Error('Selected format is no longer available. Please analyze the video again.');
  }

  const safeTitle = analysis.title
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .slice(0, 80);

  const extension = format.targetExtension ?? format.container;
  const suffix =
    format.category === 'video' && format.height
      ? `-${format.height}p${format.fps ? `-${Math.round(format.fps)}fps` : ''}`
      : format.category === 'subtitle' && format.languageCode
        ? `-${format.languageCode}`
        : '';

  const sourceUrl = urlOrId.includes('http')
    ? urlOrId
    : `https://www.youtube.com/watch?v=${analysis.videoId}`;

  if (format.category === 'audio' && !format.isNative) {
    const nativeId = extractYtdlpFormatId(
      analysis.formats.find((item) => item.category === 'audio' && item.isNative && item.url)?.id ??
        '',
    );

    return {
      url: format.url ?? '',
      filename: `${safeTitle || analysis.videoId}${suffix}.${extension}`,
      mimeType: getMimeType(extension),
      needsConversion: true,
      targetExtension: extension,
      ytdlpFormat: nativeId ? `bestaudio[format_id=${nativeId}]/bestaudio` : 'bestaudio',
    };
  }

  const ytdlpFormatId = extractYtdlpFormatId(formatId);

  if (ytdlpFormatId) {
    const freshUrl = await fetchYtdlpDirectUrl(sourceUrl, ytdlpFormatId);

    return {
      url: freshUrl,
      filename: `${safeTitle || analysis.videoId}${suffix}.${extension}`,
      mimeType: getMimeType(extension),
      needsConversion: false,
      targetExtension: extension,
      ytdlpFormat: ytdlpFormatId,
    };
  }

  if (!format.url) {
    throw new Error('Selected format is no longer available. Please analyze the video again.');
  }

  return {
    url: format.url,
    filename: `${safeTitle || analysis.videoId}${suffix}.${extension}`,
    mimeType: getMimeType(extension),
    needsConversion: false,
    targetExtension: extension,
  };
}

function getMimeType(extension: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    vtt: 'text/vtt',
    srt: 'application/x-subrip',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };

  return map[extension] ?? 'application/octet-stream';
}

export async function streamDownload(
  urlOrId: string,
  formatId: string,
  res: import('express').Response,
): Promise<void> {
  const resolved = await resolveDownloadFormat(urlOrId, formatId);
  const videoId = extractVideoId(urlOrId);
  const sourceUrl = urlOrId.includes('http') ? urlOrId : `https://www.youtube.com/watch?v=${videoId}`;

  res.setHeader('Content-Type', resolved.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resolved.filename)}"`);

  if (resolved.needsConversion && resolved.targetExtension) {
    await pipeYtdlp(
      res,
      [
        '-f',
        resolved.ytdlpFormat ?? 'bestaudio',
        '--extract-audio',
        '--audio-format',
        resolved.targetExtension,
        '--no-playlist',
        '--no-warnings',
        '-o',
        '-',
        sourceUrl,
      ],
      `Audio conversion to ${resolved.targetExtension.toUpperCase()} failed. Install FFmpeg on the server.`,
    );
    return;
  }

  if (resolved.ytdlpFormat) {
    await pipeYtdlp(
      res,
      [
        '-f',
        resolved.ytdlpFormat,
        '--no-playlist',
        '--no-warnings',
        '--concurrent-fragments',
        '8',
        '--buffer-size',
        '64K',
        '-o',
        '-',
        sourceUrl,
      ],
      'Failed to stream the selected format from YouTube.',
    );
    return;
  }

  if (resolved.url) {
    res.redirect(302, resolved.url);
    return;
  }

  throw new Error('Selected format is no longer available. Please analyze the video again.');
}

async function pipeYtdlp(
  res: import('express').Response,
  args: string[],
  failureMessage: string,
): Promise<void> {
  const subprocess = spawnYtdlp(args);

  await new Promise<void>((resolve, reject) => {
    subprocess.stdout?.pipe(res);
    subprocess.stderr?.on('data', () => undefined);
    subprocess.on('error', reject);
    subprocess.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(failureMessage));
    });
  });
}
