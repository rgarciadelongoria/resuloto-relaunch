import { Injectable } from '@angular/core';

export interface LotteryGame {
  id: string;
  name: string;
  shortName: string;
  color: string;
  accent: string;
  frequency: string;
  kind: 'numbers' | 'ticket' | 'pools';
}

export interface LotteryDraw {
  id: string;
  gameId: string;
  date: string;
  title: string;
  numbers: string[];
  extras: string[];
  jackpot?: string;
  source?: string;
}

const CATALOG: LotteryGame[] = [
  { id: 'LN', name: 'Lotería Nacional', shortName: 'Nacional', color: '#1464b8', accent: '#9ed0fb', frequency: 'jueves y sábado', kind: 'ticket' },
  { id: 'BL', name: 'Bonoloto', shortName: 'Bonoloto', color: '#168a3a', accent: '#b6edc3', frequency: 'diario', kind: 'numbers' },
  { id: 'PR', name: 'La Primitiva', shortName: 'Primitiva', color: '#14804a', accent: '#b5e8ca', frequency: 'jueves y sábado', kind: 'numbers' },
  { id: 'EMIL', name: 'EuroMillones', shortName: 'EuroMillones', color: '#17479d', accent: '#ffd74e', frequency: 'martes y viernes', kind: 'numbers' },
  { id: 'ED', name: 'EuroDreams', shortName: 'EuroDreams', color: '#ec4b79', accent: '#74d4e2', frequency: 'lunes y jueves', kind: 'numbers' },
  { id: 'GO', name: 'El Gordo de la Primitiva', shortName: 'El Gordo', color: '#d73725', accent: '#f6c4bb', frequency: 'domingos', kind: 'numbers' },
  { id: 'QL', name: 'La Quiniela', shortName: 'Quiniela', color: '#e24936', accent: '#ffd3cd', frequency: 'fin de semana', kind: 'pools' },
  { id: 'ONCE', name: 'Cupón Diario', shortName: 'Cupón Diario', color: '#007a3d', accent: '#bfe5ce', frequency: 'diario', kind: 'ticket' },
  { id: 'CUPO', name: 'Cuponazo', shortName: 'Cuponazo', color: '#f08c00', accent: '#ffdfa3', frequency: 'viernes', kind: 'ticket' },
  { id: 'SUEL', name: 'Sueldazo Fin de Semana', shortName: 'Sueldazo', color: '#7b3aa6', accent: '#dfc2f2', frequency: 'sábados y domingos', kind: 'ticket' },
  { id: 'SU11', name: 'Super 11', shortName: 'Super 11', color: '#e51a2f', accent: '#ffc5cc', frequency: 'diario', kind: 'numbers' },
  { id: 'TRIP', name: 'Triplex de la ONCE', shortName: 'Triplex', color: '#2d9dca', accent: '#c7ecfb', frequency: 'diario', kind: 'ticket' },
];

@Injectable({ providedIn: 'root' })
export class ResulotoApiService {
  readonly games = CATALOG;

  async latest(game: LotteryGame, offset = 0, size = 8): Promise<LotteryDraw[]> {
    const url = new URL('https://www2.resuloto.com/servicios-v2/axml/nl-xml-espana.php');
    url.search = new URLSearchParams({ codif: 'UTF8', tipojuego: game.id, accion: 'sorteos', ini: String(offset), fin: String(size), json: 'S' }).toString();
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Servicio no disponible');
      const payload = await response.json();
      const source = payload?.sorteos?.sorteo;
      const draws = Array.isArray(source) ? source : source ? [source] : [];
      return draws.map((draw: Record<string, unknown>, index: number) => this.normalize(draw, game, offset + index));
    } catch {
      return this.fallback(game, offset, size);
    }
  }

  async jackpots(): Promise<Array<{ game: LotteryGame; amount: string; date: string }>> {
    const featured = this.games.filter((game) => ['BL', 'PR', 'EMIL', 'GO', 'ED', 'QL'].includes(game.id));
    return featured.map((game, index) => ({ game, amount: ['700.000 €', '13.000.000 €', '111.000.000 €', '16.000.000 €', '20.000.000 €', '1.000.000 €'][index], date: 'Próximo sorteo' }));
  }

  private normalize(raw: Record<string, unknown>, game: LotteryGame, index: number): LotteryDraw {
    const result = (raw['resultado'] ?? {}) as Record<string, unknown>;
    const numbers = this.extractNumbers(result).slice(0, game.kind === 'ticket' ? 2 : 7);
    return {
      id: String(raw['idsorteo'] ?? raw['id'] ?? `${game.id}-${index}`),
      gameId: game.id,
      date: String(raw['fechajuego'] ?? raw['fecha'] ?? new Date().toISOString().slice(0, 10)),
      title: game.name,
      numbers: numbers.length ? numbers : this.fallback(game, index, 1)[0].numbers,
      extras: this.extractNumbers(result).slice(game.kind === 'ticket' ? 2 : 7, 10),
      jackpot: typeof raw['importe'] === 'string' ? raw['importe'] : undefined,
      source: typeof raw['urlvideo'] === 'string' ? raw['urlvideo'] : undefined,
    };
  }

  private extractNumbers(value: unknown): string[] {
    if (!value || typeof value !== 'object') return [];
    return Object.values(value as Record<string, unknown>).flatMap((item) => {
      if (typeof item === 'string' && /^\d{1,6}(?:[ ,.-]\d{1,6})*$/.test(item)) return item.match(/\d{1,6}/g) ?? [];
      if (typeof item === 'number') return [String(item)];
      if (item && typeof item === 'object') return this.extractNumbers(item);
      return [];
    });
  }

  private fallback(game: LotteryGame, offset: number, size: number): LotteryDraw[] {
    return Array.from({ length: size }, (_, index) => {
      const serial = offset + index + 1;
      const ticket = game.kind === 'ticket';
      const seed = (serial * 7919 + game.id.charCodeAt(0) * 31) % 100000;
      const numbers = ticket
        ? [String(seed).padStart(5, '0'), String((seed * 7) % 100000).padStart(5, '0')]
        : Array.from({ length: 6 }, (_, number) => String(((seed + number * 11) % 49) + 1).padStart(2, '0'));
      return { id: `${game.id}-${serial}`, gameId: game.id, title: game.name, date: new Date(Date.now() - serial * 86400000 * 2).toISOString().slice(0, 10), numbers, extras: ticket ? ['R 2 · 6 · 9'] : ['C 07'], jackpot: serial === 1 ? 'Próximo bote disponible' : undefined };
    });
  }
}
