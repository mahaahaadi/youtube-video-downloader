import {
  formatBytes,
  parseCaptions,
  parseThumbnails,
  resolutionLabel,
  type ParsedFormat,
} from './format-parser';

export interface YtdlpFormat {
  format_id?: string;
  ext?: string;
  format?: string;
  format_note?: string;
  resolution?: string;
  height?: number;
  width?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  abr?: number;
  url?: string;
  language?: string;
}

export interface YtdlpInfo {
  id: string;
  title: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  view_count?: number;
  description?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string; width?: number; height?: number }>;
  formats?: YtdlpFormat[];
  subtitles?: Record<string, Array<{ ext?: string; url?: string; name?: string }>>;
  automatic_captions?: Record<string, Array<{ ext?: string; url?: string; name?: string }>>;
}

const AUDIO_OUTPUT_FORMATS = [
  { ext: 'opus', label: 'Opus' },
  { ext: 'm4a', label: 'M4A (AAC)' },
  { ext: 'mp3', label: 'MP3' },
  { ext: 'aac', label: 'AAC' },
  { ext: 'flac', label: 'FLAC' },
  { ext: 'wav', label: 'WAV' },
  { ext: 'ogg', label: 'OGG Vorbis' },
] as const;

function qualityRank(height?: number, fps?: number): number {
  return (height ?? 0) * 100 + (fps ?? 30);
}

function isVideoFormat(format: YtdlpFormat): boolean {
  return Boolean(format.vcodec && format.vcodec !== 'none');
}

function isAudioFormat(format: YtdlpFormat): boolean {
  return Boolean(format.acodec && format.acodec !== 'none' && !isVideoFormat(format));
}

function isCombinedFormat(format: YtdlpFormat): boolean {
  return isVideoFormat(format) && isAudioFormat(format);
}

export function parseYtdlpFormats(formats: YtdlpFormat[]): ParsedFormat[] {
  const parsed: ParsedFormat[] = [];

  for (const format of formats) {
    if (!format.url || !format.format_id) {
      continue;
    }

    const height = format.height || undefined;
    const fps = format.fps || undefined;
    const fileSize = format.filesize ?? format.filesize_approx;
    const bitrate = format.tbr ? format.tbr * 1000 : format.abr ? format.abr * 1000 : undefined;

    if (isCombinedFormat(format)) {
      parsed.push({
        id: `video-${format.format_id}`,
        category: 'video',
        label: `${resolutionLabel(height)}${fps ? ` @ ${Math.round(fps)}fps` : ''}`,
        description: `${format.ext?.toUpperCase() ?? 'MP4'} · ${format.format_note ?? 'Progressive (video + audio)'}`,
        container: format.ext ?? 'mp4',
        codec: format.vcodec,
        bitrate,
        fileSize,
        fileSizeLabel: formatBytes(fileSize),
        height,
        width: format.width,
        fps,
        url: format.url,
        qualityRank: qualityRank(height, fps) + 1000,
        hasVideo: true,
        hasAudio: true,
        isNative: true,
        targetExtension: format.ext,
      });
      continue;
    }

    if (isVideoFormat(format)) {
      parsed.push({
        id: `video-${format.format_id}`,
        category: 'video',
        label: `${resolutionLabel(height)}${fps ? ` @ ${Math.round(fps)}fps` : ''}`,
        description: `${format.vcodec} · ${format.format_note ?? 'Video stream'}`,
        container: format.ext ?? 'mp4',
        codec: format.vcodec,
        bitrate,
        fileSize,
        fileSizeLabel: formatBytes(fileSize),
        height,
        width: format.width,
        fps,
        url: format.url,
        qualityRank: qualityRank(height, fps),
        hasVideo: true,
        hasAudio: false,
        isNative: true,
        targetExtension: format.ext,
      });
      continue;
    }

    if (isAudioFormat(format)) {
      parsed.push({
        id: `audio-native-${format.format_id}`,
        category: 'audio',
        label: `${format.abr ?? format.tbr ?? 'Best'} kbps`,
        description: `${format.acodec} · Native audio (${format.ext?.toUpperCase()})`,
        container: format.ext ?? 'm4a',
        codec: format.acodec,
        bitrate,
        fileSize,
        fileSizeLabel: formatBytes(fileSize),
        url: format.url,
        qualityRank: format.abr ?? format.tbr ?? 0,
        hasVideo: false,
        hasAudio: true,
        isNative: true,
        targetExtension: format.ext,
      });
    }
  }

  const bestAudio = [...parsed]
    .filter((format) => format.category === 'audio' && format.isNative)
    .sort((a, b) => b.qualityRank - a.qualityRank)[0];

  if (bestAudio) {
    for (const output of AUDIO_OUTPUT_FORMATS) {
      const isNative = output.ext === bestAudio.targetExtension;

      parsed.push({
        id: `audio-convert-${output.ext}-${bestAudio.id}`,
        category: 'audio',
        label: output.label,
        description: isNative
          ? `${output.label} · Best native quality`
          : `${output.label} · Converted via FFmpeg on download`,
        container: output.ext,
        codec: output.label,
        fileSize: bestAudio.fileSize,
        fileSizeLabel: bestAudio.fileSizeLabel,
        url: bestAudio.url,
        qualityRank: bestAudio.qualityRank + (isNative ? 1000 : 500),
        hasVideo: false,
        hasAudio: true,
        isNative,
        targetExtension: output.ext,
      });
    }
  }

  const unique = new Map<string, ParsedFormat>();
  for (const format of parsed) {
    const key = `${format.category}|${format.label}|${format.fps ?? 0}|${format.container}|${format.isNative}`;
    const existing = unique.get(key);
    if (!existing || (format.fileSize ?? 0) > (existing.fileSize ?? 0)) {
      unique.set(key, format);
    }
  }

  return [...unique.values()].sort((a, b) => {
    if (a.category !== b.category) {
      const order = { video: 0, audio: 1, subtitle: 2, thumbnail: 3 };
      return order[a.category] - order[b.category];
    }

    if (a.category === 'video') {
      return a.qualityRank - b.qualityRank;
    }

    return b.qualityRank - a.qualityRank;
  });
}

