import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  AppConfig,
  AppView,
  CheckResult,
  Country,
  CountryCatalog,
  GameExperience,
  GameMedia,
  LotteryDraw,
  LotteryGame,
  ManualCheckRequest
} from '../core/models/resuloto.models';
import { PreferencesStore } from '../core/services/preferences.store';
import { ResulotoApiService } from '../core/services/resuloto-api.service';
import { ShellBridgeService } from '../core/services/shell-bridge.service';

interface ResolvedGameMedia {
  src: string;
  link?: string;
  caption?: string;
}

interface ResolvedDrawTable {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
}

@Component({
  selector: 'rl-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lotto-dashboard.component.html',
  styleUrl: './lotto-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LottoDashboardComponent implements OnInit {
  config?: AppConfig;
  countries: Country[] = [];
  country?: Country;
  catalog?: CountryCatalog;
  draws: LotteryDraw[] = [];
  history: LotteryDraw[] = [];
  selectedGame?: LotteryGame;
  focusedDraw?: LotteryDraw;
  gameExperience: GameExperience = { media: [], tables: [] };
  videoOpenId?: string;
  unavailableMedia = new Set<string>();
  checkerGame?: LotteryGame;
  favorites: string[] = [];
  view: AppView = 'home';
  loading = true;
  loadingLabel = 'Preparando tus resultados…';
  scanning = false;
  checking = false;
  error = '';
  search = '';
  countryMenuOpen = false;
  checkerResult?: CheckResult;
  readonly manual: ManualCheckRequest = { number: '', series: '', date: this.isoDate() };

  private readonly flags: Record<string, string> = {
    AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴', CR: '🇨🇷', EC: '🇪🇨', ES: '🇪🇸',
    HN: '🇭🇳', MX: '🇲🇽', PA: '🇵🇦', PE: '🇵🇪', PR: '🇵🇷', DO: '🇩🇴', UY: '🇺🇾'
  };

  private readonly spanishLogoNames: Record<string, string> = {
    'Lotería Nacional': 'ln',
    Bonoloto: 'bl',
    'La Primitiva': 'pr',
    EuroMillones: 'eu',
    EuroDreams: 'ed',
    'El Gordo de la Primitiva': 'go',
    'La Quiniela': 'ql',
    'Cupón Diario': 'cupon_diario',
    Cuponazo: 'cuponazo',
    'Sueldazo Fin de Semana': 'sueldazo',
    'Super 11': 'super_once',
    'Triplex de la ONCE': 'triplex',
    'Mi Día': 'mi_dia',
    EuroJackPot: 'eurojackpot',
    'Sorteo Navidad ONCE': 'once_navidad',
    'Sorteo del Padre': 'once_padre',
    'Sorteo de la Madre': 'once_madre',
    'Sorteo extra de Verano': 'once_verano',
    'Sorteo 11 del 11': 'once_once'
  };

  constructor(
    readonly shell: ShellBridgeService,
    readonly api: ResulotoApiService,
    private readonly preferences: PreferencesStore,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly sanitizer: DomSanitizer
  ) {}

  async ngOnInit(): Promise<void> {
    this.shell.applyChrome();
    try {
      this.config = await this.api.loadConfig();
      this.countries = Object.entries(this.config.paises).map(([key, value]) => ({
        key,
        code: value.cod,
        label: value.des,
        flag: this.flags[value.cod] ?? '🌐'
      }));
      const saved = this.preferences.country();
      const defaultCountry = this.countries.find(country => country.key === saved)
        ?? this.countries.find(country => country.key === 'espana')
        ?? this.countries[0];
      if (!defaultCountry) throw new Error('No hay países configurados.');
      await this.selectCountry(defaultCountry, false);
      void this.shell.initializeAds(this.config.publicidad);
      this.shell.trackScreen('inicio');
    } catch (error) {
      this.error = this.errorMessage(error, 'No hemos podido cargar los resultados. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  get games(): LotteryGame[] {
    const normalizedSearch = this.normalize(this.search);
    return (this.catalog?.juegos ?? []).filter(game => {
      if (game.mostrar === false) return false;
      return !normalizedSearch || this.normalize(`${game.nombre} ${game.organismo}`).includes(normalizedSearch);
    });
  }

  get featuredGames(): LotteryGame[] {
    return this.games.slice(0, 8);
  }

  get favoriteGames(): LotteryGame[] {
    return this.games.filter(game => this.favorites.includes(game.nombre));
  }

  get organizations(): string[] {
    return [...new Set(this.games.map(game => game.organismo))];
  }

  get selectedGameDraw(): LotteryDraw | undefined {
    return this.history[0];
  }

  get isOnceChecker(): boolean {
    return this.checkerGame?.organismo.toUpperCase() === 'ONCE';
  }

  async selectCountry(country: Country, resetView = true): Promise<void> {
    if (!this.config) return;
    this.loading = true;
    this.loadingLabel = `Cargando ${country.label}…`;
    this.error = '';
    this.countryMenuOpen = false;
    try {
      const catalog = await this.api.loadCatalog(country.key);
      const draws = await this.api.loadLatest(this.config, catalog);
      this.country = country;
      this.catalog = catalog;
      this.draws = draws;
      this.history = [];
      this.selectedGame = undefined;
      this.focusedDraw = undefined;
      this.gameExperience = { media: [], tables: [] };
      this.videoOpenId = undefined;
      this.unavailableMedia.clear();
      this.checkerGame = this.firstSupportedGame() ?? this.games[0];
      this.favorites = this.preferences.favorites(country.key);
      this.preferences.saveCountry(country.key);
      if (resetView) this.setView('home');
    } catch (error) {
      this.error = this.errorMessage(error, `No hemos podido cargar el catálogo de ${country.label}.`);
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  setView(view: AppView): void {
    this.view = view;
    this.error = '';
    this.countryMenuOpen = false;
    const screenNames: Record<AppView, string> = {
      home: 'inicio', games: 'juegos', detail: 'detalle-sorteo', checker: 'comprobador', favorites: 'favoritos'
    };
    this.shell.trackScreen(screenNames[view]);
    this.changeDetector.markForCheck();
  }

  async refresh(): Promise<void> {
    if (!this.country) return;
    await this.selectCountry(this.country, false);
  }

  async openGame(game: LotteryGame): Promise<void> {
    if (!this.config) return;
    this.selectedGame = game;
    this.history = [];
    this.focusedDraw = undefined;
    this.gameExperience = { media: [], tables: [] };
    this.videoOpenId = undefined;
    this.unavailableMedia.clear();
    this.setView('detail');
    this.loading = true;
    this.loadingLabel = `Buscando sorteos de ${game.nombre}…`;
    this.shell.vibrate();
    this.shell.track('open_game', { game_name: game.nombre, organizer: game.organismo });
    try {
      const [history, gameExperience] = await Promise.all([
        this.api.loadGameHistory(this.config, game),
        this.country
          ? this.api.loadGameExperience(this.country.key, game).catch(() => ({ media: [], tables: [] }))
          : Promise.resolve({ media: [], tables: [] })
      ]);
      this.history = history;
      this.gameExperience = gameExperience;
      this.focusedDraw = this.history[0];
    } catch (error) {
      this.error = this.errorMessage(error, `No hemos podido cargar los sorteos de ${game.nombre}.`);
    } finally {
      this.loading = false;
      this.changeDetector.markForCheck();
    }
  }

  openChecker(game?: LotteryGame): void {
    this.checkerGame = game ?? this.checkerGame ?? this.firstSupportedGame() ?? this.games[0];
    this.checkerResult = undefined;
    this.manual.number = '';
    this.manual.series = '';
    this.manual.date = this.isoDate();
    this.setView('checker');
  }

  onCheckerGameChanged(): void {
    this.checkerResult = undefined;
    this.manual.number = '';
    this.manual.series = '';
  }

  async checkTicket(): Promise<void> {
    if (!this.config || !this.checkerGame) return;
    if (!this.manual.number.trim()) {
      this.error = 'Introduce el número de tu boleto para comprobarlo.';
      return;
    }
    if (this.isOnceChecker && !this.manual.series.trim()) {
      this.error = 'Introduce también la serie de tu cupón.';
      return;
    }
    this.error = '';
    this.checking = true;
    this.checkerResult = undefined;
    try {
      this.checkerResult = await this.api.checkManually(this.config, this.checkerGame, this.manual);
      this.shell.vibrate(35);
      this.shell.track('manual_check', { game_name: this.checkerGame.nombre });
      void this.shell.showInterstitial(this.config.publicidad);
    } catch (error) {
      this.error = this.errorMessage(error, 'No se ha podido comprobar el boleto. Revisa los datos e inténtalo de nuevo.');
    } finally {
      this.checking = false;
      this.changeDetector.markForCheck();
    }
  }

  async scanTicket(): Promise<void> {
    if (!this.config || !this.country) return;
    this.error = '';
    this.checkerResult = undefined;
    this.scanning = true;
    try {
      const code = await this.shell.scanCode();
      this.checkerResult = await this.api.checkQr(this.config, this.country.key, code);
      this.shell.track('qr_check', { country: this.country.key });
    } catch (error) {
      this.error = this.errorMessage(error, 'No se ha podido leer el código. Prueba de nuevo o usa el comprobador manual.');
    } finally {
      this.scanning = false;
      this.changeDetector.markForCheck();
    }
  }

  async openExternalChecker(): Promise<void> {
    if (!this.checkerGame) return;
    const url = this.api.externalCheckerUrl(this.checkerGame, this.manual.date);
    if (!url) return;
    try {
      await this.shell.openExternal(url);
    } catch (error) {
      this.error = this.errorMessage(error, 'No se ha podido abrir el comprobador externo.');
      this.changeDetector.markForCheck();
    }
  }

  async openVideo(draw: LotteryDraw): Promise<void> {
    if (!draw.videoUrl) return;
    if (!this.videoEmbedUrl(draw)) {
      await this.shell.openExternal(draw.videoUrl);
      return;
    }
    this.focusedDraw = draw;
    this.videoOpenId = this.videoOpenId === draw.id ? undefined : draw.id;
    this.shell.track('watch_draw_video', { game_name: this.selectedGame?.nombre ?? draw.game });
    this.changeDetector.markForCheck();
  }

  async openSource(draw: LotteryDraw): Promise<void> {
    if (!draw.detailUrl) return;
    const url = new URL(draw.detailUrl, 'https://www.resuloto.com/').toString();
    await this.shell.openExternal(url);
  }

  async openMediaLink(url?: string): Promise<void> {
    if (!url) return;
    await this.shell.openExternal(url);
  }

  selectDraw(draw: LotteryDraw): void {
    this.focusedDraw = draw;
    this.videoOpenId = undefined;
    this.shell.vibrate(12);
    this.changeDetector.markForCheck();
  }

  toggleFavorite(game: LotteryGame, event?: Event): void {
    event?.stopPropagation();
    if (!this.country) return;
    this.favorites = this.preferences.toggleFavorite(this.country.key, game.nombre);
    this.shell.vibrate();
    this.shell.track(this.favorites.includes(game.nombre) ? 'favorite_add' : 'favorite_remove', { game_name: game.nombre });
    this.changeDetector.markForCheck();
  }

  isFavorite(game: LotteryGame): boolean {
    return this.favorites.includes(game.nombre);
  }

  gameForDraw(draw: LotteryDraw): LotteryGame | undefined {
    const normalizedDraw = this.normalize(draw.game);
    return this.games.find(game => this.normalize(game.nombre) === normalizedDraw || this.normalize(game.nombreXML ?? '') === normalizedDraw);
  }

  gameSymbol(gameName: string): string {
    const normalized = this.normalize(gameName);
    if (normalized.includes('euro')) return '✦';
    if (normalized.includes('once') || normalized.includes('cupon') || normalized.includes('sueldazo')) return '◉';
    if (normalized.includes('quiniela')) return '12';
    if (normalized.includes('bono') || normalized.includes('primitiva') || normalized.includes('gordo')) return '●';
    if (normalized.includes('nacional')) return '€';
    return '✚';
  }

  drawBalls(draw: LotteryDraw, limit = 8): string[] {
    const { result } = draw;
    if (result['signos']) return result['signos'].replace(/\s+/g, '').split('').slice(0, limit);
    if (result['numeros']) return result['numeros'].split(/\s+/).filter(Boolean).slice(0, limit);
    const numbered = Object.keys(result)
      .filter(key => /^numero\d+$/.test(key) && result[key])
      .sort((a, b) => Number(a.replace('numero', '')) - Number(b.replace('numero', '')))
      .map(key => result[key]);
    if (numbered.length) return numbered.slice(0, limit);
    if (result['numero']) return [result['numero']];
    return Object.values(result).filter(Boolean).slice(0, limit);
  }

  isLongBall(value: string): boolean {
    return value.replace(/\s/g, '').length > 2;
  }

  drawExtras(draw: LotteryDraw): Array<{ label: string; value: string }> {
    const labels: Array<[string, string]> = [
      ['estrella1', 'Estrellas'], ['sol1', 'Soles'], ['complementario', 'Complementario'],
      ['reintegro', 'Reintegro'], ['serie', 'Serie'], ['prmillon', 'El Millón'], ['numeroclave', 'Clave']
    ];
    const extras: Array<{ label: string; value: string }> = [];
    labels.forEach(([key, label]) => {
      const value = draw.result[key];
      if (!value) return;
      const existing = extras.find(extra => extra.label === label);
      if (existing) existing.value = `${existing.value} · ${value}`;
      else extras.push({ label, value });
    });
    const reintegros = Object.keys(draw.result)
      .filter(key => /^reintegro\d+$/.test(key) && draw.result[key])
      .sort()
      .map(key => draw.result[key]);
    if (reintegros.length) extras.push({ label: 'Reintegros', value: reintegros.join(' · ') });
    return extras;
  }

  drawStatistics(draw: LotteryDraw): Array<{ label: string; value: string }> {
    const labels: Array<[string, string]> = [
      ['boteOfrecido', 'Bote ofrecido'],
      ['importePremios', 'Premios repartidos'],
      ['recaudacion', 'Recaudación'],
      ['apuestas', 'Apuestas selladas'],
      ['idsorteo', 'Nº de sorteo']
    ];
    return labels
      .filter(([key]) => Boolean(draw.metadata[key]))
      .map(([key, label]) => ({ label, value: draw.metadata[key] }));
  }

  drawSchedule(game: LotteryGame): string {
    if (!game.dias?.startsWith('[')) return 'Consulta el calendario del sorteo';
    try {
      const names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      const days = JSON.parse(game.dias) as number[];
      const listed = days.filter(day => day >= 1 && day <= 7).map(day => names[day - 1]);
      if (!listed.length) return 'Calendario variable';
      return `Sorteos: ${new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(listed)}`;
    } catch {
      return 'Consulta el calendario del sorteo';
    }
  }

  isFocusedDraw(draw: LotteryDraw): boolean {
    return this.focusedDraw?.id === draw.id;
  }

  isVideoOpen(draw: LotteryDraw): boolean {
    return this.videoOpenId === draw.id;
  }

  videoEmbedUrl(draw: LotteryDraw): SafeResourceUrl | undefined {
    if (!draw.videoUrl) return undefined;
    try {
      const source = new URL(draw.videoUrl);
      if (source.protocol !== 'https:') return undefined;

      let embed: URL | undefined;
      if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(source.hostname)) {
        if (source.pathname.startsWith('/embed/')) embed = source;
        const videoId = source.searchParams.get('v');
        if (videoId) embed = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
      } else if (source.hostname === 'youtu.be') {
        const videoId = source.pathname.split('/').filter(Boolean)[0];
        if (videoId) embed = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
      }

      return embed ? this.sanitizer.bypassSecurityTrustResourceUrl(embed.toString()) : undefined;
    } catch {
      return undefined;
    }
  }

  mediaForDraw(draw: LotteryDraw): ResolvedGameMedia[] {
    const resolved: ResolvedGameMedia[] = [];
    this.gameExperience.media
      .filter(media => this.mediaMatches(draw, media))
      .forEach(media => {
        const src = this.resolveMediaTemplate(media.srcTemplate, media, draw);
        if (!src) return;
        const link = media.linkTemplate ? this.resolveMediaTemplate(media.linkTemplate, media, draw) : undefined;
        const item: ResolvedGameMedia = { src };
        if (link) item.link = link;
        if (media.caption) item.caption = media.caption;
        resolved.push(item);
      });
    return resolved;
  }

  isMediaUnavailable(source: string): boolean {
    return this.unavailableMedia.has(source);
  }

  markMediaUnavailable(source: string): void {
    this.unavailableMedia.add(source);
    this.changeDetector.markForCheck();
  }

  detailTables(draw: LotteryDraw): ResolvedDrawTable[] {
    return this.gameExperience.tables
      .map(definition => {
        const source = draw.tables.find(table => table.key === definition.key);
        return source ? { title: definition.title, columns: definition.columns, rows: source.rows } : undefined;
      })
      .filter((table): table is ResolvedDrawTable => Boolean(table));
  }

  gameNarrative(draw: LotteryDraw): string | undefined {
    const game = this.selectedGame;
    const sources = [game?.artbody_dia, game?.artbody, game?.desc_dia, game?.desc];
    for (const source of sources) {
      if (!source?.trim()) continue;
      const text = new DOMParser().parseFromString(source, 'text/html').body.textContent
        ?.replace(/\s+/g, ' ')
        .trim() ?? '';
      if (!text) continue;
      let complete = true;
      const rendered = text.replace(/#([^#]+)#/g, (_placeholder, field: string) => {
        const value = this.narrativeValue(draw, field);
        if (!value) complete = false;
        return value;
      });
      if (complete) return rendered;
    }
    return undefined;
  }

  gameLogoUrl(game: LotteryGame, title = false): string | undefined {
    const localName = this.country?.code === 'ES' ? this.spanishLogoNames[game.nombre] : undefined;
    if (localName) return `assets/logos/games/es/${localName}${title ? '-title' : ''}.svg`;
    return this.gameIconUrl(game);
  }

  private gameIconUrl(game: LotteryGame): string | undefined {
    if (!game.icono) return undefined;
    try {
      const base = game.icono.startsWith('https://')
        ? undefined
        : `https://www.resuloto.com/v1.0.7/app/svg/${this.country?.key ?? 'espana'}/`;
      const url = new URL(game.icono, base);
      return url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  drawGameLabel(draw: LotteryDraw): string {
    return this.gameForDraw(draw)?.organismo ?? 'Resultado actualizado';
  }

  cardAccent(game?: LotteryGame): string {
    return game?.color ?? '#7455ed';
  }

  isGameSelected(game: LotteryGame): boolean {
    return this.selectedGame?.nombre === game.nombre;
  }

  firstSupportedGame(): LotteryGame | undefined {
    return this.games.find(game => Boolean(game.urlComprobador));
  }

  closeNotice(): void {
    this.error = '';
  }

  private isoDate(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private mediaMatches(draw: LotteryDraw, media: GameMedia): boolean {
    if (!media.condition) return true;
    const value = this.drawValue(draw, media.condition.path);
    if (media.condition.equals && this.normalize(value) !== this.normalize(media.condition.equals)) return false;
    if (media.condition.differs && this.normalize(value) === this.normalize(media.condition.differs)) return false;
    return true;
  }

  private resolveMediaTemplate(template: string, media: GameMedia, draw: LotteryDraw): string | undefined {
    let resolved = template;
    for (const [token, path] of Object.entries(media.values)) {
      const rawValue = this.drawValue(draw, path);
      if (!rawValue) return undefined;
      const value = token === 'anno' ? rawValue.slice(0, 4) : token === 'fsinguiones' ? rawValue.replace(/-/g, '') : rawValue;
      const placeholder = token === 'anno' ? '#ANNO#' : `#${token}#`;
      resolved = resolved.replaceAll(placeholder, encodeURIComponent(value));
    }

    try {
      const url = new URL(resolved);
      return url.protocol === 'https:' && !resolved.includes('#') ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private drawValue(draw: LotteryDraw, path: string): string {
    const key = path.split('/').filter(Boolean).pop() ?? path;
    if (key === 'fechajuego') return draw.date;
    return draw.result[key] ?? draw.metadata[key] ?? '';
  }

  private narrativeValue(draw: LotteryDraw, field: string): string {
    const aliases: Record<string, string> = {
      'fecha-letra': draw.displayDate,
      'fecha-numero': draw.date,
      'primero-numero': this.drawBalls(draw, 1)[0] ?? '',
      'primero-serie': draw.result['serie'] ?? '',
      'reintegro-cupon': draw.result['reintegro'] ?? this.drawExtras(draw).find(extra => extra.label === 'Reintegros')?.value ?? '',
      numeros: this.drawBalls(draw, 20).join(' · '),
      soles: draw.result['sol1'] ?? draw.result['soles'] ?? '',
      'resultado-midia': draw.result['fechaMiDia'] ?? draw.result['resultado-midia'] ?? ''
    };
    return aliases[field] ?? this.drawValue(draw, field);
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
