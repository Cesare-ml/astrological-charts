
export class CittaLocalDB {
  _ObjId: number;
  citta: string;
  iso2: string;
  label: string;
  lat: number;
  lng: number;
  tz: string;
  tz_offs: number;
  pop?: number;
  regione?: string;
  stato: string;

  constructor(obj?: Partial<CittaLocalDB>) {
    this.citta = obj?.citta ?? '';
    this.iso2 = obj?.iso2 ?? '';
    this.label = obj?.label ?? '';
    this.lat = obj?.lat ?? 0;
    this.lng = obj?.lng ?? 0;
    this.tz = obj?.tz ?? 'utc';
    this.tz_offs = obj?.tz_offs ?? 0;
    this.pop = obj?.pop;
    this.regione = obj?.regione;
    this.stato = obj?.stato;
  }
}


export class PosizioneLocalDB {
  id: number;
  posizione_manuale?: {
    nome?: string;
    lat?: number;
    lng?: number;
    tz?: string;
  };
  usa_posizione_manuale!: boolean;
  citta_id?: number;
  citta?: CittaLocalDB;

  constructor(obj?: Partial<PosizioneLocalDB>) {
    this.id = obj?.id ?? -1;

    // Inizializza posizione_manuale con un oggetto vuoto, se non fornito
    this.posizione_manuale = obj?.posizione_manuale ?? {
     lat: undefined,
     lng: undefined,
     tz: undefined,
     nome: undefined,
    };

    this.usa_posizione_manuale = obj?.usa_posizione_manuale ?? false;
    this.citta_id = obj?.citta_id;

    // Inizializza `citta` in modo sicuro
    this.citta = obj?.citta instanceof CittaLocalDB
     ? obj.citta
     : new CittaLocalDB(obj?.citta);
  }

  public getLng() {
    if (this.usa_posizione_manuale) {
      this.resetCitta();
      return this.posizione_manuale?.lng ?? 0;
    } else {
      this.resetPosManuale();
      return this.citta?.lng ?? 0;
    }
  }

  public getLat() {
    if (this.usa_posizione_manuale) {
      this.resetCitta();
      return this.posizione_manuale?.lat ?? 0;
    } else {
      this.resetPosManuale();
      return this.citta?.lat ?? 0;
    }
  }

  public getTz() {
    if (this.usa_posizione_manuale) {
      this.resetCitta();
      return this.posizione_manuale?.tz ?? 'UTC';
    } else {
      this.resetPosManuale();
      return this.citta?.tz ?? 'UTC';
    }
  }

  public resetPosManuale() {
    this.posizione_manuale = undefined;
  }

  public resetCitta() {
    this.citta_id = undefined;
    this.citta = undefined;
  }
}
