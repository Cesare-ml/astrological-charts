import { Posizione } from './posizione.model';
import moment from 'moment-timezone';

export class Tema {
  id!: number;
  nome!: string;
  data!: string; // formato "aaaa-mm-gg"
  ora!: string;
  sesso?: string;
  orario_sconosciuto!: boolean;
  img_nome?: string;
  utente_id!: number;
  gruppi?: string[];
  note?: string;
  posizione_id!: number;
  posizione!: Posizione;

  constructor(obj?: Partial<Tema>) {
    this.id = obj?.id ?? -1;
    this.nome = obj?.nome ?? '';
    this.data = obj?.data ?? '';
    this.ora = obj?.ora ?? '';
    this.orario_sconosciuto = obj?.orario_sconosciuto ?? false;
    this.img_nome = obj?.img_nome;
    this.utente_id = obj?.utente_id ?? -1;
    this.gruppi = obj?.gruppi ?? [];
    this.note = obj?.note ?? '';
    this.posizione_id = obj?.posizione_id ?? -1;

    // Inizializza posizione come istanza di Posizione, anche se esiste in `obj`
    this.posizione = obj?.posizione instanceof Posizione
      ? obj.posizione
      : new Posizione(obj?.posizione);
  }

  getDataoraUtc() {
    const datetimeObj = moment.tz(this.data + " " + this.ora, this.posizione.getTz());
    return datetimeObj.utc().format("YYYY-MM-DD HH:mm:ss");
  }
}
