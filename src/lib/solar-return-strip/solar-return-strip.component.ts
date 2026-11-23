import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';

/** Longitudes and glyph URLs are supplied by the host calculation/UI, never inferred here. */
export interface SolarReturnStripData {
  readonly radixCusps: readonly number[];
  readonly returnCusps: readonly number[];
  readonly axes: readonly {name: string; longitude: number}[];
  readonly planets: readonly {name: string; longitude: number; glyphUrl: string}[];
  readonly signs: readonly {name: string; glyphUrl: string}[];
}

/** Small, responsive 0–360° ecliptic comparison for relocated solar returns. */
@Component({
  selector: 'vs-solar-return-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './solar-return-strip.component.html',
  styleUrls: ['./solar-return-strip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolarReturnStripComponent {
  @Input({required: true}) data!: SolarReturnStripData;
  @Input() label = 'Solar return';
  @Input() radixLabel = 'Radix';
  @Input() returnLabel = 'Return';
  @Input() planetsLabel = 'Planets';
  @Input() signsLabel = 'Signs';

  /** Angular positions render only finite longitudes, normalized at 0° Aries. */
  percent(longitude: number): number {
    return Number.isFinite(longitude) ? (((longitude % 360) + 360) % 360) / 3.6 : 0;
  }

  planetOffset(index: number): number {
    return 6 + (index % 3) * 30;
  }

  degreeLabel(longitude: number): string {
    return Number.isFinite(longitude) ? (Math.round((((longitude % 360) + 360) % 360) * 10) / 10) + '°' : '—';
  }
}
