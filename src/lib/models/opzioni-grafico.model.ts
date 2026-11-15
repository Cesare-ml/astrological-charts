import {Settaggi} from './settaggi.model'

type TemaGrafico = 'dark' | 'light' | 'astrolabio' | 'sun' | 'light-bn' | 'dark-bn';
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
  modalita?: 'essenziali' | 'abumashar' | 'crea';
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

  dodecatemoriAttivi: boolean;
  dodecatemore?: any;

  chakramAttivi: boolean;
  chakram?: any;

  aspettiHoverEl?: string;
  aspettiHoverAnello?: string;

  orePlanetMostraAspetti: boolean;

  temaRadixFocusAspettiAttivo: boolean;
  temaRadixElementoCelesteFocusAspetti: { id: string; nome: string };

  mostraTransiti: boolean;
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
  mostraMonomeri: boolean;
  mostraAspetti: boolean;
  mostraInfoPianeti: boolean;

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

export const defaultOpzioniGrafico: OpzioniGrafico = {
  settaggi: new Settaggi(),
  temaGrafico: 'light',

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
};
