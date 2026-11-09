import {Posizione} from './posizione.model';

export class SettaggiElementoCeleste {
  public att: boolean = false;
  public orb: number = 6;
  public aspVerso: boolean = false;
}

export class SettaggiElementiCelesti {
  public Sun: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Moon: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Mercury: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Venus: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Mars: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Jupiter: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Saturn: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Uranus: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Neptune: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Pluto: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public vertex: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Chiron: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public MC: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public IC: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public AS: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public DS: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "mean Apogee": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "mean Perigee": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "osc. Apogee": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "osc. Perigee": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "mean Node": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "mean Node Sud": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "true Node": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public "true Node Sud": SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Tyche: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Daimon: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Basis: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Ananke: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Eros: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Hermes: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Tolma: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Nike: SettaggiElementoCeleste = new SettaggiElementoCeleste();
  public Nemesi: SettaggiElementoCeleste = new SettaggiElementoCeleste();
}

export class SettaggiAspettiAttivi {
  public congiunzione: boolean = true;
  public opposizione: boolean = true;
  public trigono: boolean = true;
  public quadrato: boolean = true;
  public quintile: boolean = false;
  public sestile: boolean = true;
  public settile: boolean = false;
  public semiquadrato: boolean = false;
  public novile: boolean = false;
  public semiquintile: boolean = false;
  public semisestile: boolean = false;
  public phisolare: boolean = false;
  public quinconce: boolean = false;
  public biquintile: boolean = false;
  public philunare: boolean = false;
  public parallelodideclinazione: boolean = false;
  public antiparallelo: boolean = false;
}

export class SettaggiAspettiOrbite {
  public congiunzione?: number = null;
  public opposizione?: number = null;
  public trigono?: number = null;
  public quadrato?: number = null;
  public quintile?: number = null;
  public sestile?: number = null;
  public settile?: number = null;
  public semiquadrato?: number = null;
  public novile?: number = null;
  public semiquintile?: number = null;
  public semisestile?: number = null;
  public phisolare?: number = null;
  public quinconce?: number = null;
  public biquintile?: number = null;
  public philunare?: number = null;
  public parallelodideclinazione?: number = null;
  public antiparallelo?: number = null;
}

export class Settaggi {
  public id: number = 0;
  public skin_id: string = 'light';
  public utente_id: number = 0;
  public tema_account_id: number = 0;
  public transaturnini_se_congiunti: boolean = true;
  public pagina_dashboard: any = false;
  public modalita_adesso_posizione_id: number = 0;
  public modalita_adesso_posizione: Posizione = new Posizione();
  public domificazione_selezionata: string = 'egizia';
  public aspetti_attivi: SettaggiAspettiAttivi = new SettaggiAspettiAttivi();
  public aspetti_orbite: SettaggiAspettiOrbite = new SettaggiAspettiOrbite();
  public elementi_celesti: SettaggiElementiCelesti = new SettaggiElementiCelesti();

  constructor() {}

  public static domificazioni = {
    'egizia': 'Vehlow (Egizia)',
    //'egiziaplacido': 'Egizia + Placido',
    'placido': 'Placido',
    'regio-montano': 'Regio Montano',
    'porfirio': 'Porfirio',
    'koch': 'Koch'
  };

