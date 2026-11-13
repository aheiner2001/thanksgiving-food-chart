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
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ownership & Admin
  const [myOwnerId] = useState(() => getOwnerId());
  const [isAdmin, setIsAdmin] = useState(false);

  // Add / Edit Item Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  // Form inputs
  const [itemName, setItemName] = useState('');
  const [broughtBy, setBroughtBy] = useState(getSavedName());
  const [needsMore, setNeedsMore] = useState(false);
  const [targetCount, setTargetCount] = useState(2);

  // Suggestion Modal
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestName, setSuggestName] = useState('');

  // Claiming Suggestion Modal
  const [claimingSuggestion, setClaimingSuggestion] = useState(null);
  const [draggedTargetCat, setDraggedTargetCat] = useState(null);

  // Claim "I can bring one too!" Modal
  const [claimingMoreItem, setClaimingMoreItem] = useState(null);
  const [volunteerName, setVolunteerName] = useState(getSavedName());

  // New Category Modal
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Drag-and-drop state
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // Duplicate warning
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [bypassWarning, setBypassWarning] = useState(false);

  // Check admin
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

    const unsubSuggestions = onSnapshot(query(collection(db, 'suggestions')), (snapshot) => {
      const sugList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSuggestions(sugList);
    });

    return () => {
      unsubCats();
      unsubItems();
      unsubSuggestions();
    };
  }, []);

  // Check duplicate matches
  useEffect(() => {
    if (itemName.trim().length >= 3) {
      const matches = findSimilarItems(itemName, items, editingItem ? editingItem.id : null);
      setDuplicateMatches(matches);
    } else {
      setDuplicateMatches([]);
    }
    setBypassWarning(false);
  }, [itemName, editingItem, items]);

  const isActivityCat = (cat) => {
    if (!cat) return false;
    const name = (cat.name || '').toLowerCase();
    return name.includes('activit') || name.includes('game') || name.includes('play') || name.includes('fun');
  };

  const isActivityItem = (item, cat) => {
    if (cat && isActivityCat(cat)) return true;
    const itemCat = categories.find(c => c.id === item.categoryId);
    if (itemCat && isActivityCat(itemCat)) return true;
    return false;
  };

  // Open modal to add item into a column
  const handleOpenAdd = (cat) => {
    setEditingItem(null);
    setTargetCategory(cat);
    setItemName('');
    setBroughtBy(getSavedName());
    setNeedsMore(false);
    setTargetCount(2);
    setDuplicateMatches([]);
    setBypassWarning(false);
    setIsModalOpen(true);
  };

  // Open modal to edit item
  const handleOpenEdit = (item, cat) => {
    setEditingItem(item);
    setTargetCategory(cat);
    setItemName(item.name || '');
    setBroughtBy(item.broughtBy || getSavedName());
    setNeedsMore(!!item.needsMore);
    setTargetCount(item.targetCount || 2);
    setDuplicateMatches([]);
    setBypassWarning(false);
    setIsModalOpen(true);
  };

  // Submit item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemName.trim() || !targetCategory) {
      alert('Please enter a name for this item.');
      return;
    }

    const isActivity = isActivityCat(targetCategory);
    let finalBroughtBy = broughtBy.trim();

    if (!isActivity) {
      if (!finalBroughtBy) {
        alert('Please enter your name.');
        return;
      }
      saveGuestName(finalBroughtBy);
    } else {
      finalBroughtBy = finalBroughtBy || 'Group Activity';
    }

    if (duplicateMatches.length > 0 && !bypassWarning) {
      return;
    }

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'items', editingItem.id), {
          name: itemName.trim(),
          broughtBy: finalBroughtBy,
          categoryId: targetCategory.id,
          needsMore: !isActivity ? needsMore : false,
          targetCount: (!isActivity && needsMore) ? Number(targetCount) || 2 : null,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'items'), {
          name: itemName.trim(),
          broughtBy: finalBroughtBy,
          categoryId: targetCategory.id,
          needsMore: !isActivity ? needsMore : false,
          targetCount: (!isActivity && needsMore) ? Number(targetCount) || 2 : null,
          currentCount: 1,
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

  // Create new category
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

  // Delete category
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

  // Handle volunteer to bring another one of an item
  const handleConfirmBringMore = async (e) => {
    e.preventDefault();
    if (!volunteerName.trim() || !claimingMoreItem) return;

    saveGuestName(volunteerName);

    try {
      const originalItem = claimingMoreItem;
      const prevCount = originalItem.currentCount || 1;
      const target = originalItem.targetCount || 2;
      const newCount = prevCount + 1;

      await updateDoc(doc(db, 'items', originalItem.id), {
        currentCount: newCount,
        needsMore: newCount < target
      });

      await addDoc(collection(db, 'items'), {
        name: originalItem.name,
        broughtBy: volunteerName.trim(),
        categoryId: originalItem.categoryId,
        parentItemId: originalItem.id,
        currentCount: newCount,
        targetCount: target,
        needsMore: newCount < target,
        ownerId: myOwnerId,
        createdAt: serverTimestamp()
      });

      setClaimingMoreItem(null);
    } catch (err) {
      alert('Error updating: ' + err.message);
    }
  };

  // Add suggestion
  const handleAddSuggestion = async (e) => {
    e.preventDefault();
    if (!suggestName.trim()) return;

    try {
      await addDoc(collection(db, 'suggestions'), {
        name: suggestName.trim(),
        createdAt: serverTimestamp()
      });
      setSuggestName('');
      setIsSuggestModalOpen(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Claim suggestion
  const handleConfirmClaimSuggestion = async (e) => {
    e.preventDefault();
    if (!claimingSuggestion || !draggedTargetCat) return;

    const isActivity = isActivityCat(draggedTargetCat);
    let finalBroughtBy = volunteerName.trim();

    if (!isActivity) {
      if (!finalBroughtBy) {
        alert('Please enter your name.');
        return;
      }
      saveGuestName(finalBroughtBy);
    } else {
      finalBroughtBy = finalBroughtBy || 'Group Activity';
    }

    try {
      await addDoc(collection(db, 'items'), {
        name: claimingSuggestion.name,
        broughtBy: finalBroughtBy,
        categoryId: draggedTargetCat.id,
        currentCount: 1,
        ownerId: myOwnerId,
        createdAt: serverTimestamp()
      });

      await deleteDoc(doc(db, 'suggestions', claimingSuggestion.id));

      setClaimingSuggestion(null);
      setDraggedTargetCat(null);
    } catch (err) {
      alert('Error claiming idea: ' + err.message);
    }
  };

  const handleDeleteSuggestion = async (sug, e) => {
    e.stopPropagation();
    await deleteDoc(doc(db, 'suggestions', sug.id));
  };

  // DRAG & DROP
  const handleDragStartItem = (e, item) => {
    setDraggedItem({ type: 'item', data: item });
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'item', id: item.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartSuggestion = (e, sug) => {
    setDraggedItem({ type: 'suggestion', data: sug });
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'suggestion', id: sug.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverColumn = (e, catId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== catId) {
      setDragOverColId(catId);
    }
  };

  const handleDragLeaveColumn = (e, catId) => {
    if (dragOverColId === catId) {
      setDragOverColId(null);
    }
  };

  const handleDropOnColumn = async (e, targetCat) => {
    e.preventDefault();
    setDragOverColId(null);

    if (!draggedItem) return;

    if (draggedItem.type === 'item') {
      const item = draggedItem.data;
      if (item.categoryId === targetCat.id) return;

      if (!isAdmin && item.ownerId !== myOwnerId) {
        alert("You can only move dishes that you added.");
        return;
      }

      try {
        await updateDoc(doc(db, 'items', item.id), {
          categoryId: targetCat.id,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        alert('Could not move item: ' + err.message);
      }
    } else if (draggedItem.type === 'suggestion') {
      const sug = draggedItem.data;
      const isActivity = isActivityCat(targetCat);

      if (isActivity) {
        // Automatically add to activity without requiring a person's name
        try {
          await addDoc(collection(db, 'items'), {
            name: sug.name,
            broughtBy: 'Group Activity',
            categoryId: targetCat.id,
            currentCount: 1,
            ownerId: myOwnerId,
            createdAt: serverTimestamp()
          });
          await deleteDoc(doc(db, 'suggestions', sug.id));
        } catch (err) {
          alert('Error: ' + err.message);
        }
      } else {
        setClaimingSuggestion(sug);
        setDraggedTargetCat(targetCat);
        setVolunteerName(getSavedName());
      }
    }

    setDraggedItem(null);
  };

  const isCurrentModalActivity = isActivityCat(targetCategory);

  return (
    <div className="min-h-screen text-[#261f18] font-sans antialiased p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="max-w-[1650px] mx-auto mb-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-amber-900/10 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Interactive Hover Turkey Face */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 flex-shrink-0 cursor-pointer group">
            <img
              src="./turkey.png"
              alt="Thanksgiving Turkey"
              className="absolute inset-0 w-full h-full object-contain rounded-2xl border-2 border-amber-900/15 bg-white shadow-md transition-opacity duration-150 group-hover:opacity-0"
            />
            <img
              src="./turkey-hover.png"
              alt="Thanksgiving Turkey Hover Face"
              className="absolute inset-0 w-full h-full object-contain rounded-2xl border-2 border-amber-900/15 bg-white shadow-md transition-opacity duration-150 opacity-0 group-hover:opacity-100"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
              Thanksgiving Sign-Up
            </h1>
            <p className="text-xs sm:text-sm text-amber-900/70 font-medium">
              Click "+ Add" on any column to sign up • Drag & drop to move items!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-1.5 rounded-md font-bold">
              Aaron Admin Active
            </span>
          )}
          <button
            onClick={() => setIsSuggestModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white shadow-xs text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <span>💡</span>
            <span>+ Suggest an Idea</span>
          </button>
          <button
            onClick={() => setIsNewCatModalOpen(true)}
            className="px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition"
          >
            + Add New Category
          </button>
        </div>
      </header>

      {/* Floating Idea / Wishlist Suggestions Canvas */}
      <section className="max-w-[1650px] mx-auto mb-8 bg-white/95 backdrop-blur-md border border-amber-900/15 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-900 flex items-center gap-1.5">
              <span>💭</span>
              <span>Idea Wishlist & Suggestions</span>
            </span>
            <span className="text-xs text-amber-900/70 font-medium hidden sm:inline">
              (Drag into any column, or click to claim!)
            </span>
          </div>

          <button
            onClick={() => setIsSuggestModalOpen(true)}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
          >
            + Add Suggestion
          </button>
        </div>

        {suggestions.length === 0 ? (
          <div className="py-4 text-center text-xs font-medium text-gray-400 border border-dashed border-amber-900/20 rounded-xl bg-amber-50/30">
            No suggestions yet. Have an idea for a dish or game? Click <strong>"+ Suggest an Idea"</strong>!
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 items-center">
            {suggestions.map((sug) => {
              return (
                <div
                  key={sug.id}
                  draggable
                  onDragStart={(e) => handleDragStartSuggestion(e, sug)}
                  onClick={() => {
                    setVolunteerName(getSavedName());
                    setClaimingSuggestion(sug);
                    setDraggedTargetCat(categories[0] || null);
                  }}
                  className="group cursor-grab active:cursor-grabbing bg-amber-50/90 hover:bg-amber-100 border border-amber-300 hover:border-amber-500 hover:shadow-md px-3.5 py-1.5 rounded-full flex items-center gap-2 transition select-none text-xs"
                  title="Drag into any column or click to claim!"
                >
                  <span className="text-amber-700">⠿</span>
                  <span className="font-bold text-gray-900">
                    {sug.name}
                  </span>
                  <span className="text-xs text-amber-700 font-bold group-hover:text-amber-900">
                    Claim →
                  </span>
                  <button
                    onClick={(e) => handleDeleteSuggestion(sug, e)}
                    className="text-gray-400 hover:text-red-500 ml-0.5 text-xs font-bold"
                    title="Remove suggestion"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Main Board Columns: Responsive grid spanning available categories */}
      <main className="max-w-[1650px] mx-auto pb-32">
        {loading ? (
          <div className="py-24 text-center text-sm font-semibold text-gray-400 bg-white/90 rounded-2xl">
            Loading sign-up board...
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Top row bar for board controls */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-white/90 drop-shadow-sm uppercase tracking-wider">
                Categories ({categories.length})
              </span>
              <button
                onClick={() => setIsNewCatModalOpen(true)}
                className="px-3 py-1.5 bg-white/90 hover:bg-white text-gray-900 border border-amber-900/10 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                title="Add a new column"
              >
                <span>➕</span>
                <span>Add Category</span>
              </button>
            </div>

            {/* Auto-responsive grid: squeezes on wide screens or cleanly wraps to next row if screen is narrow, never causing horizontal overflow */}
            <div 
              className="grid gap-4 items-stretch"
              style={{
                gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, max(230px, 100% / ${Math.min(categories.length, 6)} - 1rem)), 1fr))`
              }}
            >
              {categories.map((cat) => {
                const catItems = items.filter((it) => it.categoryId === cat.id);
                const isEmpty = catItems.length === 0;
                const isDragOver = dragOverColId === cat.id;
                const isActivity = isActivityCat(cat);
                const isDense = catItems.length > 5; // compact when many items

                return (
                  <div
                    key={cat.id}
                    onDragOver={(e) => handleDragOverColumn(e, cat.id)}
                    onDragLeave={(e) => handleDragLeaveColumn(e, cat.id)}
                    onDrop={(e) => handleDropOnColumn(e, cat)}
                    className={`bg-white/95 backdrop-blur-md rounded-2xl flex flex-col h-[520px] shadow-sm transition-all border ${
                      isDragOver
                        ? 'border-2 border-amber-500 bg-amber-50/70 scale-[1.01] shadow-lg ring-2 ring-amber-300'
                        : 'border-amber-900/15 hover:border-amber-900/30'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="p-3 border-b border-gray-100 bg-white/90 rounded-t-2xl flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base flex-shrink-0">{cat.icon || '🍽️'}</span>
                        <h2 className="font-bold text-gray-900 text-sm truncate">
                          {cat.name}
                        </h2>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            isEmpty
                              ? 'bg-red-50 text-red-600 border border-red-200'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {catItems.length}
                        </span>
                      </div>

                      {(isAdmin || isEmpty) && (
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete empty column"
                          className="text-gray-400 hover:text-red-500 text-xs p-1 rounded flex-shrink-0 ml-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Uniform Scrollable Column Items Container */}
                    <div 
                      id={`col-scroll-${cat.id}`}
                      className="flex-1 p-2.5 overflow-y-auto space-y-2 relative"
                    >
                      {isEmpty ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-3 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                          <span className="text-xs font-medium">Nothing yet!</span>
                          <span className="text-[11px] text-gray-400 mt-0.5">
                            Drag here or click "+ Add"
                          </span>
                        </div>
                      ) : (
                        catItems.map((item) => {
                          const isOwner = item.ownerId === myOwnerId;
                          const canManage = isAdmin || isOwner;
                          const count = item.currentCount || 1;
                          const target = item.targetCount || (item.needsMore ? 2 : 1);

                          return (
                            <div
                              key={item.id}
                              draggable={canManage}
                              onDragStart={(e) => handleDragStartItem(e, item)}
                              className={`bg-white border rounded-xl shadow-xs hover:border-amber-300 hover:shadow-md transition group ${
                                isDense ? 'p-2 text-xs' : 'p-3'
                              } ${
                                canManage ? 'cursor-grab active:cursor-grabbing' : ''
                              } border-gray-200`}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {canManage && (
                                    <span className="text-gray-300 group-hover:text-amber-500 text-xs select-none flex-shrink-0" title="Drag to move column">
                                      ⠿
                                    </span>
                                  )}
                                  <span className="font-bold text-gray-900 text-sm leading-snug break-words">
                                    {item.name}
                                  </span>
                                </div>

                                {canManage && (
                                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 flex-shrink-0">
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

                              {/* Brought by (Hidden for Activities!) */}
                              {!isActivity && item.broughtBy && item.broughtBy !== 'Group Activity' && (
                                <div className="mt-1 text-xs text-gray-600 font-medium pl-3.5">
                                  By <strong className="text-gray-900">{item.broughtBy}</strong>
                                </div>
                              )}

                              {/* Need More of this Section (Only for Food/Drinks, not Activities) */}
                              {!isActivity && (
                                item.needsMore ? (
                                  <div className="mt-2 pt-1.5 border-t border-gray-100 pl-3.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="font-bold text-amber-800 flex items-center gap-1">
                                        <span>🔥</span>
                                        <span>We have {count} of {target} needed</span>
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setVolunteerName(getSavedName());
                                        setClaimingMoreItem(item);
                                      }}
                                      className="mt-1.5 w-full py-1 px-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[11px] transition text-center"
                                    >
                                      + I can bring one too!
                                    </button>
                                  </div>
                                ) : (
                                  count > 1 && (
                                    <div className="mt-1.5 ml-3.5 inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded-md">
                                      ✓ We have {count} of these covered!
                                    </div>
                                  )
                                )
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Scroll indicators helper if column has many items */}
                    {catItems.length > 4 && (
                      <div className="px-3 py-1 bg-amber-50/50 border-t border-gray-100 flex items-center justify-between text-[10px] text-amber-800/80 font-bold">
                        <span>Scroll for more ({catItems.length})</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const el = document.getElementById(`col-scroll-${cat.id}`);
                              if (el) el.scrollBy({ top: -120, behavior: 'smooth' });
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-white border border-gray-200 hover:bg-amber-100"
                            title="Scroll up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              const el = document.getElementById(`col-scroll-${cat.id}`);
                              if (el) el.scrollBy({ top: 120, behavior: 'smooth' });
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-white border border-gray-200 hover:bg-amber-100"
                            title="Scroll down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Add Button pinned at the bottom */}
                    <div className="p-2.5 border-t border-gray-100 bg-white/90 rounded-b-2xl flex-shrink-0">
                      <button
                        onClick={() => handleOpenAdd(cat)}
                        className="w-full py-2 px-3 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-amber-50 hover:text-amber-900 border border-gray-200 hover:border-amber-200 rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <span>+</span>
                        <span>Add to {cat.name}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add or Edit Item (Streamlined: No Category dropdown, No Servings, No Name for Activities) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-900">
                {editingItem 
                  ? (isCurrentModalActivity ? 'Edit Activity Idea' : 'Edit Item') 
                  : (isCurrentModalActivity ? 'Add Activity Idea' : `Add to ${targetCategory?.name}`)}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-3.5">
              {/* Item or Activity Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  {isCurrentModalActivity ? 'Activity Idea *' : 'What are you bringing? *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={isCurrentModalActivity ? 'e.g. Board Games, Football, Trivia' : 'e.g. Dinner Rolls, Pecan Pie'}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-900 font-medium"
                />
              </div>

              {/* Your Name (Only shown if NOT an Activity) */}
              {!isCurrentModalActivity && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah, Mike"
                    value={broughtBy}
                    onChange={(e) => setBroughtBy(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-900 font-medium"
                  />
                </div>
              )}

              {/* Need More Checkbox + Target count (Only shown for Food/Drinks) */}
              {!isCurrentModalActivity && (
                <div className="pt-1 space-y-2">
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

                  {needsMore && (
                    <div className="pl-6 flex items-center gap-2">
                      <span className="text-xs text-gray-600 font-medium">How many total wanted?</span>
                      <input
                        type="number"
                        min="2"
                        max="20"
                        value={targetCount}
                        onChange={(e) => setTargetCount(e.target.value)}
                        className="w-16 px-2 py-1 bg-gray-50 border border-gray-300 rounded text-xs font-bold"
                      />
                    </div>
                  )}
                </div>
              )}

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
                  className="flex-1 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-lg text-xs"
                >
                  {editingItem ? 'Save Changes' : isCurrentModalActivity ? 'Add Activity' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Volunteer "I can bring one too!" */}
      {claimingMoreItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xs p-5 shadow-xl">
            <h3 className="font-bold text-sm text-gray-900 mb-1">
              Bring another {claimingMoreItem.name}?
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              This adds your own card for {claimingMoreItem.name} and updates the count to { (claimingMoreItem.currentCount || 1) + 1 } out of { claimingMoreItem.targetCount || 2 }.
            </p>
            <form onSubmit={handleConfirmBringMore} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Uncle Bob"
                  value={volunteerName}
                  onChange={(e) => setVolunteerName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setClaimingMoreItem(null)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
                >
                  Confirm Sign-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Suggest Idea (Simplified: Only the idea input, no category dropdown) */}
      {isSuggestModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="font-bold text-sm text-gray-900 mb-1">
              Suggest an Idea for the Wishlist
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Add any dish or activity. Anyone can click it or drag it to a column to claim it!
            </p>
            <form onSubmit={handleAddSuggestion} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Idea or Item *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Sweet Potato Casserole, Touch Football"
                  value={suggestName}
                  onChange={(e) => setSuggestName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSuggestModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
                >
                  Add Idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Claim Floating Suggestion */}
      {claimingSuggestion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xs p-5 shadow-xl">
            <h3 className="font-bold text-sm text-gray-900 mb-1">
              Claim "{claimingSuggestion.name}"
            </h3>
            <form onSubmit={handleConfirmClaimSuggestion} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Add to Column:
                </label>
                <select
                  value={draggedTargetCat?.id || ''}
                  onChange={(e) => {
                    const found = categories.find(c => c.id === e.target.value);
                    if (found) setDraggedTargetCat(found);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {!isActivityCat(draggedTargetCat) && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Sarah"
                    value={volunteerName}
                    onChange={(e) => setVolunteerName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setClaimingSuggestion(null);
                    setDraggedTargetCat(null);
                  }}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-lg text-xs"
                >
                  Claim & Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Category */}
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
                placeholder="e.g. Setup, Games, Cleanup"
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
