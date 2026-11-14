import { PosizioneLocalDB } from './posizione-localdb.model';
import moment from 'moment-timezone';

export class TemaLocalDB {
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
  posizione!: PosizioneLocalDB;

  constructor(obj?: Partial<TemaLocalDB>) {
    this.id = obj?.id ?? -1;
    this.nome = obj?.nome ?? '';
    this.data = obj?.data ?? '';
    this.ora = obj?.ora ?? '';
    this.sesso = obj?.sesso;
    this.orario_sconosciuto = obj?.orario_sconosciuto ?? false;
    this.img_nome = obj?.img_nome;
    this.utente_id = obj?.utente_id ?? -1;
    this.gruppi = obj?.gruppi ?? [];
    this.note = obj?.note ?? '';
    this.posizione_id = obj?.posizione_id ?? -1;

    // Inizializza posizione come istanza di Posizione, anche se esiste in `obj`
    this.posizione = obj?.posizione instanceof PosizioneLocalDB
      ? obj.posizione
      : new PosizioneLocalDB(obj?.posizione);
  }

  getDataoraUtc() {
    const datetimeObj = moment.tz(this.data + " " + this.ora, this.posizione.getTz());
    return datetimeObj.utc().format("YYYY-MM-DD HH:mm:ss");
  }
}
