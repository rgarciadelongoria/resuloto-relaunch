import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AppConfig,
  CheckResult,
  CountryCatalog,
  GameExperience,
  GameMedia,
  GameTableDefinition,
  LotteryDraw,
  LotteryGame,
  ManualCheckRequest
} from '../models/resuloto.models';

/**
 * Adaptador de la API pública existente. No interpreta la configuración HTML/XML
 * que la aplicación antigua ejecutaba: sólo transforma datos en modelos seguros.
 */
@Injectable({ providedIn: 'root' })
export class ResulotoApiService {
  private readonly rootUrl = 'https://www.resuloto.com/';
  private readonly appUrl = 'https://www.resuloto.com/v1.0.7/';

  constructor(private readonly http: HttpClient) {}

  async loadConfig(): Promise<AppConfig> {
    const url = new URL('json/getJson.php', this.appUrl);
    url.searchParams.set('fichJson', 'config.json');
    return this.getJson<AppConfig>(url.toString());
  }

  async loadCatalog(country: string): Promise<CountryCatalog> {
    const url = new URL('json/getJson.php', this.appUrl);
    url.searchParams.set('fichJson', `juegos-${country}.json`);
    return this.getJson<CountryCatalog>(url.toString());
  }

  async loadLatest(config: AppConfig, catalog: CountryCatalog): Promise<LotteryDraw[]> {
    if (!catalog.urlXmlUltimosResultados) return [];
    const url = new URL(`${config.carpetaXML}${catalog.urlXmlUltimosResultados}`, this.rootUrl);
    return this.parseDraws(await this.getText(url.toString()));
  }

  async loadGameHistory(config: AppConfig, game: LotteryGame): Promise<LotteryDraw[]> {
    const url = new URL(`${config.carpetaXML}${game.urlXML}`, this.rootUrl);
    // La lista rápida usa la respuesta resumida; la ficha de juego necesita el
    // desglose de categorías que la API sólo entrega con premios=S.
    url.searchParams.set('premios', 'S');
    return this.parseDraws(await this.getText(url.toString()));
  }

  async loadGameExperience(country: string, game: LotteryGame): Promise<GameExperience> {
    const configFile = game.fichConfigDetalle || game.fichConfigLinea;
    if (!configFile) return { media: [], tables: [] };

    const url = new URL(`config/${country}/${configFile}`, this.appUrl);
    const xml = await this.getText(url.toString());
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) return { media: [], tables: [] };

    const media = Array.from(document.getElementsByTagName('imgj3a'))
      .map(element => this.mediaDefinition(element))
      .filter((item): item is GameMedia => item !== null)
      .filter((item, index, all) => all.findIndex(candidate =>
        candidate.srcTemplate === item.srcTemplate
        && candidate.condition?.path === item.condition?.path
        && candidate.condition?.equals === item.condition?.equals
      ) === index);

    const tables = Array.from(document.getElementsByTagName('tablapremios'))
      .map(element => this.tableDefinition(element))
      .filter((item): item is GameTableDefinition => item !== null)
      .filter((item, index, all) => all.findIndex(candidate => candidate.key === item.key) === index);

