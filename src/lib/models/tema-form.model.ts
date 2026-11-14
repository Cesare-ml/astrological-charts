import {Tema} from './tema.model';

export class TemaForm extends Tema{
  public stato?: string;

  constructor(obj?:any) {
    super(obj)
    this.stato = obj?.stato;
  }
}
