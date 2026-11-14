import { CittaLocalDB, PosizioneLocalDB } from './posizione-localdb.model';
import { SettaggiAspettiAttivi, SettaggiAspettiOrbite, SettaggiElementoCeleste, SettaggiElementiCelesti } from './settaggi.model';


export class SettaggiAstrolabio {
  public skin_id: string = 'dark-bn';
  public inversione_in_australe:boolean = true;
  public transaturnini_se_congiunti: boolean = true;
  public domificazione_selezionata: string = 'egizia';
  public modalita_adesso_posizione: PosizioneLocalDB = new PosizioneLocalDB();

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
}

export const settaggiAstrolabioDefault:SettaggiAstrolabio = {
  "skin_id":'dark-bn',
  "inversione_in_australe": true,
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
    "modalita_adesso_posizione": new PosizioneLocalDB({
        "id": -1,
        "usa_posizione_manuale": false,
        "citta_id": 1278627,
        "citta": {
            "_ObjId": 1278627,
            "citta": "Portomaggiore",
            "iso2": "IT",
            "label": "Portomaggiore",
            "lat": 44.697805,
            "lng": 11.805778,
            "tz": "Europe/Rome",
            "tz_offs": 1,
            "pop": 12190,
            "regione": "Emilia-Romagna",
            "stato": "Italy"
        }
    })
  };


/**
 * Return a fresh Astrolabio configuration without sharing nested mutable defaults.
 *
 * The existing exported settaggiAstrolabioDefault object remains unchanged for
 * backwards compatibility. Callers managing multiple charts/devices should use
 * this factory instead of mutating the shared constant. The initial values are\n * captured at module load, so later legacy mutations cannot contaminate charts.
 */
function cloneAstrolabioSettings(defaults: SettaggiAstrolabio): SettaggiAstrolabio {
  const result = Object.assign(new SettaggiAstrolabio(), defaults);

  result.aspetti_attivi = Object.assign(new SettaggiAspettiAttivi(), defaults.aspetti_attivi);
  result.aspetti_orbite = Object.assign(new SettaggiAspettiOrbite(), defaults.aspetti_orbite);

  const celestial = new SettaggiElementiCelesti();
  for (const key of Object.keys(defaults.elementi_celesti)) {
    celestial[key] = Object.assign(
      new SettaggiElementoCeleste(),
      defaults.elementi_celesti[key]
    );
  }
  result.elementi_celesti = celestial;

  const position = defaults.modalita_adesso_posizione;
  result.modalita_adesso_posizione = Object.assign(new PosizioneLocalDB(), position, {
    posizione_manuale: position.posizione_manuale
      ? { ...position.posizione_manuale }
      : undefined,
    citta: position.citta
      ? Object.assign(new CittaLocalDB(), position.citta)
      : undefined
  });

  return result;
}

/**
 * Snapshot the original defaults once: legacy users may mutate the exported
 * constant, but those mutations must not leak into future independent charts.
 */
const initialAstrolabioDefaults = cloneAstrolabioSettings(settaggiAstrolabioDefault);

export function createDefaultSettaggiAstrolabio(): SettaggiAstrolabio {
  return cloneAstrolabioSettings(initialAstrolabioDefaults);
}
