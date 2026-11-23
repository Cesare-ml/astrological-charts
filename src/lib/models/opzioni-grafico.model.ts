import {Settaggi} from './settaggi.model'

type TemaGrafico = 'virgostars' | 'dark' | 'light' | 'astrolabio' | 'astrolabio-girasole' | 'sun' | 'light-bn' | 'dark-bn';
type Pianeta =
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Sun'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'mean Node'
  | 'osc. Apogee';

interface EffemeridiPianetiAttivi {
  [key: string]: boolean;
}

interface SinastriaOptions {
  sinastriaDeflettiva: boolean;
  deflettiSuCasa?: number;
  invertiTemi: boolean;
}

interface Ascendenza {
  pianeta?: string;
  asse?: string;
}

interface PartiArabeOptions {
  modalita?: 'essenziali' | 'abu mashar' | 'crea';
  formulaAbumasharCasaSelezionata?: number;
  formulaSelezionataIndex?: number;
  elDestinazione?: string;
  nomeElCeleste?: string;
}

interface SinodoInUso {
  pianeta?: string;
  fase: number;
}

export interface OpzioniGrafico {
  settaggi: Settaggi;

  temaGrafico: TemaGrafico;

  elementi: {
    mostraDodecatemori: boolean;
  };

  mostraEffemeridi: boolean;
  effemeridiGrafiche: boolean;
  effemeridiGrafichePianetiAttivi: EffemeridiPianetiAttivi;

  disegnaAsseNomePianeta?: boolean;

  latitudiniPianetaSelezionato?: string;
  /** Optional host-requested initial latitude-view camera distance. */
  latitudiniDistanzaCamera?: number;

  dodecatemoriAttivi: boolean;
  dodecatemore?: any;
  /** Precomputed reflection facts supplied by the host, not calculated by the renderer. */
  proiezioneZodiacale?: {
    tipo: 'antisci' | 'contrantisci';
    asse: 'Cardinale' | 'Fissa' | 'Mutevole';
    pianeta: string;
    punti: ReadonlyArray<{name:string; longitude:number; antiscia:number; contraAntiscia:number; retrograde:boolean}>;
  };

  chakramAttivi: boolean;
  chakram?: any;

  aspettiHoverEl?: string;
  aspettiHoverAnello?: string;

  orePlanetMostraAspetti: boolean;

  temaRadixFocusAspettiAttivo: boolean;
  temaRadixElementoCelesteFocusAspetti: { id: string; nome: string };

  mostraTransiti: boolean;
  /** Draw the transit chart's ASC/DS/MC/IC as dashed external markers. Opt-in. */
  mostraAssiTransiti?: boolean;
  /** Optional outer-axes display on a synastry chart. */
  mostraAssiSinastria?: boolean;
  mostraTransitiSinodici: boolean;
  transitoSinodicoNomePianeta?: string;
  transitoSinodicoFase: string;
  transitoSinodicoLunaNeraConjCount: number;
  transitoSinodicoSinastriaConRadix: boolean;
  transitoSinodicoFissatoInBackground: boolean;
  temaTransitiSinodoRender?: any;

  mostraSinastria: boolean;
  sinastria: SinastriaOptions;

  temaRivSolare?: any;
  mostraRivSolare: boolean;
  mostraRivLunare: boolean;
  mostraSizigia: boolean;

  mostraStagioni: boolean;

  mostraTermini: boolean;
  mostraDecani?: boolean;
  mostraDecadi?: boolean;
  /** Aspect classifications computed by the host; null is deliberately unknown. */
  applicazioniAspetti?: {modo:'applying'|'separating'; stati:ReadonlyArray<{aspetto:string; da:string; a:string; applicante:boolean|null}>};
  mostraMonomeri: boolean;
  /** Hide a primary-wheel axis glyph when its external marker is displayed. */
  nascondiAssiDuplicati?: boolean;
  mostraAspetti: boolean;
  mostraInfoPianeti: boolean;
  /** Shows 0–29° beside each celestial symbol; defaults on, including for legacy callers omitting this field. */
  mostraGradiElementiCelesti?: boolean;
  /** Separate, individually configurable markers on the natal chart rim. */
  mostraFrecciaAscendente?: boolean;
  mostraRetroFrecciaDiscendente?: boolean;
  mostraFrecciaMC?: boolean;
  mostraRetroFrecciaIC?: boolean;
  mostraGradiAssi?: boolean;
  /** ASC, DSC, MC and IC names just beyond their markers. Defaults on. */
  mostraNomiAssi?: boolean;
  mostraOraPlanetariaAscendente?: boolean;
  /** Separate MC movement triangle. Off in new chart settings; opt in explicitly. */
  mostraDirezioneMotoMC?: boolean;
  /** House numeral multiplier, e.g. 1.25. */
  dimensioneNumeriCase?: number;

  mostraAntisci: boolean;
  antisci: {
    Cardinale: boolean;
    Fissa: boolean;
    Mutevole: boolean;
  };
  antisciHover?: any;
  antisciTransitiHover?: any;