    return { media, tables };
  }

  async checkQr(config: AppConfig, country: string, rawCode: string): Promise<CheckResult> {
    const url = new URL(`${config.carpetaPHP}appMovilProxyScan.php`, this.rootUrl);
    url.searchParams.set('qr', rawCode);
    url.searchParams.set('pais', country);
    const body = await this.getText(url.toString());
    return {
      source: 'scanner',
      rawCode,
      message: this.asPlainText(body) || 'El código se ha leído, pero no ha devuelto un resultado reconocible.'
    };
  }

  async checkManually(
    config: AppConfig,
    game: LotteryGame,
    request: ManualCheckRequest
  ): Promise<CheckResult> {
    if (!game.urlComprobador) {
      return {
        source: 'manual',
        needsExternalChecker: true,
        message: `${game.nombre} no dispone de comprobador interno. Puedes consultar el sorteo y comparar tu boleto.`
      };
    }

    const url = new URL(`${config.carpetaPHP}${game.urlComprobador}`, this.rootUrl);
    url.searchParams.set('numero', request.number);
    url.searchParams.set('del-dia', request.date);

    if (this.isOnceGame(game)) {
      url.searchParams.set('serie', request.series);
      url.searchParams.set('tipojuego', this.onceType(game.nombre));
    }

    const body = await this.getText(url.toString());
    return {
      source: 'manual',
      message: this.asPlainText(body) || 'No hemos recibido un resultado para los datos introducidos.'
    };
  }

  externalCheckerUrl(game: LotteryGame, date: string): string | null {
    const weekday = this.weekdayFromDate(date);
    const encodedDate = encodeURIComponent(date);
    const names: Record<string, string> = {
      Bonoloto: `https://www.comprobarbonoloto.es/bonoloto-${weekday}.php?del-dia=${encodedDate}`,
      'La Primitiva': `https://www.primitivacomprobar.es/primitiva-${weekday}.php?del-dia=${encodedDate}`,
      EuroMillones: `https://www.comprobareuromillones.com/euromillones-${weekday}.php?del-dia=${encodedDate}`
    };
    return names[game.nombre] ?? null;
  }

  private async getJson<T>(url: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(url));
  }

  private async getText(url: string): Promise<string> {
    return firstValueFrom(this.http.get(url, { responseType: 'text' }));
  }

  private parseDraws(xml: string): LotteryDraw[] {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) {
      throw new Error('La fuente de resultados ha devuelto XML no válido.');
    }

    return Array.from(document.getElementsByTagName('sorteo')).map((draw, index) => {
      const game = this.text(draw, 'juego');
      const date = this.text(draw, 'fechajuego');
      const displayDate = this.text(draw, 'fechaapp') || this.text(draw, 'fechaletra') || date;
      const resultElement = this.directChild(draw, 'resultado') ?? this.directChild(draw, 'listaPremiosAbr');
      const result = resultElement ? this.leafValues(resultElement) : {};
      // Conservamos los campos directos del sorteo, no sólo los que hoy se
      // imprimen como estadísticas. Las fichas XML de la aplicación original
      // los usan para elegir la imagen adecuada (por ejemplo, jueves/sábado)
      // y completar enlaces oficiales del cupón o décimo.
      const metadata = this.leafValues(draw);
      const prizes = this.prizeRows(draw);
      const tables = this.dataTables(draw);

      return {
        id: `${game}-${date}-${index}`,
        game,
        date,
        displayDate,
        result,
        metadata,
        prizes,
        tables,
        videoUrl: this.text(draw, 'urlvideo') || undefined,
        detailUrl: this.text(draw, 'urldetalle') || undefined
      };
    }).filter(draw => Boolean(draw.game));
  }

  private text(element: Element, tag: string): string {
    const value = element.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
    // Algunas respuestas XML antiguas incluyen entidades HTML dentro de CDATA
    // (por ejemplo, `Mi&eacute;rcoles`). Las normalizamos antes de mostrarlas o
    // comparar el nombre del juego con el catálogo JSON.
    return this.decodeHtmlEntities(value);
  }

  private directChild(element: Element, tag: string): Element | undefined {
    return Array.from(element.children).find(child => child.tagName === tag);
  }

  private leafValues(element: Element, allowedKeys?: string[]): Record<string, string> {
    return Array.from(element.children)
      .filter(child => !allowedKeys || allowedKeys.includes(child.tagName))
      .filter(child => child.children.length === 0)
      .reduce<Record<string, string>>((values, child) => {
        values[child.tagName] = this.decodeHtmlEntities(child.textContent?.trim() ?? '');
        return values;
      }, {});
  }

  private prizeRows(draw: Element) {
    const table = draw.getElementsByTagName('tablapremios')[0];
    if (!table) return [];

    return Array.from(table.children)
      .filter(row => row.tagName === 'fila')
      .map(row => {
        const values = this.leafValues(row);
        const category = values['categoria'] || values['cat'] || values['premio'] || 'Premio';
        const amount = values['importe'] || values['premio'] || values['cantidad'] || '';
        const winners = values['apuestas'] || values['ganadores'] || values['aciertos'];
        const secondaryWinners = values['apuestaseuropa'] || values['ganadoresEuropa'];
        return { category, amount, winners, secondaryWinners };
      })
      .filter(row => Boolean(row.amount));
  }

  private dataTables(draw: Element) {
    return Array.from(draw.getElementsByTagName('*'))
      .filter(group => group.tagName !== 'tablapremios')
      .filter(group => group.children.length > 0)
      .filter(group => {
        const rows = Array.from(group.children);
        return rows.length > 0
          && rows.every(row => row.tagName === rows[0].tagName)
          && rows.every(row => row.children.length > 0);
      })
      .map(group => ({
        key: group.tagName,
        rows: Array.from(group.children)
          .map(row => this.leafValues(row))
          .filter(row => Object.keys(row).length > 0)
      }))
      .filter(table => table.rows.length > 0);
  }

  private mediaDefinition(element: Element): GameMedia | null {
    const srcTemplate = element.getAttribute('srcPlantilla');
    if (!srcTemplate || !/^https:\/\//i.test(srcTemplate)) return null;

    const values: Record<string, string> = {};
    ['anno', 'fsinguiones', 'p1XML', 'p2XML', 'p3XML', 'urlP1XML', 'urlP2XML'].forEach(key => {
      const value = element.getAttribute(key);
      if (value) values[key] = value;
    });

    let condition: GameMedia['condition'];
    let parent = element.parentElement;
    while (parent) {
      if (parent.tagName === 'condicion') {
        const path = parent.getAttribute('condXML');
        if (path) {
          condition = {
            path,
            equals: parent.getAttribute('igual') ?? undefined,
            differs: parent.getAttribute('distinto') ?? undefined
          };
        }
        break;
      }
      parent = parent.parentElement;
    }

    return {
      srcTemplate,
      linkTemplate: element.getAttribute('url') ?? undefined,
      caption: element.getAttribute('caption') ?? undefined,
      values,
      condition
    };
  }

  private tableDefinition(element: Element): GameTableDefinition | null {
    const source = element.getAttribute('tablaXML')?.split('/').pop();
    if (!source) return null;
    const columns = Array.from({ length: 8 }, (_, index) => index + 1)
      .map(index => ({
        key: element.getAttribute(`col${index}`) ?? '',
        label: element.getAttribute(`literalCol${index}`) ?? ''
      }))
      .filter(column => Boolean(column.key))
      .map(column => ({ ...column, label: column.label || this.humanize(column.key) }));
    if (!columns.length) return null;

    return {
      key: source,
      title: source === 'partidos' ? 'Partidos y resultados' : 'Detalle del sorteo',
      columns
    };
  }

  private humanize(value: string): string {
    return value.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
  }

  private asPlainText(html: string): string {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return (document.body.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);
  }

  private decodeHtmlEntities(value: string): string {
    if (!value.includes('&')) return value;
    const document = new DOMParser().parseFromString(value, 'text/html');
    return document.body.textContent?.trim() ?? value;
  }

  private isOnceGame(game: LotteryGame): boolean {
    return game.organismo.toUpperCase() === 'ONCE';
  }

  private onceType(name: string): string {
    const types: Record<string, string> = {
      'Cupón Diario': '01',
      Cuponazo: '03',
      'Sueldazo Fin de Semana': '06',
      'Super 11': '08',
      'Triplex de la ONCE': '11',
      'Mi Día': '10',
      EuroJackPot: '09'
    };
    return types[name] ?? '01';
  }

  private weekdayFromDate(date: string): string {
    const parsed = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long' })
      .format(parsed)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