  public static elementiCelesti = {
    Sun: {n: "Sole"},
    Moon: {n: "Luna"},
    Mercury: {n: "Mercurio"},
    Venus: {n: "Venere"},
    Mars: {n: "Marte"},
    Jupiter: {n: "Giove"},
    Saturn: {n: "Saturno"},
    Uranus: {n: "Urano"},
    Neptune: {n: "Nettuno"},
    Pluto: {n: "Plutone"},
    vertex: {n: "Vertex"},
    puntoFortuna: {n: "Punto Fortuna"},
    Chiron: {n: "Chirone"},
    MC: {n: "Medio Cielo"},
    IC: {n: "Fondo Cielo"},
    AS: {n: "Ascendente"},
    DS: {n: "Discendente"},
    "mean Apogee": {n: "Luna Nera Media"},
    "mean Perigee": {n: "Perigeo Lunare Medio"},
    "osc. Apogee": {n: "Luna Nera Vera"},
    "osc. Perigee": {n: "Perigeo Lunare Vero"},
    "mean Node": {n: "Nodo Lunare"},
    "mean Node Sud": {n: "Nodo Lunare Sud"},
    "true Node": {n: "Nodo Lunare Vero"},
    "true Node Sud": {n: "Nodo Lunare Sud Vero"},

    Tyche: {n: "Tyche"},
    Daimon: {n: "Daimon"},
    Basis: {n: "Basis"},
    Ananke: {n: "Ananke"},
    Eros: {n: "Eros"},
    Hermes: {n: "Hermes"},
    Tolma: {n: "Tolma"},
    Nike: {n: "Nike"},
    Nemesi: {n: "Nemesi"}
  };
  public static aspetti = {
    congiunzione: {n: "Congiunzione", g:0 },
    opposizione: {n: "Opposizione", g:180 },
    trigono: {n: "Trigono", g:120 }, //3
    quadrato: {n: "Quadrato", g:90 }, //4
    quintile: {n: "Quintile", g:72 }, //5
    sestile: {n: "Sestile", g:60 }, //6
    settile: {n: "Settile", g:51.42 },//7 => 51g 25'
    semiquadrato: {n: "SemiQuadrato", g:45 }, //8
    novile: {n: "Novile", g:40 }, //9
    semiquintile: {n: "SemiQuintile", g:36 }, //10
    semisestile: {n: "SemiSestile", g:30 }, //12

    phisolare: {n: "Phi Solare", g:222.49 }, //segue l'ordine dei segni
    quinconce: {n: "Quinconce", g:150 },
    biquintile: {n: "BiQuintile", g:144 },
    philunare: {n: "Phi Lunare", g:137.50 }, // segue l'ordine dei segni

    parallelodideclinazione: {n: "Parallelo di Decl.", g:-1 }, // segue l'ordine dei segni
    antiparallelo: {n: "Antiparallelo di Decl.", g:-2 }, // segue l'ordine dei segni
  };
}

export const settaggiDefault:Settaggi = {
  "id":null,
  "skin_id":'light',
  "utente_id":null,
  "tema_account_id":null,
  "domificazione_selezionata":"placido",
  "aspetti_attivi":
    {
      "novile":false,
      "sestile":true,
      "settile":false,
      "trigono":true,
      "quadrato":true,
      "quintile":false,
      "philunare":false,
      "phisolare":false,
      "quinconce":false,
      "biquintile":false,
      "opposizione":true,
      "semisestile":false,
      "congiunzione":true,
      "semiquadrato":false,
      "semiquintile":false,
      "antiparallelo":false,
      "parallelodideclinazione":false
    },
    "aspetti_orbite":{
      "novile":null,
      "sestile":null,
      "settile":null,
      "trigono":null,
      "quadrato":null,
      "quintile":3,
      "philunare":2,
      "phisolare":2,
      "quinconce":2,
      "biquintile":null,
      "opposizione":null,
      "semisestile":null,
      "congiunzione":null,
      "semiquadrato":3,
      "semiquintile":null,
      "antiparallelo":null,
      "parallelodideclinazione":null
    },
    "elementi_celesti":{
      "AS":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "DS":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "IC":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "MC":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Sun":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Eros":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Mars":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Moon":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Nike":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Basis":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Pluto":{
        "att":true,
        "orb":6,
        "aspVerso":false
      },
      "Tolma":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Tyche":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Venus":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Ananke":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Chiron":{
        "att":true,
        "orb":6,
        "aspVerso":false
      },
      "Daimon":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Hermes":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Nemesi":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Saturn":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Uranus":{
        "att":true,
        "orb":6,
        "aspVerso":false
      },
      "vertex":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "Jupiter":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Mercury":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "Neptune":{
        "att":true,
        "orb":6,
        "aspVerso":false
      },
      "mean Node":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "true Node":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "mean Apogee":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "osc. Apogee":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "mean Perigee":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "osc. Perigee":{
        "att":true,
        "orb":6,
        "aspVerso":true
      },
      "mean Node Sud":{
        "att":false,
        "orb":6,
        "aspVerso":false
      },
      "true Node Sud":{
        "att":true,
        "orb":6,
        "aspVerso":true
      }
    },
    "transaturnini_se_congiunti":null,
    "pagina_dashboard":"",
    "modalita_adesso_posizione_id":5,
    "modalita_adesso_posizione": new Posizione({
        "id": -1,
        "usa_posizione_manuale": false,
        "citta_id": 1278627,
        "citta": {
            "id": 1278627,
            "nome": "Portomaggiore",
            "nome_it": "Portomaggiore",
            "lat": 44.697805,
            "lng": 11.805778,
            "tz": "Europe/Rome",
            "tz_offs": 1,
            "pop": 12190,
            "regione": "Emilia-Romagna",
            "stato_id": 108,
            "stato": {
                "id": 108,
                "nome": "Italy",
                "nome_it": null,
                "iso2": "IT"
            }
        }
    })
  };
