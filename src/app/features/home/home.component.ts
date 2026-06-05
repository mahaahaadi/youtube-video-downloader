import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Message } from 'primeng/message';
import type { VideoAnalysis } from '../../core/models/download.models';
import { YoutubeApiService } from '../../core/services/youtube-api.service';
import { extractApiErrorMessage } from '../../core/utils/error.utils';
import { AnalysisSkeletonComponent } from '../../shared/components/analysis-skeleton/analysis-skeleton.component';
import { DownloadStudioComponent } from '../../shared/components/download-studio/download-studio.component';
import { UrlInputComponent } from '../../shared/components/url-input/url-input.component';

@Component({
  selector: 'app-home',
  imports: [UrlInputComponent, DownloadStudioComponent, AnalysisSkeletonComponent, Message],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('550ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
    trigger('errorShake', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-12px)' }),
        animate(
          '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'none' }),
        ),
      ]),
    ]),
    trigger('resultsEnter', [
      transition(':enter', [
        query(
          ':scope > *',
          [
            style({ opacity: 0, transform: 'translateY(20px) scale(0.98)' }),
            stagger(70, [
              animate(
                '600ms cubic-bezier(0.16, 1, 0.3, 1)',
                style({ opacity: 1, transform: 'none' }),
              ),
            ]),
          ],
          { optional: true },
        ),
      ]),
    ]),
  ],
})
export class HomeComponent {
  private readonly youtubeApi = inject(YoutubeApiService);

  protected readonly loading = signal(false);
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sourceUrl = signal('');
  protected readonly analysis = signal<VideoAnalysis | null>(null);

  protected readonly hasResults = computed(() => Boolean(this.analysis()?.formats.length));

  protected analyze(url: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.analysis.set(null);
    this.sourceUrl.set(url);

    this.youtubeApi.analyze(url).subscribe({
      next: (result) => {
        this.analysis.set(result);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(
          extractApiErrorMessage(err, 'Unable to analyze this video. Please try another URL.'),
        );
        this.loading.set(false);
      },
    });
  }

  protected download(event: { url: string; formatId: string }): void {
    this.downloading.set(true);

    const link = document.createElement('a');
    link.href = this.youtubeApi.buildDownloadUrl(event.url, event.formatId);
    link.download = '';
    link.rel = 'noopener';
    link.click();

    window.setTimeout(() => this.downloading.set(false), 1200);
  }
}
