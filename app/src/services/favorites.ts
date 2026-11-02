/**
 * Favorites data service. The app only talks to this interface, so the
 * localStorage implementation can be swapped for Supabase later
 * (e.g. a `favorites` table keyed by user_id + product_id).
 */
export interface FavoritesService {
  list(): Promise<string[]>
  add(productId: string): Promise<void>
  remove(productId: string): Promise<void>
}

const KEY = 'lumi_app_favorites'

export class LocalFavoritesService implements FavoritesService {
  private read(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  private write(ids: string[]) {
    localStorage.setItem(KEY, JSON.stringify(ids))
  }
  async list() {
    return this.read()
  }
  async add(id: string) {
    const ids = this.read().filter((x) => x !== id)
    ids.unshift(id) // newest first
    this.write(ids)
  }
  async remove(id: string) {
    this.write(this.read().filter((x) => x !== id))
  }
}

export const favoritesService: FavoritesService = new LocalFavoritesService()
