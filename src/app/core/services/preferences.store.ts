import { Injectable } from '@angular/core';

const COUNTRY_KEY = 'resuloto:country';
const FAVORITES_KEY = 'resuloto:favorites:';

@Injectable({ providedIn: 'root' })
export class PreferencesStore {
  country(): string | null {
    return this.safeGet(COUNTRY_KEY);
  }

  saveCountry(country: string): void {
    this.safeSet(COUNTRY_KEY, country);
  }

  favorites(country: string): string[] {
    const saved = this.safeGet(`${FAVORITES_KEY}${country}`);
    if (!saved) return [];
    try {
      const parsed: unknown = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  toggleFavorite(country: string, game: string): string[] {
    const favorites = new Set(this.favorites(country));
    favorites.has(game) ? favorites.delete(game) : favorites.add(game);
    const value = [...favorites];
    this.safeSet(`${FAVORITES_KEY}${country}`, JSON.stringify(value));
    return value;
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // La app sigue funcionando cuando el navegador no permite almacenamiento.
    }
  }
}
