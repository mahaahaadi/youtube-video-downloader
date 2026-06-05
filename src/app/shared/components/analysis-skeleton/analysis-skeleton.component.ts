import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

@Component({
  selector: 'app-analysis-skeleton',
  imports: [Skeleton],
  templateUrl: './analysis-skeleton.component.html',
  styleUrl: './analysis-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisSkeletonComponent {}
