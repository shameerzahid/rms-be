export function serializeReview(row) {
  return {
    id: row.id,
    rating: row.rating,
    displayName: row.displayName,
    date: row.date,
    text: row.text,
    source: row.source,
    pageIds: JSON.parse(row.pageIds || '[]'),
    pinned: row.pinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function parsePageIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id) => typeof id === 'string' && id))]
}
