export interface AdvertisingConfig {
  android_idBanner?: string;
  android_idInterstitial?: string;
  ios_idBanner?: string;
  ios_idInterstitial?: string;
  mostrarBannerAdmob?: boolean;
  mostrarIntersticialAdmob?: boolean;
}

export interface AppConfig {
  carpetaXML: string;
  carpetaPHP: string;
  paises: Record<string, CountryDefinition>;
  publicidad?: AdvertisingConfig;
}

export interface CountryDefinition {
  cod: string;
  des: string;
  icono?: string;
  mostrarPubliEnListas?: 'S' | 'N';
}

export interface Country {
  key: string;
  code: string;
  label: string;
  flag: string;
}

export interface LotteryGame {
  nombre: string;
  nombreXML?: string;
  organismo: string;
  icono?: string;
  urlXML: string;
  mostrarCamara?: 'S';
  fichConfigLinea?: string;
  fichConfigDetalle?: string;
  color?: string;
  colorestilo?: string;
  estilo?: string;
  urlComprobador?: string;
  camposComprobador?: string;
  dias?: string;
  title?: string;
  title_dia?: string;
  desc?: string;
  desc_dia?: string;
  h1?: string;
  h1_dia?: string;
  artbody?: string;
  artbody_dia?: string;
  mostrar?: boolean;
}

export interface CountryCatalog {
  urlXmlUltimosResultados?: string;
  organismos: Array<Record<string, string>>;
  juegos: LotteryGame[];
}

export interface LotteryDraw {
  id: string;
  game: string;
  date: string;
  displayDate: string;
  result: Record<string, string>;
  metadata: Record<string, string>;
  prizes: DrawPrize[];
  tables: DrawDataTable[];
  videoUrl?: string;
  detailUrl?: string;
}

export interface DrawDataTable {
  key: string;
  rows: Array<Record<string, string>>;
}

export interface DrawPrize {
  category: string;
  winners?: string;
  amount: string;
  secondaryWinners?: string;
}

export interface GameMedia {
  srcTemplate: string;
  linkTemplate?: string;
  caption?: string;
  values: Record<string, string>;
  condition?: { path: string; equals?: string; differs?: string };
}

export interface GameTableDefinition {
  key: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
}

export interface GameExperience {
  media: GameMedia[];
  tables: GameTableDefinition[];
}

export interface ManualCheckRequest {
  number: string;
  series: string;
  date: string;
}

export interface CheckResult {
  message: string;
  source: 'scanner' | 'manual';
  rawCode?: string;
  needsExternalChecker?: boolean;
}

export type AppView = 'home' | 'games' | 'detail' | 'checker' | 'favorites';
