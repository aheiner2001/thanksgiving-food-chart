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
import confetti from 'canvas-confetti';

const STARTER_CATEGORIES = [
  { name: 'Main Dish', icon: '🍗', bg: '#FFE8D6' },
  { name: 'Side Dish', icon: '🥔', bg: '#EAF4E2' },
  { name: 'Dessert', icon: '🥧', bg: '#FDE2E4' },
  { name: 'Drinks', icon: '🧃', bg: '#E0F4FF' },
  { name: 'Appetizers', icon: '🧀', bg: '#FFF1D0' },
  { name: 'Games & Fun', icon: '🎲', bg: '#EDE4FF' }
];

const DIETARY_TAGS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: '🌱' },
  { id: 'vegan', label: 'Vegan', icon: '🥑' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  { id: 'nut-free', label: 'Nut-Free', icon: '🥜' }
];

export default function App() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');

  // Ownership & Admin
  const [myOwnerId] = useState(() => getOwnerId());
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    broughtBy: getSavedName(),
    categoryId: '',
    servings: '',
    dietaryTags: [],
    needsMore: false
  });

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [bypassWarning, setBypassWarning] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Detect admin URL parameter
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
        for (let i = 0; i < STARTER_CATEGORIES.length; i++) {
          const cat = STARTER_CATEGORIES[i];
          await addDoc(collection(db, 'categories'), {
            name: cat.name,
            icon: cat.icon,
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

  // Check duplicate matches
  useEffect(() => {
    if (formData.name.trim().length >= 3) {
      const matches = findSimilarItems(formData.name, items, editingItem ? editingItem.id : null);
      setDuplicateMatches(matches);
    } else {
      setDuplicateMatches([]);
    }
    setBypassWarning(false);
  }, [formData.name, editingItem, items]);

  const handleOpenAdd = (defaultCatId = '') => {
    setEditingItem(null);
    setFormData({
      name: '',
      broughtBy: getSavedName(),
      categoryId: defaultCatId || (categories[0] ? categories[0].id : ''),
      servings: '',
      dietaryTags: [],
      needsMore: false
    });
    setDuplicateMatches([]);
    setBypassWarning(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      broughtBy: item.broughtBy || '',
      categoryId: item.categoryId || (categories[0] ? categories[0].id : ''),
      servings: item.servings || '',
      dietaryTags: item.dietaryTags || [],
      needsMore: !!item.needsMore
    });
    setDuplicateMatches([]);
    setBypassWarning(false);
    setIsModalOpen(true);
  };

  const toggleDietaryTag = (id) => {
    setFormData(prev => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(id)
        ? prev.dietaryTags.filter(t => t !== id)
        : [...prev.dietaryTags, id]
    }));
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.broughtBy.trim() || !formData.categoryId) {
      alert('Please fill out the dish name, who is bringing it, and category.');
      return;
    }

    if (duplicateMatches.length > 0 && !bypassWarning) {
      return;
    }

    saveGuestName(formData.broughtBy);

    try {
      if (editingItem) {
        await updateDoc(doc(db, 'items', editingItem.id), {
          name: formData.name.trim(),
          broughtBy: formData.broughtBy.trim(),
          categoryId: formData.categoryId,
          servings: formData.servings.trim(),
          dietaryTags: formData.dietaryTags,
          needsMore: formData.needsMore,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'items'), {
          name: formData.name.trim(),
          broughtBy: formData.broughtBy.trim(),
          categoryId: formData.categoryId,
          servings: formData.servings.trim(),
          dietaryTags: formData.dietaryTags,
          needsMore: formData.needsMore,
          ownerId: myOwnerId,
          createdAt: serverTimestamp()
        });

        // Switch celebratory pop
        confetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#F28482', '#F6BD60', '#84A59D', '#F77F00', '#D64045']
        });
      }

      setIsModalOpen(false);
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!isAdmin && item.ownerId !== myOwnerId) return;
    if (confirm(`Remove "${item.name}"?`)) {
      await deleteDoc(doc(db, 'items', item.id));
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
        name: newCatName.trim(),
        icon: '✨',
        order: categories.length + 1,
        createdAt: serverTimestamp()
      });
      setFormData(prev => ({ ...prev, categoryId: docRef.id }));
      setNewCatName('');
      setIsAddingCategory(false);
    } catch (err) {
      alert('Could not add category: ' + err.message);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const count = items.filter(i => i.categoryId === cat.id).length;
    if (count > 0) {
      alert(`Cannot delete "${cat.name}" because it still has ${count} item(s)!`);
      return;
    }
    if (confirm(`Delete empty category "${cat.name}"?`)) {
      await deleteDoc(doc(db, 'categories', cat.id));
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Thanksgiving Sign-Up',
        text: 'Sign up to bring food or games for Thanksgiving!',
        url: window.location.origin
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const visibleCategories = activeTab === 'ALL'
    ? categories
    : categories.filter(c => c.id === activeTab);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C241E] pb-28 relative overflow-x-hidden selection:bg-[#F28482] selection:text-white">
      {/* Decorative fall leaves & turkey doodles */}
      <div className="absolute top-4 left-3 select-none pointer-events-none opacity-80 bobbing text-2xl" aria-hidden="true">
        🍂
      </div>
      <div className="absolute top-12 right-5 select-none pointer-events-none opacity-80 bobbing-delayed text-2xl" aria-hidden="true">
        🍁
      </div>
      <div className="absolute top-48 left-2 select-none pointer-events-none opacity-70 bobbing-delayed text-xl" aria-hidden="true">
        🌾
      </div>
      <div className="absolute top-72 right-3 select-none pointer-events-none opacity-75 bobbing text-2xl" aria-hidden="true">
        🍂
      </div>

      {/* Top Simple Header */}
      <div className="max-w-xl mx-auto px-4 pt-8 pb-4 text-center">
        {/* Friendly Turkey Doodle Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#FFF0E0] border-2 border-[#544030] shadow-[0_4px_0_#544030] mb-2 bobbing">
          <span className="text-4xl" role="img" aria-label="Turkey">🦃</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#3A2D25] switch-font">
          Thanksgiving Sign-Up
        </h1>
        <p className="text-[#877467] text-sm mt-1 font-semibold">
          What are you bringing this year?
        </p>

        {/* Nintendo Switch Pill Counters & Share */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-[#544030] rounded-full text-xs font-bold shadow-[0_2px_0_#544030]">
            <span>🍽️</span>
            <span>{items.length} items signed up</span>
          </div>

          <button
            onClick={handleShare}
            className="switch-btn inline-flex items-center gap-1.5 px-3 py-1 bg-[#FDE2E4] hover:bg-[#FCD5D8] border-2 border-[#544030] rounded-full text-xs font-bold shadow-[0_2px_0_#544030] text-[#4A3337]"
          >
            <span>🔗</span>
            <span>{copiedLink ? 'Link Copied!' : 'Share with Family'}</span>
          </button>
        </div>

        {/* Aaron Admin banner if active */}
        {isAdmin && (
          <div className="mt-3 inline-block px-3 py-1 bg-[#FFD166] border-2 border-[#544030] rounded-full text-xs font-black shadow-[0_2px_0_#544030]">
            👑 Aaron Admin Mode (Edit & Delete Any Item)
          </div>
        )}
      </div>

      {/* Main Switch-like Container */}
      <main className="max-w-xl mx-auto px-4 mt-2">
        {/* Category Filter Pills (Scrollable Nintendo-style tabs) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 no-scrollbar">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`switch-btn px-3.5 py-1.5 rounded-2xl text-xs font-black border-2 border-[#544030] whitespace-nowrap transition-all ${
              activeTab === 'ALL'
                ? 'bg-[#E07A5F] text-white shadow-[0_3px_0_#544030]'
                : 'bg-white text-[#544030] shadow-[0_2px_0_#544030]'
            }`}
          >
            All Categories
          </button>
          {categories.map(c => {
            const count = items.filter(it => it.categoryId === c.id).length;
            const isSelected = activeTab === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveTab(c.id)}
                className={`switch-btn px-3 py-1.5 rounded-2xl text-xs font-black border-2 border-[#544030] whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#E07A5F] text-white shadow-[0_3px_0_#544030]'
                    : 'bg-white text-[#544030] shadow-[0_2px_0_#544030]'
                }`}
              >
                <span>{c.icon || '🍽️'}</span>
                <span>{c.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    count === 0
                      ? 'bg-[#F28482] text-white'
                      : isSelected ? 'bg-white/30 text-white' : 'bg-[#EFE9DF] text-[#544030]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="text-center py-20">
            <span className="text-4xl animate-bounce inline-block">🥧</span>
            <p className="mt-3 text-sm font-bold text-[#877467]">Getting the feast ready...</p>
          </div>
        ) : (
          /* Category Cards */
          <div className="space-y-5 mt-2">
            {visibleCategories.map(cat => {
              const catItems = items.filter(it => it.categoryId === cat.id);
              const isEmpty = catItems.length === 0;

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-3xl border-2 border-[#544030] shadow-[0_4px_0_#544030] overflow-hidden"
                >
                  {/* Category Header */}
                  <div className="px-4 py-3 bg-[#FFFDF9] border-b-2 border-[#544030] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon || '🍽️'}</span>
                      <h2 className="text-base sm:text-lg font-bold text-[#3A2D25] switch-font">
                        {cat.name}
                      </h2>
                      {/* Count badge */}
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded-full border-2 border-[#544030] ${
                          isEmpty
                            ? 'bg-[#F28482] text-white shadow-[0_1px_0_#544030]'
                            : 'bg-[#FFE8D6] text-[#544030]'
                        }`}
                      >
                        {catItems.length === 0 ? 'Needed! (0)' : `${catItems.length}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Delete empty category option */}
                      {(isAdmin || isEmpty) && (
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete empty category"
                          className="w-7 h-7 flex items-center justify-center text-xs text-[#9E8B7E] hover:text-[#D64045] rounded-full hover:bg-stone-100 transition"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenAdd(cat.id)}
                        className="switch-btn px-2.5 py-1 bg-[#84A59D] hover:bg-[#72978F] text-white font-bold text-xs rounded-xl border-2 border-[#544030] shadow-[0_2px_0_#544030]"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="divide-y-2 divide-[#F4EFE6]">
                    {isEmpty ? (
                      <div className="py-7 px-4 text-center">
                        <p className="text-xs font-bold text-[#A8988B]">
                          Nobody has claimed this yet!
                        </p>
                        <button
                          onClick={() => handleOpenAdd(cat.id)}
                          className="mt-2 text-xs font-black text-[#E07A5F] hover:underline"
                        >
                          Claim the first {cat.name.toLowerCase()} →
                        </button>
                      </div>
                    ) : (
                      catItems.map(item => {
                        const isOwner = item.ownerId === myOwnerId;
                        const canEdit = isAdmin || isOwner;

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 sm:p-4 flex items-start justify-between gap-3 hover:bg-[#FAF7F2] transition group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-[#3A2D25] text-sm sm:text-base">
                                  {item.name}
                                </span>

                                {item.needsMore && (
                                  <span className="text-[10px] font-black bg-[#F28482] text-white px-2 py-0.5 rounded-full border border-[#544030] shadow-[0_1px_0_#544030]">
                                    🔥 Need More!
                                  </span>
                                )}

                                {isOwner && (
                                  <span className="text-[10px] font-bold bg-[#EAE2B7] text-[#544030] px-1.5 py-0.2 rounded-md border border-[#544030]">
                                    Yours
                                  </span>
                                )}
                              </div>

                              {/* Brought by & Servings */}
                              <div className="mt-0.5 flex items-center gap-2 text-xs font-bold text-[#756356] flex-wrap">
                                <span>
                                  By <strong className="text-[#3A2D25]">{item.broughtBy}</strong>
                                </span>
                                {item.servings && (
                                  <>
                                    <span>•</span>
                                    <span className="text-[#968477]">Serves ~{item.servings}</span>
                                  </>
                                )}
                              </div>

                              {/* Dietary pills */}
                              {item.dietaryTags && item.dietaryTags.length > 0 && (
                                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                                  {item.dietaryTags.map(tagId => {
                                    const tagObj = DIETARY_TAGS.find(t => t.id === tagId);
                                    return (
                                      <span
                                        key={tagId}
                                        className="text-[10px] font-bold bg-[#EAF4E2] text-[#416138] px-2 py-0.5 rounded-full border border-[#7BAE73]"
                                      >
                                        {tagObj ? `${tagObj.icon} ${tagObj.label}` : tagId}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Edit / Delete Buttons */}
                            {canEdit && (
                              <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-[#544030] text-xs font-bold hover:bg-[#F2EFE9] text-[#544030]"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-[#544030] text-xs font-bold hover:bg-[#FDE2E4] text-[#D64045]"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-xs font-bold text-[#A8988B] pb-6 space-y-1">
          <div className="text-xl select-none mb-1">🦃 🍂 🥧</div>
          <p>Thanksgiving Feast Sign-Up • Simple family potluck</p>
          <div className="pt-2">
            {!isAdmin ? (
              <a href="?admin=true" className="text-[#B5A79C] hover:text-[#544030] underline text-[11px]">
                Host Login
              </a>
            ) : (
              <span className="text-[#3A2D25] bg-[#FFD166] px-2 py-0.5 rounded-full text-[10px] font-bold">
                Admin mode active
              </span>
            )}
          </div>
        </footer>
      </main>

      {/* Floating Bottom Big Switch Button */}
      <div className="fixed bottom-4 left-0 right-0 max-w-sm mx-auto px-4 z-30">
        <button
          onClick={() => handleOpenAdd()}
          className="switch-btn w-full bg-[#E07A5F] hover:bg-[#D46C51] text-white font-black py-3.5 px-6 rounded-2xl border-2 border-[#544030] shadow-[0_4px_0_#544030] text-base flex items-center justify-center gap-2"
        >
          <span className="text-xl">➕</span>
          <span>Add Something to Bring</span>
        </button>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#3A2D25]/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-[#544030] p-5 sm:p-6 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#F4EFE6]">
              <h3 className="font-bold text-lg text-[#3A2D25] switch-font flex items-center gap-1.5">
                <span>{editingItem ? '✏️' : '🥧'}</span>
                <span>{editingItem ? 'Edit Sign-Up' : 'I am bringing...'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full border-2 border-[#544030] bg-[#FAF7F2] font-black text-sm flex items-center justify-center hover:bg-stone-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              {/* Dish Name */}
              <div>
                <label className="block text-xs font-black text-[#544030] uppercase mb-1">
                  Dish or Item *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandma's Apple Pie, Dinner Rolls"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border-2 border-[#544030] rounded-xl text-sm font-bold focus:outline-none focus:bg-white"
                />
              </div>

              {/* Duplicate Warning */}
              {duplicateMatches.length > 0 && (
                <div className="p-3 bg-[#FFE8D6] border-2 border-[#544030] rounded-xl text-xs space-y-1.5 shadow-[0_2px_0_#544030]">
                  <div className="font-black text-[#D64045] flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Someone might already be bringing this:</span>
                  </div>
                  <ul className="list-disc pl-5 font-bold text-[#544030]">
                    {duplicateMatches.map(m => (
                      <li key={m.id}>
                        {m.name} (by {m.broughtBy})
                      </li>
                    ))}
                  </ul>
                  {!bypassWarning ? (
                    <button
                      type="button"
                      onClick={() => setBypassWarning(true)}
                      className="mt-1 text-xs font-black text-[#E07A5F] underline"
                    >
                      I still want to bring my version anyway
                    </button>
                  ) : (
                    <div className="text-[11px] font-black text-[#416138]">
                      ✓ Confirmed! You can save now.
                    </div>
                  )}
                </div>
              )}

              {/* Your Name */}
              <div>
                <label className="block text-xs font-black text-[#544030] uppercase mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aunt Karen, Sam"
                  value={formData.broughtBy}
                  onChange={(e) => setFormData({ ...formData, broughtBy: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border-2 border-[#544030] rounded-xl text-sm font-bold focus:outline-none focus:bg-white"
                />
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-black text-[#544030] uppercase mb-1">
                  Category *
                </label>
                {!isAddingCategory ? (
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setIsAddingCategory(true);
                      } else {
                        setFormData({ ...formData, categoryId: e.target.value });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border-2 border-[#544030] rounded-xl text-sm font-bold focus:outline-none focus:bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon || '🍽️'} {c.name}
                      </option>
                    ))}
                    <option value="ADD_NEW">+ Add a new category...</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Category name (e.g. Board Games)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#FAF7F2] border-2 border-[#544030] rounded-xl text-sm font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="switch-btn px-3 py-2 bg-[#84A59D] text-white border-2 border-[#544030] rounded-xl text-xs font-black shadow-[0_2px_0_#544030]"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(false)}
                      className="text-xs font-bold text-[#877467]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Servings */}
              <div>
                <label className="block text-xs font-black text-[#544030] uppercase mb-1">
                  Servings or Quantity (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10 people, 2 bottles, 1 tray"
                  value={formData.servings}
                  onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border-2 border-[#544030] rounded-xl text-sm font-bold focus:outline-none focus:bg-white"
                />
              </div>

              {/* Dietary Tags */}
              <div>
                <label className="block text-xs font-black text-[#544030] uppercase mb-1.5">
                  Dietary Tags (optional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_TAGS.map(t => {
                    const isChecked = formData.dietaryTags.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleDietaryTag(t.id)}
                        className={`switch-btn text-xs font-bold px-2.5 py-1 rounded-xl border-2 border-[#544030] transition ${
                          isChecked
                            ? 'bg-[#84A59D] text-white shadow-[0_2px_0_#544030]'
                            : 'bg-white text-[#544030] shadow-[0_1px_0_#544030]'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Needs More checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.needsMore}
                    onChange={(e) => setFormData({ ...formData, needsMore: e.target.checked })}
                    className="w-4 h-4 rounded border-2 border-[#544030] accent-[#E07A5F]"
                  />
                  <span className="text-xs font-bold text-[#544030]">
                    Flag as <strong className="text-[#D64045]">“Need more of this”</strong> (invite others to bring more)
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="switch-btn flex-1 py-2.5 bg-[#FAF7F2] border-2 border-[#544030] text-[#544030] font-black rounded-xl text-sm shadow-[0_2px_0_#544030]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={duplicateMatches.length > 0 && !bypassWarning}
                  className="switch-btn flex-1 py-2.5 bg-[#E07A5F] border-2 border-[#544030] text-white font-black rounded-xl text-sm shadow-[0_3px_0_#544030] disabled:opacity-50"
                >
                  {editingItem ? 'Save Changes' : 'Add to Feast! 🥧'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
