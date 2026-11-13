// Utility to manage anonymous device owner ID
export function getOwnerId() {
  const STORAGE_KEY = 'thanksgiving_owner_id';
  let ownerId = localStorage.getItem(STORAGE_KEY);
  if (!ownerId) {
    ownerId = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, ownerId);
  }
  return ownerId;
}

// Get or set remembered guest name for convenience
export function getSavedName() {
  return localStorage.getItem('thanksgiving_guest_name') || '';
}

export function saveGuestName(name) {
  if (name) {
    localStorage.setItem('thanksgiving_guest_name', name.trim());
  }
}

// Similarity check for duplicate warnings
export function findSimilarItems(newItemName, existingItems, currentItemId = null) {
  if (!newItemName || !newItemName.trim()) return [];
  
  const clean = (str) =>
    str.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  const target = clean(newItemName);
  if (target.length < 3) return [];

  const targetWords = target.split(/\s+/).filter(w => w.length > 2);

  return existingItems.filter(item => {
    if (currentItemId && item.id === currentItemId) return false;
    const itemName = clean(item.name || '');
    
    // Direct inclusion
    if (itemName.includes(target) || target.includes(itemName)) {
      return true;
    }

    // Common key words match (e.g. "pie", "turkey", "stuffing", "cranberry", "gravy", "potatoes")
    const words = itemName.split(/\s+/).filter(w => w.length > 2);
    const hasOverlap = targetWords.some(w => words.includes(w));
    return hasOverlap;
  });
}
