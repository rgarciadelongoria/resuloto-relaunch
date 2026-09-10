import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { PlatformBridgeService } from './core/platform-bridge.service';
import { LotteryDraw, LotteryGame, ResulotoApiService } from './core/resuloto-api.service';

type View = 'home' | 'games' | 'check' | 'favorites' | 'settings' | 'jackpots';

@Component({
  selector: 'resuloto-root',
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, TagModule, InputTextModule, DialogModule, ProgressSpinnerModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly api = inject(ResulotoApiService);
  private readonly bridge = inject(PlatformBridgeService);
  readonly games = this.api.games;
  readonly view = signal<View>('home');
  readonly selectedGame = signal<LotteryGame>(this.games[0]);
  readonly selectedDraw = signal<LotteryDraw | null>(null);
  readonly draws = signal<LotteryDraw[]>([]);
  readonly history = signal<LotteryDraw[]>([]);
  readonly jackpots = signal<Array<{ game: LotteryGame; amount: string; date: string }>>([]);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly favorites = signal<string[]>(this.readFavorites());
  readonly search = signal('');
  readonly manualNumber = signal('');
  readonly manualResult = signal<string | null>(null);
  readonly detailOpen = signal(false);
  readonly filteredGames = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('es');
    return query ? this.games.filter((game) => game.name.toLocaleLowerCase('es').includes(query)) : this.games;
  });
  readonly favoriteGames = computed(() => this.games.filter((game) => this.favorites().includes(game.id)));

  constructor() { void this.loadHome(); }

  async loadHome(): Promise<void> {
    this.busy.set(true);
    try {
      const current = await Promise.all(this.games.slice(0, 6).map((game) => this.api.latest(game, 0, 1)));
      this.draws.set(current.flat());
      this.jackpots.set(await this.api.jackpots());
    } finally { this.busy.set(false); }
  }
  async openGame(game: LotteryGame): Promise<void> {
    this.selectedGame.set(game); this.history.set([]); this.view.set('games'); await this.loadHistory();
  }
  async loadHistory(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const page = await this.api.latest(this.selectedGame(), this.history().length, 12);
      this.history.update((current) => [...current, ...page.filter((draw) => !current.some((known) => known.id === draw.id))]);
    } finally { this.busy.set(false); }
  }
  openDraw(draw: LotteryDraw): void { this.selectedDraw.set(draw); this.detailOpen.set(true); }
  toggleFavorite(game: LotteryGame): void {
    this.favorites.update((current) => current.includes(game.id) ? current.filter((id) => id !== game.id) : [...current, game.id]);
    localStorage.setItem('resuloto.favorites', JSON.stringify(this.favorites()));
  }
  isFavorite(game: LotteryGame): boolean { return this.favorites().includes(game.id); }
  gameColor(gameId: string): string { return this.games.find((game) => game.id === gameId)?.color ?? '#7556ed'; }
  async scan(): Promise<void> {
    try { this.busy.set(true); const result = await this.bridge.request<{ content: string }>('barcode.scan'); this.manualNumber.set(result.content); this.manualResult.set(result.content ? 'Código leído. Selecciona un juego para comprobarlo.' : 'No se detectó un código.'); }
    catch (error) { this.message(error instanceof Error ? error.message : 'No se pudo abrir el escáner.'); }
    finally { this.busy.set(false); }
  }
  checkManually(): void { const value = this.manualNumber().replace(/\D/g, ''); this.manualResult.set(value.length >= 3 ? `Hemos preparado la comprobación del número ${value}. El resultado oficial depende del sorteo seleccionado.` : 'Introduce al menos tres cifras.'); }
  async share(): Promise<void> { try { await this.bridge.request('share', { title: 'ResuLoto', text: 'Consulta resultados de loterías con ResuLoto.', url: location.href }); } catch { await navigator.clipboard?.writeText(location.href); this.message('Enlace copiado para compartir.'); } }
  async enablePush(): Promise<void> { try { const result = await this.bridge.request<{ enabled: boolean }>('push.enable'); this.message(result.enabled ? 'Notificaciones activadas.' : 'Las notificaciones están disponibles desde la app móvil.'); } catch (error) { this.message(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.'); } }
  @HostListener('window:scroll') onScroll(): void { if (this.view() === 'games' && !this.busy() && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 480) void this.loadHistory(); }
  private message(text: string): void { this.notice.set(text); window.setTimeout(() => this.notice.set(''), 4000); }
  private readFavorites(): string[] { try { return JSON.parse(localStorage.getItem('resuloto.favorites') ?? '[]'); } catch { return []; } }
}
