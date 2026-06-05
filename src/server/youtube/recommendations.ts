import type { ParsedFormat } from './format-parser';
import { resolutionLabel } from './format-parser';

export interface FormatRecommendations {
  videoId?: string;
  audioId?: string;
  videoLabel: string;
  audioLabel: string;
}

export function computeRecommendations(formats: ParsedFormat[]): FormatRecommendations {
  const videos = formats.filter((format) => format.category === 'video');
  const audios = formats.filter((format) => format.category === 'audio');

  const bestVideo =
    [...videos]
      .sort((a, b) => {
        const combinedBonus = (format: ParsedFormat) => (format.hasAudio ? 1_000_000 : 0);
        return (
          combinedBonus(b) +
          b.qualityRank -
          (combinedBonus(a) + a.qualityRank)
        );
      })[0] ?? null;

  const bestAudio =
    [...audios]
      .filter((format) => format.isNative)
      .sort((a, b) => b.qualityRank - a.qualityRank)[0] ??
    [...audios].sort((a, b) => b.qualityRank - a.qualityRank)[0] ??
    null;

  return {
    videoId: bestVideo?.id,
    audioId: bestAudio?.id,
    videoLabel: bestVideo
      ? `${bestVideo.label} · ${bestVideo.container.toUpperCase()}${bestVideo.hasAudio ? ' + audio' : ''}`
      : 'No video available',
    audioLabel: bestAudio
      ? `${bestAudio.label} · ${(bestAudio.targetExtension ?? bestAudio.container).toUpperCase()}`
      : 'No audio available',
  };
}

export function pickRecommendedVideo(formats: ParsedFormat[]): ParsedFormat | null {
  const id = computeRecommendations(formats).videoId;
  return formats.find((format) => format.id === id) ?? null;
}

export function pickRecommendedAudio(formats: ParsedFormat[]): ParsedFormat | null {
  const id = computeRecommendations(formats).audioId;
  return formats.find((format) => format.id === id) ?? null;
}

export function formatSummary(format: ParsedFormat): string {
  const parts = [format.label, format.container.toUpperCase()];

  if (format.codec) {
    parts.push(format.codec);
  }

  if (format.fileSizeLabel) {
    parts.push(format.fileSizeLabel);
  }

  return parts.join(' · ');
}

export function resolutionOptionLabel(height: number, maxHeight: number): string {
  const label = resolutionLabel(height);
  return height === maxHeight ? `${label} (Max)` : label;
}
