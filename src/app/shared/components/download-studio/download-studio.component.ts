import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import type { DownloadFormat, DownloadTab, VideoAnalysis } from '../../../core/models/download.models';
import {
  buildAudioFormatOptions,
  buildFpsOptions,
  buildResolutionOptions,
  buildSelectionSummary,
  buildSubtitleOptions,
  buildThumbnailOptions,
  buildVideoContainerOptions,
  pickDefaultVideoFormat,
} from '../../../core/utils/format-selection.utils';

@Component({
  selector: 'app-download-studio',
  imports: [FormsModule, Button, Select, Tabs, TabList, Tab, TabPanels, TabPanel, Tag, DecimalPipe],
  templateUrl: './download-studio.component.html',
  styleUrl: './download-studio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DownloadStudioComponent {
  readonly analysis = input.required<VideoAnalysis>();
  readonly sourceUrl = input.required<string>();
  readonly downloading = input(false);
  readonly download = output<{ url: string; formatId: string }>();

  protected readonly activeTab = signal<DownloadTab>('video');
  protected readonly selectedResolution = signal<number | null>(null);
  protected readonly selectedFps = signal<number | null>(null);
  protected readonly selectedVideoFormatId = signal<string | null>(null);
  protected readonly selectedAudioFormatId = signal<string | null>(null);
  protected readonly selectedSubtitleId = signal<string | null>(null);
  protected readonly selectedThumbnailId = signal<string | null>(null);
  protected readonly extraKind = signal<'subtitle' | 'thumbnail'>('subtitle');
  protected readonly thumbLoaded = signal(false);
  private readonly initializedFor = signal<string | null>(null);

  protected readonly formats = computed(() => this.analysis().formats);
  protected readonly recommendations = computed(() => this.analysis().recommendations);

  protected readonly resolutionOptions = computed(() => buildResolutionOptions(this.formats()));
  protected readonly fpsOptions = computed(() => {
    const height = this.selectedResolution();
    return height ? buildFpsOptions(this.formats(), height) : [];
  });

  protected readonly videoContainerOptions = computed(() => {
    const height = this.selectedResolution();
    const fps = this.selectedFps();
    if (!height || !fps) {
      return [];
    }

    return buildVideoContainerOptions(this.formats(), height, fps);
  });

  protected readonly audioFormatOptions = computed(() => buildAudioFormatOptions(this.formats()));
  protected readonly subtitleOptions = computed(() => buildSubtitleOptions(this.formats()));
  protected readonly thumbnailOptions = computed(() => buildThumbnailOptions(this.formats()));

  protected readonly selectedVideoFormat = computed(() => {
    const id = this.selectedVideoFormatId();
    return this.formats().find((format) => format.id === id) ?? null;
  });

  protected readonly selectedAudioFormat = computed(() => {
    const id = this.selectedAudioFormatId();
    return this.formats().find((format) => format.id === id) ?? null;
  });

  protected readonly selectedExtraFormat = computed(() => {
    const id =
      this.extraKind() === 'subtitle' ? this.selectedSubtitleId() : this.selectedThumbnailId();
    return this.formats().find((format) => format.id === id) ?? null;
  });

  protected readonly activeFormat = computed((): DownloadFormat | null => {
    switch (this.activeTab()) {
      case 'video':
        return this.selectedVideoFormat();
      case 'audio':
        return this.selectedAudioFormat();
      case 'extras':
        return this.selectedExtraFormat();
      default:
        return null;
    }
  });

  protected readonly selectionSummary = computed(() => buildSelectionSummary(this.activeFormat()));

  constructor() {
    effect(() => {
      const analysis = this.analysis();
      if (this.initializedFor() === analysis.videoId) {
        return;
      }

      this.initializedFor.set(analysis.videoId);
      this.thumbLoaded.set(false);
      const defaultVideo = pickDefaultVideoFormat(this.formats(), analysis.recommendations.videoId);

      if (defaultVideo?.height) {
        this.selectedResolution.set(defaultVideo.height);
        this.selectedFps.set(Math.round(defaultVideo.fps ?? 30));
        this.selectedVideoFormatId.set(defaultVideo.id);
      }

      if (analysis.recommendations.audioId) {
        this.selectedAudioFormatId.set(analysis.recommendations.audioId);
      }

      const subtitles = buildSubtitleOptions(this.formats());
      const thumbnails = buildThumbnailOptions(this.formats());
      this.selectedSubtitleId.set(subtitles[0]?.value ?? null);
      this.selectedThumbnailId.set(thumbnails.at(-1)?.value ?? null);
      this.extraKind.set(subtitles.length ? 'subtitle' : 'thumbnail');
    });
  }

  protected onResolutionChange(height: number | null): void {
    if (!height) {
      return;
    }

    this.selectedResolution.set(height);
    const fpsOptions = buildFpsOptions(this.formats(), height);
    const nextFps = fpsOptions.at(-1)?.value ?? null;
    this.selectedFps.set(nextFps);

    if (nextFps) {
      const containers = buildVideoContainerOptions(this.formats(), height, nextFps);
      this.selectedVideoFormatId.set(containers.at(-1)?.value ?? null);
    }
  }

  protected onFpsChange(fps: number | null): void {
    if (!fps || !this.selectedResolution()) {
      return;
    }

    this.selectedFps.set(fps);
    const containers = buildVideoContainerOptions(this.formats(), this.selectedResolution() as number, fps);
    this.selectedVideoFormatId.set(containers.at(-1)?.value ?? null);
  }

  protected onTabChange(value: string | number | undefined): void {
    if (value === 'video' || value === 'audio' || value === 'extras') {
      this.activeTab.set(value);
    }
  }

  protected downloadRecommended(kind: 'video' | 'audio'): void {
    const formatId =
      kind === 'video' ? this.recommendations().videoId : this.recommendations().audioId;

    if (!formatId) {
      return;
    }

    this.download.emit({ url: this.sourceUrl(), formatId });
  }

  protected onThumbLoad(): void {
    this.thumbLoaded.set(true);
  }

  protected downloadSelection(): void {
    const format = this.activeFormat();
    if (!format) {
      return;
    }

    this.download.emit({ url: this.sourceUrl(), formatId: format.id });
  }
}