  mostraAscendenze: boolean;
  ascendenzaInUso: Ascendenza;

  mostraLunazioniErmetiche: boolean;
  lunazioniErmeticheElSelezionato?: any;

  mostraAstrologiaOraria: boolean;
  startAstrologiaOraria: boolean;
  astrologiaOrariaExtendView: boolean;
  astrologiaOrariaElCelesteAttivo?: any;
  astrologiaOrariaTemaSalvato: boolean;

  mostraPartiArabe: boolean;
  partiArabe: PartiArabeOptions;

  ascendenzeSelezionato: string;

  sinodi?: any;
  sinodoInUso: SinodoInUso;

  kleros?: 'estrapola' | 'visualizza sorti';

  mostraStelleFisse: boolean;
  stelleFisseRender?: any;

  mostraDirezioni: boolean;
  direzioniModalita?: any;
  direzioniDegOffs: number;
  direzioni2ndTemaRender?: any;
}

/**
 * Create independent chart options, including fresh nested objects and Settaggi
 * instances. Use this for multiple charts instead of sharing the legacy default.
 */
export const createDefaultOpzioniGrafico = (): OpzioniGrafico => ({
  settaggi: new Settaggi(),
  temaGrafico: 'virgostars',

  elementi: { mostraDodecatemori: false },

  mostraEffemeridi: false,
  effemeridiGrafiche: false,
  effemeridiGrafichePianetiAttivi: {
    Moon: true,
    Mercury: true,
    Venus: true,
    Sun: true,
    Mars: true,
    Jupiter: true,
    Saturn: true,
    'mean Node': true,
    'osc. Apogee': true,
  },

  disegnaAsseNomePianeta: undefined,
  latitudiniPianetaSelezionato: undefined,
  latitudiniDistanzaCamera: undefined,

  dodecatemoriAttivi: false,
  dodecatemore: undefined,

  chakramAttivi: false,
  chakram: undefined,

  aspettiHoverEl: undefined,
  aspettiHoverAnello: undefined,

  orePlanetMostraAspetti: false,

  temaRadixFocusAspettiAttivo: false,
  temaRadixElementoCelesteFocusAspetti: { id: '0', nome: 'Sun' },

  mostraTransiti: false,
  mostraAssiTransiti: false,
  mostraAssiSinastria: false,
  mostraTransitiSinodici: false,
  transitoSinodicoNomePianeta: undefined,
  transitoSinodicoFase: 'd1',
  transitoSinodicoLunaNeraConjCount: 1,
  transitoSinodicoSinastriaConRadix: false,
  transitoSinodicoFissatoInBackground: false,
  temaTransitiSinodoRender: undefined,

  mostraSinastria: false,
  sinastria: {
    sinastriaDeflettiva: false,
    deflettiSuCasa: undefined,
    invertiTemi: false,
  },

  temaRivSolare: undefined,
  mostraRivSolare: false,
  mostraRivLunare: false,
  mostraSizigia: false,

  mostraStagioni: false,
  mostraTermini: false,
  mostraMonomeri: false,
  mostraAspetti: true,
  mostraInfoPianeti: false,
  mostraGradiElementiCelesti: true,
  mostraFrecciaAscendente: true,
  mostraRetroFrecciaDiscendente: true,
  mostraFrecciaMC: true,
  mostraRetroFrecciaIC: true,
  mostraGradiAssi: true,
  mostraNomiAssi: true,
  mostraOraPlanetariaAscendente: true,
  mostraDirezioneMotoMC: false,
  dimensioneNumeriCase: 1.25,

  mostraAntisci: false,
  antisci: { Cardinale: false, Fissa: false, Mutevole: false },
  antisciHover: undefined,
  antisciTransitiHover: undefined,

  mostraAscendenze: false,
  ascendenzaInUso: { pianeta: undefined, asse: undefined },

  mostraLunazioniErmetiche: false,
  lunazioniErmeticheElSelezionato: undefined,

  mostraAstrologiaOraria: false,
  startAstrologiaOraria: false,
  astrologiaOrariaExtendView: false,
  astrologiaOrariaElCelesteAttivo: undefined,
  astrologiaOrariaTemaSalvato: false,

  mostraPartiArabe: false,
  partiArabe: {
    modalita: undefined,
    formulaAbumasharCasaSelezionata: undefined,
    formulaSelezionataIndex: undefined,
    elDestinazione: undefined,
    nomeElCeleste: undefined,
  },

  ascendenzeSelezionato: '',

  sinodi: undefined,
  sinodoInUso: { pianeta: undefined, fase: 0 },

  kleros: undefined,

  mostraStelleFisse: false,
  stelleFisseRender: undefined,

  mostraDirezioni: false,
  direzioniModalita: undefined,
  direzioniDegOffs: 0,
  direzioni2ndTemaRender: undefined,
});

/** Legacy shared object retained for existing consumers. */
export const defaultOpzioniGrafico: OpzioniGrafico = createDefaultOpzioniGrafico();
