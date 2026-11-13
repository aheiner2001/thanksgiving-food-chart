import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { getOwnerId, getSavedName, saveGuestName, findSimilarItems } from './utils';

// Default starter categories per Aaron's spec
const DEFAULT_CATEGORIES = [
  { name: 'Main Dish', icon: '🍗' },
  { name: 'Side Dish', icon: '🥔' },
  { name: 'Drinks', icon: '🍷' },
  { name: 'Dessert', icon: '🥧' },
  { name: 'Activities to Do', icon: '🎲' }
];

export default function App() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ownership & Admin
  const [myOwnerId] = useState(() => getOwnerId());
  const [isAdmin, setIsAdmin] = useState(false);

  // Add/Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState(null); // Category object we are adding to
  const [editingItem, setEditingItem] = useState(null); // Item if editing

  // Form inputs
  const [itemName, setItemName] = useState('');
  const [broughtBy, setBroughtBy] = useState(getSavedName());
  const [servings, setServings] = useState('');
  const [needsMore, setNeedsMore] = useState(false);

  // New Category Modal / Inline state
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Duplicate detection
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [bypassWarning, setBypassWarning] = useState(false);

  // Check admin url param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || params.get('admin') === 'aaron' || params.get('key') === 'thanksgiving-admin') {
      setIsAdmin(true);
    }
  }, []);

  // Listen to Firestore
  useEffect(() => {
    const unsubCats = onSnapshot(query(collection(db, 'categories')), async (snapshot) => {
      if (snapshot.empty) {
        // Seed initial default categories
        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
          await addDoc(collection(db, 'categories'), {
            name: DEFAULT_CATEGORIES[i].name,
            icon: DEFAULT_CATEGORIES[i].icon,
            order: i,
            createdAt: serverTimestamp()
          });
        }
      } else {
        const catList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        catList.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
          return a.name.localeCompare(b.name);
        });
        setCategories(catList);
      }
    });

    const unsubItems = onSnapshot(query(collection(db, 'items')), (snapshot) => {
      const itemList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(itemList);
      setLoading(false);
    });

    return () => {
      unsubCats();
      unsubItems();
    };
  }, []);

  // Check duplicates when typing item name
  useEffect(() => {
    if (itemName.trim().length >= 3) {
      const matches = findSimilarItems(itemName, items, editingItem ? editingItem.id : null);
      setDuplicateMatches(matches);
    } else {
      setDuplicateMatches([]);
    }
    setBypassWarning(false);
  }, [itemName, editingItem, items]);

  // Open modal to add item into a specific column
  const handleOpenAdd = (cat) => {
    setEditingItem(null);
    setTargetCategory(cat);
    setItemName('');
    setBroughtBy(getSavedName());
    setServings('');
    setNeedsMore(false);
    setDuplicateMatches([]);
    setBypassWarning(false);
    setIsModalOpen(true);
  };

  // Open modal to edit item
  const handleOpenEdit = (item, cat) => {
    setEditingItem(item);
    setTargetCategory(cat);
    setItemName(item.name || '');
    setBroughtBy(item.broughtBy || '');
    setServings(item.servings || '');
    setNeedsMore(!!item.needsMore);
    setDuplicateMatches([]);
    setBypassWarning(false);
    setIsModalOpen(true);
  };

  // Submit item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !broughtBy.trim() || !targetCategory) {
      alert('Please fill out both the item name and your name.');
      return;
    }

    if (duplicateMatches.length > 0 && !bypassWarning) {
      return;
    }

    saveGuestName(broughtBy);

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'items', editingItem.id), {
          name: itemName.trim(),
          broughtBy: broughtBy.trim(),
          servings: servings.trim(),
          needsMore: needsMore,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'items'), {
          name: itemName.trim(),
          broughtBy: broughtBy.trim(),
          categoryId: targetCategory.id,
          servings: servings.trim(),
          needsMore: needsMore,
          ownerId: myOwnerId,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  // Delete item
  const handleDeleteItem = async (item) => {
    if (!isAdmin && item.ownerId !== myOwnerId) return;
    if (confirm(`Remove "${item.name}"?`)) {
      await deleteDoc(doc(db, 'items', item.id));
    }
  };

  // Create new column / category
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        order: categories.length,
        createdAt: serverTimestamp()
      });
      setNewCategoryName('');
      setIsNewCatModalOpen(false);
    } catch (err) {
      alert('Error creating category: ' + err.message);
    }
  };

  // Delete category if empty
  const handleDeleteCategory = async (cat) => {
    const count = items.filter(i => i.categoryId === cat.id).length;
    if (count > 0) {
      alert(`Cannot delete "${cat.name}" because it still has ${count} item(s).`);
      return;
    }
    if (confirm(`Delete the empty column "${cat.name}"?`)) {
      await deleteDoc(doc(db, 'categories', cat.id));
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#222] font-sans antialiased p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="max-w-[1600px] mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>🦃</span>
            <span>Thanksgiving Sign-Up</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            Click "+ Add" at the bottom of any column to sign up
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isAdmin && (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-1 rounded-md font-bold">
              Aaron Admin Active
            </span>
          )}
          <button
            onClick={() => setIsNewCatModalOpen(true)}
            className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition"
          >
            + Add New Category
          </button>
        </div>
      </header>

      {/* Main Board Columns */}
      <main className="max-w-[1600px] mx-auto">
        {loading ? (
          <div className="py-24 text-center text-sm font-semibold text-gray-400">
            Loading sign-up board...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-stretch">
            {categories.map((cat) => {
              const catItems = items.filter((it) => it.categoryId === cat.id);
              const isEmpty = catItems.length === 0;

              return (
                <div
                  key={cat.id}
                  className="bg-gray-50/80 border border-gray-200 rounded-xl flex flex-col min-h-[460px] shadow-sm hover:border-gray-300 transition"
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-gray-200 bg-white rounded-t-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-gray-900 text-sm">
                        {cat.name}
                      </h2>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isEmpty
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {catItems.length}
                      </span>
                    </div>

                    {(isAdmin || isEmpty) && (
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        title="Delete empty column"
                        className="text-gray-400 hover:text-red-500 text-xs p-1 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Column Items Scroll Area */}
                  <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[580px]">
                    {isEmpty ? (
                      <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-3 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                        <span className="text-xs font-medium">Nothing yet!</span>
                        <span className="text-[11px] text-gray-400 mt-0.5">
                          Be the first to claim
                        </span>
                      </div>
                    ) : (
                      catItems.map((item) => {
                        const isOwner = item.ownerId === myOwnerId;
                        const canManage = isAdmin || isOwner;

                        return (
                          <div
                            key={item.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 shadow-xs hover:border-gray-300 transition group"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="font-bold text-gray-900 text-sm leading-snug break-words">
                                {item.name}
                              </span>

                              {canManage && (
                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                                  <button
                                    onClick={() => handleOpenEdit(item, cat)}
                                    className="text-xs text-gray-400 hover:text-gray-800 p-0.5"
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="text-xs text-gray-400 hover:text-red-600 p-0.5"
                                    title="Delete"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Brought by & Servings */}
                            <div className="mt-1 text-xs text-gray-600 font-medium">
                              By <strong className="text-gray-900">{item.broughtBy}</strong>
                              {item.servings && (
                                <span className="text-gray-400 font-normal ml-1">
                                  ({item.servings})
                                </span>
                              )}
                            </div>

                            {/* Needs More of this tag */}
                            {item.needsMore && (
                              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                🔥 Need more of this!
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Button pinned at the bottom of the column */}
                  <div className="p-2.5 border-t border-gray-200 bg-white rounded-b-xl">
                    <button
                      onClick={() => handleOpenAdd(cat)}
                      className="w-full py-2 px-3 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition flex items-center justify-center gap-1"
                    >
                      <span>+</span>
                      <span>Add to {cat.name}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* + Add Column Card (Always visible on the right) */}
            <div
              onClick={() => setIsNewCatModalOpen(true)}
              className="border-2 border-dashed border-gray-200 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50 rounded-xl flex flex-col items-center justify-center min-h-[460px] p-6 text-center cursor-pointer transition select-none"
            >
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700 font-bold text-base mb-2 shadow-xs">
                +
              </div>
              <span className="font-bold text-xs text-gray-700">
                Add Category
              </span>
              <span className="text-[11px] text-gray-400 mt-1">
                Fit side-by-side
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Item Modal (Add or Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">
                {editingItem ? 'Edit Item' : `Add to ${targetCategory?.name}`}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  What are you bringing? *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pecan Pie, Cranberry Sauce"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-900 font-medium"
                />
              </div>

              {/* Duplicate Warning */}
              {duplicateMatches.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Someone might already be bringing this:</span>
                  </div>
                  <ul className="list-disc pl-4 text-gray-700">
                    {duplicateMatches.map((m) => (
                      <li key={m.id}>
                        {m.name} (by {m.broughtBy})
                      </li>
                    ))}
                  </ul>
                  {!bypassWarning ? (
                    <button
                      type="button"
                      onClick={() => setBypassWarning(true)}
                      className="text-xs font-bold text-amber-800 underline hover:text-amber-900 mt-1 block"
                    >
                      I still want to bring my version anyway
                    </button>
                  ) : (
                    <div className="text-[11px] font-bold text-emerald-700">
                      ✓ Confirmed! You can save now.
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah, Mike & Dave"
                  value={broughtBy}
                  onChange={(e) => setBroughtBy(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Servings or Amount (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10 people, 2 bottles"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-900 font-medium"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={needsMore}
                    onChange={(e) => setNeedsMore(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Flag as <strong>“Need more of this”</strong>
                  </span>
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={duplicateMatches.length > 0 && !bypassWarning}
                  className="flex-1 py-2 bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-lg text-xs"
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Category Modal */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xs p-5 shadow-xl">
            <h3 className="font-bold text-sm text-gray-900 mb-2">
              Add New Category
            </h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Games, Music, Setup"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-900 font-medium"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-lg text-xs"
                >
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
