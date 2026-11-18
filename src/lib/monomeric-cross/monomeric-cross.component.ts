import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type MonomericCrossPosition = 'master' | 'square-left' | 'square-right' | 'opposite';

/** Historical descriptions are optional and must come from a licensed, verified catalog. */
export interface MonomericCrossArmView {
  position: MonomericCrossPosition;
  sign: string;
  longitudeDeg: number;
  house: number | null;
  description?: string | null;
  signRuler: string;
  signRulerDomicile?: 'PRIMARY' | 'SECONDARY' | null;
  rulerSign?: string | null;
  rulerHouse?: number | null;
  rulerDescription?: string | null;
}

export interface MonomericCrossView {
  hourRuler: string;
  houseSystem: string;
  catalogAttribution?: string | null;
  /** Explain the exact historical degree convention, if approved. */
  degreeConvention?: string | null;
  arms: readonly MonomericCrossArmView[];
}

const LABELS: Record<MonomericCrossPosition, { it: string; en: string }> = {
  master: {it: "Maestro dell'ora", en: 'Planetary-hour ruler'},
  'square-left': {it: 'Quadratura +90°', en: 'Square +90°'},
  'square-right': {it: 'Quadratura −90°', en: 'Square −90°'},
  opposite: {it: 'Opposizione 180°', en: 'Opposition 180°'},
};

/** Pure Angular/HTML rendering; no ephemeris calls or historical catalog assumptions. */
@Component({
  selector: 'vs-monomeric-cross',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monomeric-cross.component.html',
  styleUrl: './monomeric-cross.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonomericCrossComponent {
  @Input() cross: MonomericCrossView | null = null;
  @Input() locale: 'it' | 'en' = 'it';
  selected: MonomericCrossPosition = 'master';

  get selectedArm(): MonomericCrossArmView | null {
    return this.cross?.arms.find(arm => arm.position === this.selected) ?? null;
  }

  label(position: MonomericCrossPosition): string { return LABELS[position][this.locale]; }

  degree(longitudeDeg: number): string {
    if (!Number.isFinite(longitudeDeg)) return '—';
    const arcMinutes = Math.floor((((longitudeDeg % 30) + 30) % 30) * 60 + 1e-8);
    return `${Math.floor(arcMinutes / 60)}° ${String(arcMinutes % 60).padStart(2, '0')}′`;
  }

  house(house: number | null | undefined): string {
    if (house == null || !Number.isInteger(house) || house < 1 || house > 12) return '—';
    return [
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
    ][house - 1];
  }
}
