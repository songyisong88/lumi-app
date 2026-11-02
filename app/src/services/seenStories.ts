const KEY = 'lumi_app_seen_stories'
export const getSeenStories = (): string[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
export const markStorySeen = (creatorId: string) => {
  const s = new Set(getSeenStories()); s.add(creatorId)
  localStorage.setItem(KEY, JSON.stringify([...s]))
}
