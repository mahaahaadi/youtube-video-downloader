import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { VideoAnalysis } from '../models/download.models';

@Injectable({ providedIn: 'root' })
export class YoutubeApiService {
  private readonly http = inject(HttpClient);

  analyze(url: string): Observable<VideoAnalysis> {
    return this.http.post<VideoAnalysis>('/api/youtube/analyze', { url });
  }

  buildDownloadUrl(url: string, formatId: string): string {
    const params = new URLSearchParams({ url, formatId });
    return `/api/youtube/download?${params.toString()}`;
  }
}