export function parseYtdlpSubtitles(info: YtdlpInfo): ParsedFormat[] {
  const tracks: Array<Record<string, unknown>> = [];

  for (const [languageCode, entries] of Object.entries(info.subtitles ?? {})) {
    for (const [index, entry] of entries.entries()) {
      tracks.push({
        language_code: languageCode,
        name: { text: entry.name ?? languageCode },
        base_url: entry.url,
        kind: 'manual',
        index,
      });
    }
  }

  for (const [languageCode, entries] of Object.entries(info.automatic_captions ?? {})) {
    for (const [index, entry] of entries.entries()) {
      tracks.push({
        language_code: languageCode,
        name: { text: `${entry.name ?? languageCode} (auto-generated)` },
        base_url: entry.url,
        kind: 'asr',
        index: tracks.length + index,
      });
    }
  }

  return parseCaptions(tracks);
}

export function parseYtdlpThumbnails(info: YtdlpInfo): ParsedFormat[] {
  const thumbnails = (info.thumbnails ?? []).map((thumb) => ({
    url: thumb.url,
    width: thumb.width,
    height: thumb.height,
  }));

  if (info.thumbnail) {
    thumbnails.push({ url: info.thumbnail, width: undefined, height: undefined });
  }

  return parseThumbnails(thumbnails as Array<Record<string, unknown>>);
}

export function extractYtdlpFormatId(parsedFormatId: string): string | null {
  if (parsedFormatId.startsWith('video-')) {
    return parsedFormatId.replace('video-', '');
  }

  if (parsedFormatId.startsWith('audio-native-')) {
    return parsedFormatId.replace('audio-native-', '');
  }

  if (parsedFormatId.startsWith('audio-convert-')) {
    if (parsedFormatId.includes('audio-native-')) {
      return parsedFormatId.split('audio-native-')[1] ?? null;
    }

    return null;
  }

  return null;
}
