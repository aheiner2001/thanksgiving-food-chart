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

const START_HOUR = 7;   // 7:00 AM
const END_HOUR = 23;    // 11:00 PM
const TOTAL_HOURS = END_HOUR - START_HOUR;
const DESKTOP_HOUR_W = 80;
const MOBILE_HOUR_H = 68;
const MIN_DURATION = 0.5;

export const DAYS = [
  { id: "Tue", name: "Tuesday", date: "Nov 24", tag: "Arrivals" },
  { id: "Wed", name: "Wednesday", date: "Nov 25", tag: null },
  { id: "Thu", name: "Thursday", date: "Nov 26", tag: "Thanksgiving 🦃", isHoliday: true },
  { id: "Fri", name: "Friday", date: "Nov 27", tag: "Games & Relax" },
  { id: "Sat", name: "Saturday", date: "Nov 28", tag: "Outings" },
  { id: "Sun", name: "Sunday", date: "Nov 29", tag: "Departures" }
];

export const INITIAL_DEFAULT_EVENTS = [
  // Tuesday
  { id: "e1", day: "Tue", start: 14, duration: 3, title: "House 1 Arrivals & Settle In", group: "house-1", location: "House 1" },
  { id: "e2", day: "Tue", start: 16, duration: 2.5, title: "House 2 Arrivals & Unpack", group: "house-2", location: "House 2" },
  { id: "e3", day: "Tue", start: 18.5, duration: 2, title: "Welcome Dinner & Pizza", group: "meal", location: "House 1" },

  // Wednesday
  { id: "e4", day: "Wed", start: 8.5, duration: 1.5, title: "Breakfast & Coffee", group: "meal", location: "Both Houses" },
  { id: "e5", day: "Wed", start: 10.5, duration: 2, title: "Thanksgiving Pie & Sides Prep", group: "both-houses", location: "House 1 Kitchen" },
  { id: "e6", day: "Wed", start: 12.5, duration: 1.5, title: "Lunch Sandwiches", group: "meal", location: "House 2" },
  { id: "e7", day: "Wed", start: 14.5, duration: 2, title: "Afternoon Walk & Nap Time 😴", group: "both-houses", location: "Beds / Couches" },
  { id: "e8", day: "Wed", start: 18, duration: 2, title: "Family Dinner & Games", group: "meal", location: "House 1" },

  // Thursday (Thanksgiving)
  { id: "e9", day: "Thu", start: 8, duration: 1.5, title: "Light Breakfast & Coffee", group: "meal", location: "Both Houses" },
  { id: "e10", day: "Thu", start: 9.5, duration: 3, title: "Parade Watching & Turkey Prep", group: "both-houses", location: "House 1" },
  { id: "e11", day: "Thu", start: 14, duration: 3, title: "🦃 Thanksgiving Feast (Early Dinner)", group: "meal", location: "House 1 Dining Area" },
  { id: "e12", day: "Thu", start: 17.5, duration: 2, title: "Turkey Coma & Nap Time 😴", group: "both-houses", location: "Quiet Rooms" },
  { id: "e13", day: "Thu", start: 20, duration: 2, title: "Pie Buffet & Card Games", group: "meal", location: "House 2 Living Room" },

  // Friday
  { id: "e14", day: "Fri", start: 8.5, duration: 1.5, title: "Breakfast & Leftovers", group: "meal", location: "Both Houses" },
  { id: "e15", day: "Fri", start: 10.5, duration: 3, title: "Group Outing / Scenic Nature Walk", group: "both-houses", location: "Park Trail" },
  { id: "e16", day: "Fri", start: 13.5, duration: 1.5, title: "Lunch / Food Run", group: "meal", location: "Downtown" },
  { id: "e17", day: "Fri", start: 15.5, duration: 2, title: "Yard Games & Downtime", group: "house-2", location: "House 2 Lawn" },
  { id: "e18", day: "Fri", start: 18, duration: 2.5, title: "Dinner & Movie Night", group: "meal", location: "House 1" },

  // Saturday
  { id: "e19", day: "Sat", start: 8.5, duration: 1.5, title: "Breakfast", group: "meal", location: "Both Houses" },
  { id: "e20", day: "Sat", start: 11, duration: 3, title: "Downtown Stroll & Coffee", group: "both-houses", location: "Main Street" },
  { id: "e21", day: "Sat", start: 14.5, duration: 2, title: "Nap & Recharge", group: "both-houses", location: "Each House" },
  { id: "e22", day: "Sat", start: 17.5, duration: 3, title: "Final Night Celebration Dinner", group: "meal", location: "House 1" },

  // Sunday
  { id: "e23", day: "Sun", start: 8, duration: 2, title: "Farewell Breakfast & Packing", group: "meal", location: "House 1" },
  { id: "e24", day: "Sun", start: 10.5, duration: 2.5, title: "Departures & Goodbyes", group: "both-houses", location: "Both Houses" }
];

export function formatTime(decimalHour) {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  const ampm = hours >= 12 && hours < 24 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${displayHour}:${displayMinutes} ${ampm}`;
}

export default function CalendarModal({ isOpen, onClose, initialItemToAdd, onClearInitialItem }) {
  const [events, setEvents] = useState([]);
  const [activeDayIndex, setActiveDayIndex] = useState(2); // Thursday by default
  const [loading, setLoading] = useState(true);

  // Edit/Add Submodal
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [formDay, setFormDay] = useState('Thu');
  const [formTitle, setFormTitle] = useState('');
  const [formStart, setFormStart] = useState(14);
  const [formDuration, setFormDuration] = useState(2);
  const [formGroup, setFormGroup] = useState('both-houses');
  const [formLocation, setFormLocation] = useState('');

  // Drag-to-create state (Desktop and Mobile track dragging)
  const [dragCreation, setDragCreation] = useState(null);
  // { day: 'Thu', start: 14, currentEnd: 15.5, isVertical: false }

  // Sync with Firestore collection `calendar_events`
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'calendar_events')), (snapshot) => {
      const evList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(evList);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // When opened with an item from "Add to Calendar", prefill the form
  useEffect(() => {
    if (initialItemToAdd && isOpen) {
      setEditingEventId(null);
      setFormTitle(initialItemToAdd.name || '');
      setFormDay('Thu');
      setFormStart(15);
      setFormDuration(2);
      setFormGroup('both-houses');
      setFormLocation(initialItemToAdd.broughtBy ? `Lead: ${initialItemToAdd.broughtBy}` : '');
      setIsEventFormOpen(true);
      if (onClearInitialItem) onClearInitialItem();
    }
  }, [initialItemToAdd, isOpen]);

  if (!isOpen) return null;

  const currentDay = DAYS[activeDayIndex];

  const handleOpenAddEvent = (dayId = currentDay.id, defaultStart = 12, defaultDuration = 1) => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDay(dayId);
    setFormStart(defaultStart);
    setFormDuration(defaultDuration);
    setFormGroup('both-houses');
    setFormLocation('');
    setIsEventFormOpen(true);
  };

  const handleOpenEditEvent = (evt, e) => {
    if (e) e.stopPropagation();
    setEditingEventId(evt.id);
    setFormTitle(evt.title);
    setFormDay(evt.day);
    setFormStart(evt.start);
    setFormDuration(evt.duration);
    setFormGroup(evt.group || 'both-houses');
    setFormLocation(evt.location || '');
    setIsEventFormOpen(true);
  };

  const handleDeleteEvent = async (evtId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm("Remove this event from the family schedule?")) {
      try {
        await deleteDoc(doc(db, 'calendar_events', evtId));
      } catch (err) {
        alert("Failed to delete event: " + err.message);
      }
    }
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: formTitle.trim(),
        day: formDay,
        start: Number(formStart),
        duration: Number(formDuration),
        group: formGroup,
        location: formLocation.trim(),
        updatedAt: serverTimestamp()
      };

      if (editingEventId) {
        await updateDoc(doc(db, 'calendar_events', editingEventId), payload);
      } else {
        await addDoc(collection(db, 'calendar_events'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      const dayIdx = DAYS.findIndex(d => d.id === formDay);
      if (dayIdx !== -1) setActiveDayIndex(dayIdx);
      setIsEventFormOpen(false);
    } catch (err) {
      alert("Error saving event: " + err.message);
    }
  };

  // Click & Drag to create an event on desktop horizontal track
  const handleDesktopTrackPointerDown = (dayId, trackEl, e) => {
    // Ignore if clicked on an event card or child element of an event card
    if (e.target.closest('[id^="d-card-"]')) return;
    if (e.button !== 0) return; // Only left click

    const trackRect = trackEl.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const rawHour = START_HOUR + clickX / DESKTOP_HOUR_W;
    const initialStart = Math.min(Math.max(Math.floor(rawHour * 2) / 2, START_HOUR), END_HOUR - 0.5);

    let currentEnd = initialStart + 0.5;
    let didDrag = false;

    setDragCreation({
      day: dayId,
      start: initialStart,
      end: currentEnd,
      isVertical: false
    });

    const onPointerMove = (me) => {
      const moveX = me.clientX - trackRect.left;
      if (Math.abs(me.clientX - e.clientX) > 6) {
        didDrag = true;
      }
      const moveHour = START_HOUR + moveX / DESKTOP_HOUR_W;
      const snappedEnd = Math.round(moveHour * 4) / 4;
      currentEnd = Math.min(Math.max(snappedEnd, initialStart + 0.5), END_HOUR);

      setDragCreation({
        day: dayId,
        start: initialStart,
        end: currentEnd,
        isVertical: false
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setDragCreation(null);

      const duration = didDrag ? Math.max(Math.round((currentEnd - initialStart) * 4) / 4, 0.5) : 1;
      handleOpenAddEvent(dayId, initialStart, duration);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Click & Drag to create an event on mobile vertical track
  const handleMobileTrackPointerDown = (dayId, trackEl, e) => {
    if (e.target.closest('[id^="m-card-"]')) return;
    if (e.button !== 0) return;

    const trackRect = trackEl.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const rawHour = START_HOUR + clickY / MOBILE_HOUR_H;
    const initialStart = Math.min(Math.max(Math.floor(rawHour * 2) / 2, START_HOUR), END_HOUR - 0.5);

    let currentEnd = initialStart + 0.5;
    let didDrag = false;

    setDragCreation({
      day: dayId,
      start: initialStart,
      end: currentEnd,
      isVertical: true
    });

    const onPointerMove = (me) => {
      const moveY = me.clientY - trackRect.top;
      if (Math.abs(me.clientY - e.clientY) > 6) {
        didDrag = true;
      }
      const moveHour = START_HOUR + moveY / MOBILE_HOUR_H;
      const snappedEnd = Math.round(moveHour * 4) / 4;
      currentEnd = Math.min(Math.max(snappedEnd, initialStart + 0.5), END_HOUR);

      setDragCreation({
        day: dayId,
        start: initialStart,
        end: currentEnd,
        isVertical: true
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setDragCreation(null);

      const duration = didDrag ? Math.max(Math.round((currentEnd - initialStart) * 4) / 4, 0.5) : 1;
      handleOpenAddEvent(dayId, initialStart, duration);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Clear all itinerary events
  const handleClearSchedule = async () => {
    if (events.length === 0) return;
    if (window.confirm("Clear all events from the calendar schedule?")) {
      try {
        for (const evt of events) {
          await deleteDoc(doc(db, 'calendar_events', evt.id));
        }
      } catch (err) {
        alert("Error clearing schedule: " + err.message);
      }
    }
  };

  // Drag interaction handlers
  const startDragHorizontal = (evt, cardEl, e) => {
    if (e.target.closest('button') || e.target.closest('.horiz-resize-handle')) return;
    const startX = e.clientX;
    const initialLeft = parseFloat(cardEl.style.left) || 0;

    const onPointerMove = (me) => {
      const deltaX = me.clientX - startX;
      let newLeft = initialLeft + deltaX;
      const maxLeft = (TOTAL_HOURS - evt.duration) * DESKTOP_HOUR_W;
      if (newLeft < 0) newLeft = 0;
      if (newLeft > maxLeft) newLeft = maxLeft;
      cardEl.style.left = `${newLeft}px`;
    };

    const onPointerUp = async (ue) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalLeft = parseFloat(cardEl.style.left);
      const snappedStart = Math.round((START_HOUR + finalLeft / DESKTOP_HOUR_W) * 4) / 4;
      const boundedStart = Math.min(Math.max(snappedStart, START_HOUR), END_HOUR - evt.duration);

      if (boundedStart !== evt.start) {
        await updateDoc(doc(db, 'calendar_events', evt.id), {
          start: boundedStart,
          updatedAt: serverTimestamp()
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const startResizeHorizontal = (evt, side, cardEl, e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialLeft = parseFloat(cardEl.style.left) || 0;
    const initialWidth = parseFloat(cardEl.style.width) || 0;

    const onPointerMove = (me) => {
      const deltaX = me.clientX - startX;
      let newLeft = initialLeft;
      let newWidth = initialWidth;

      if (side === 'left') {
        newLeft = initialLeft + deltaX;
        newWidth = initialWidth - deltaX;
        if (newWidth < MIN_DURATION * DESKTOP_HOUR_W) {
          newWidth = MIN_DURATION * DESKTOP_HOUR_W;
          newLeft = initialLeft + initialWidth - newWidth;
        }
        if (newLeft < 0) {
          newWidth += newLeft;
          newLeft = 0;
        }
      } else {
        newWidth = initialWidth + deltaX;
        if (newWidth < MIN_DURATION * DESKTOP_HOUR_W) {
          newWidth = MIN_DURATION * DESKTOP_HOUR_W;
        }
        const maxRight = TOTAL_HOURS * DESKTOP_HOUR_W;
        if (initialLeft + newWidth > maxRight) {
          newWidth = maxRight - initialLeft;
        }
      }

      cardEl.style.left = `${newLeft}px`;
      cardEl.style.width = `${newWidth}px`;
    };

    const onPointerUp = async () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalLeft = parseFloat(cardEl.style.left);
      const finalWidth = parseFloat(cardEl.style.width);
      let snappedStart = Math.round((START_HOUR + finalLeft / DESKTOP_HOUR_W) * 4) / 4;
      let snappedDuration = Math.round((finalWidth / DESKTOP_HOUR_W) * 4) / 4;

      if (snappedDuration < MIN_DURATION) snappedDuration = MIN_DURATION;
      if (snappedStart < START_HOUR) snappedStart = START_HOUR;
      if (snappedStart + snappedDuration > END_HOUR) {
        snappedDuration = END_HOUR - snappedStart;
      }

      await updateDoc(doc(db, 'calendar_events', evt.id), {
        start: snappedStart,
        duration: snappedDuration,
        updatedAt: serverTimestamp()
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Vertical Mobile Drag
  const startDragVertical = (evt, cardEl, e) => {
    if (e.target.closest('button') || e.target.closest('.vert-resize-handle')) return;
    const startY = e.clientY;
    const initialTop = parseFloat(cardEl.style.top) || 0;

    const onPointerMove = (me) => {
      const deltaY = me.clientY - startY;
      let newTop = initialTop + deltaY;
      const maxTop = (TOTAL_HOURS - evt.duration) * MOBILE_HOUR_H;
      if (newTop < 0) newTop = 0;
      if (newTop > maxTop) newTop = maxTop;
      cardEl.style.top = `${newTop}px`;
    };

    const onPointerUp = async () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalTop = parseFloat(cardEl.style.top);
      const snappedStart = Math.round((START_HOUR + finalTop / MOBILE_HOUR_H) * 4) / 4;
      const boundedStart = Math.min(Math.max(snappedStart, START_HOUR), END_HOUR - evt.duration);

      if (boundedStart !== evt.start) {
        await updateDoc(doc(db, 'calendar_events', evt.id), {
          start: boundedStart,
          updatedAt: serverTimestamp()
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const startResizeVertical = (evt, side, cardEl, e) => {
    e.stopPropagation();
    const startY = e.clientY;
    const initialTop = parseFloat(cardEl.style.top) || 0;
    const initialHeight = parseFloat(cardEl.style.height) || 0;

    const onPointerMove = (me) => {
      const deltaY = me.clientY - startY;
      let newTop = initialTop;
      let newHeight = initialHeight;

      if (side === 'top') {
        newTop = initialTop + deltaY;
        newHeight = initialHeight - deltaY;
        if (newHeight < MIN_DURATION * MOBILE_HOUR_H) {
          newHeight = MIN_DURATION * MOBILE_HOUR_H;
          newTop = initialTop + initialHeight - newHeight;
        }
        if (newTop < 0) {
          newHeight += newTop;
          newTop = 0;
        }
      } else {
        newHeight = initialHeight + deltaY;
        if (newHeight < MIN_DURATION * MOBILE_HOUR_H) {
          newHeight = MIN_DURATION * MOBILE_HOUR_H;
        }
        const maxBottom = TOTAL_HOURS * MOBILE_HOUR_H;
        if (initialTop + newHeight > maxBottom) {
          newHeight = maxBottom - initialTop;
        }
      }

      cardEl.style.top = `${newTop}px`;
      cardEl.style.height = `${newHeight}px`;
    };

    const onPointerUp = async () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalTop = parseFloat(cardEl.style.top);
      const finalHeight = parseFloat(cardEl.style.height);
      let snappedStart = Math.round((START_HOUR + finalTop / MOBILE_HOUR_H) * 4) / 4;
      let snappedDuration = Math.round((finalHeight / MOBILE_HOUR_H) * 4) / 4;

      if (snappedDuration < MIN_DURATION) snappedDuration = MIN_DURATION;
      if (snappedStart < START_HOUR) snappedStart = START_HOUR;
      if (snappedStart + snappedDuration > END_HOUR) {
        snappedDuration = END_HOUR - snappedStart;
      }

      await updateDoc(doc(db, 'calendar_events', evt.id), {
        start: snappedStart,
        duration: snappedDuration,
        updatedAt: serverTimestamp()
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const getGroupColorClass = (group) => {
    switch(group) {
      case 'house-1': return 'border-l-4 border-l-blue-600 bg-blue-50/90 text-blue-950';
      case 'house-2': return 'border-l-4 border-l-emerald-600 bg-emerald-50/90 text-emerald-950';
      case 'meal': return 'border-l-4 border-l-amber-700 bg-amber-50/90 text-amber-950';
      default: return 'border-l-4 border-l-amber-500 bg-orange-50/80 text-gray-900';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-[#faf7f2] border border-amber-900/20 rounded-2xl w-full max-w-[1450px] max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-white/95 px-4 sm:px-6 py-3.5 border-b border-amber-900/10 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl sm:text-3xl">📅</span>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                Thanksgiving Week 2026 Itinerary
              </h2>
              <p className="text-xs text-amber-900/70 font-medium hidden sm:block">
                Nov 24 – Nov 29, 2026 • Click anywhere to add, or click &amp; drag across time to set length
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <button
                onClick={handleClearSchedule}
                className="px-2.5 sm:px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-700 text-xs font-bold rounded-lg transition"
                title="Clear all events from schedule"
              >
                🗑 Clear All
              </button>
            )}
            <button
              onClick={() => handleOpenAddEvent()}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1"
            >
              <span>+</span>
              <span>Add Event</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          
          {/* MOBILE ONLY: Single-Day Pill Switcher & Arrows */}
          <div className="md:hidden flex items-center justify-between bg-white border border-amber-900/10 rounded-xl p-1 mb-2.5 shadow-xs">
            <button
              onClick={() => setActiveDayIndex(prev => Math.max(0, prev - 1))}
              disabled={activeDayIndex === 0}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 text-gray-700 font-bold disabled:opacity-30"
            >
              ‹
            </button>
            <div className="flex gap-1 overflow-x-auto py-0.5">
              {DAYS.map((d, idx) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDayIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition flex flex-col items-center ${
                    idx === activeDayIndex
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-amber-50'
                  }`}
                >
                  <span>{d.id} {d.isHoliday ? '🦃' : ''}</span>
                  <span className="text-[10px] opacity-80 font-normal">{d.date}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveDayIndex(prev => Math.min(DAYS.length - 1, prev + 1))}
              disabled={activeDayIndex === DAYS.length - 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 text-gray-700 font-bold disabled:opacity-30"
            >
              ›
            </button>
          </div>

          {/* MOBILE ONLY: Vertical Single-Day Flow */}
          <div className="md:hidden bg-white border border-amber-900/15 rounded-xl overflow-hidden shadow-xs relative">
            <div className="bg-amber-50/70 border-b border-amber-900/10 px-3 py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-gray-900">{currentDay.name}, {currentDay.date}</span>
                {currentDay.tag && <span className="text-xs text-amber-800 ml-1.5 font-medium">• {currentDay.tag}</span>}
              </div>
              {currentDay.isHoliday && (
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase">
                  Thanksgiving Day 🦃
                </span>
              )}
            </div>

            <div className="relative flex" style={{ height: `${TOTAL_HOURS * MOBILE_HOUR_H}px` }}>
              {/* Left Hour Markers */}
              <div className="w-16 border-r border-amber-900/10 bg-[#faf6f0] flex-shrink-0 relative">
                {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                  const hourVal = START_HOUR + i;
                  return (
                    <div
                      key={hourVal}
                      style={{ top: `${i * MOBILE_HOUR_H}px`, height: `${MOBILE_HOUR_H}px` }}
                      className="absolute left-0 right-0 p-1 text-[11px] font-bold text-amber-900/60 border-b border-dashed border-amber-900/10 text-right pr-2 select-none"
                    >
                      {formatTime(hourVal)}
                    </div>
                  );
                })}
              </div>

              {/* Vertical Events Track */}
              <div 
                id={`m-track-${currentDay.id}`}
                onPointerDown={(e) => handleMobileTrackPointerDown(currentDay.id, document.getElementById(`m-track-${currentDay.id}`), e)}
                className="flex-1 relative cursor-crosshair"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${MOBILE_HOUR_H - 1}px, #e8dfd5 ${MOBILE_HOUR_H - 1}px, #e8dfd5 ${MOBILE_HOUR_H}px)`
                }}
              >
                {/* Active creation ghost overlay */}
                {dragCreation && dragCreation.isVertical && dragCreation.day === currentDay.id && (
                  <div
                    style={{
                      top: `${(dragCreation.start - START_HOUR) * MOBILE_HOUR_H}px`,
                      height: `${Math.max((dragCreation.end - dragCreation.start) * MOBILE_HOUR_H, 24)}px`
                    }}
                    className="absolute left-2 right-2 rounded-xl border-2 border-dashed border-amber-600 bg-amber-200/50 z-20 pointer-events-none flex items-center justify-center p-2 text-xs font-bold text-amber-900"
                  >
                    + New Event ({formatTime(dragCreation.start)} - {formatTime(dragCreation.end)})
                  </div>
                )}
                {events
                  .filter(e => e.day === currentDay.id)
                  .map(evt => {
                    const top = (evt.start - START_HOUR) * MOBILE_HOUR_H;
                    const height = Math.max(evt.duration * MOBILE_HOUR_H, 40);

                    return (
                      <div
                        key={evt.id}
                        id={`m-card-${evt.id}`}
                        onPointerDown={(e) => startDragVertical(evt, document.getElementById(`m-card-${evt.id}`), e)}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        className={`absolute left-2 right-2 rounded-xl shadow-xs border p-2 flex flex-col justify-between cursor-grab active:cursor-grabbing select-none group touch-none ${getGroupColorClass(evt.group)}`}
                      >
                        {/* Top Resize Handle */}
                        <div
                          className="vert-resize-handle absolute top-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onPointerDown={(e) => startResizeVertical(evt, 'top', document.getElementById(`m-card-${evt.id}`), e)}
                        >
                          <div className="w-8 h-1 bg-black/20 rounded-full" />
                        </div>

                        {/* Card Content */}
                        <div className="flex items-start justify-between gap-1 pointer-events-none mt-1">
                          <span className="text-[11px] font-bold text-amber-900 whitespace-nowrap">
                            {formatTime(evt.start)} - {formatTime(evt.start + evt.duration)}
                          </span>
                          <div className="flex items-center gap-1.5 pointer-events-auto">
                            <button
                              onClick={(e) => handleOpenEditEvent(evt, e)}
                              className="text-gray-400 hover:text-gray-900 text-xs"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => handleDeleteEvent(evt.id, e)}
                              className="text-gray-400 hover:text-red-600 text-xs"
                              title="Delete"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div className="pointer-events-none">
                          <div className="font-bold text-xs leading-snug line-clamp-1">{evt.title}</div>
                          {evt.location && <div className="text-[11px] opacity-75 line-clamp-1">📍 {evt.location}</div>}
                        </div>

                        {/* Bottom Resize Handle */}
                        <div
                          className="vert-resize-handle absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onPointerDown={(e) => startResizeVertical(evt, 'bottom', document.getElementById(`m-card-${evt.id}`), e)}
                        >
                          <div className="w-8 h-1 bg-black/20 rounded-full" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* DESKTOP ONLY: Full Horizontal Multi-Day Timeline View */}
          <div className="hidden md:block bg-white border border-amber-900/15 rounded-xl shadow-xs overflow-x-auto">
            <div className="min-w-[1400px] flex flex-col">
              
              {/* Header Row with Hours */}
              <div className="flex border-b-2 border-amber-900/15 bg-[#faf6f0] sticky top-0 z-20">
                <div className="w-40 min-w-40 max-w-40 p-2.5 font-bold text-xs text-amber-900/70 uppercase tracking-wider border-r border-amber-900/10 bg-[#faf6f0] sticky left-0 z-25">
                  Day &amp; Date
                </div>
                <div className="flex flex-grow">
                  {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                    <div
                      key={i}
                      style={{ width: `${DESKTOP_HOUR_W}px`, minWidth: `${DESKTOP_HOUR_W}px` }}
                      className="p-2 text-[11px] font-bold text-amber-900/70 border-r border-dashed border-amber-900/10 select-none"
                    >
                      {formatTime(START_HOUR + i)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day Rows */}
              {DAYS.map(day => {
                const dayEvents = events.filter(e => e.day === day.id);

                return (
                  <div
                    key={day.id}
                    className={`flex border-b border-amber-900/10 min-h-[96px] ${day.isHoliday ? 'bg-amber-50/30' : ''}`}
                  >
                    {/* Left Sticky Day Info */}
                    <div className={`w-40 min-w-40 max-w-40 p-3 border-r border-amber-900/10 sticky left-0 z-10 flex flex-col justify-center ${day.isHoliday ? 'bg-[#fffaf0]' : 'bg-white'}`}>
                      <div className="font-bold text-sm text-gray-900">{day.name}</div>
                      <div className="text-xs text-gray-500">{day.date}</div>
                      {day.tag && (
                        <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded self-start ${day.isHoliday ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}>
                          {day.tag}
                        </span>
                      )}
                    </div>

                    {/* Track */}
                    <div
                      id={`d-track-${day.id}`}
                      onPointerDown={(e) => handleDesktopTrackPointerDown(day.id, document.getElementById(`d-track-${day.id}`), e)}
                      className="flex-grow relative h-full min-h-[96px] cursor-crosshair"
                      style={{
                        width: `${TOTAL_HOURS * DESKTOP_HOUR_W}px`,
                        backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${DESKTOP_HOUR_W - 1}px, #e8dfd5 ${DESKTOP_HOUR_W - 1}px, #e8dfd5 ${DESKTOP_HOUR_W}px)`
                      }}
                    >
                      {/* Active creation ghost overlay */}
                      {dragCreation && !dragCreation.isVertical && dragCreation.day === day.id && (
                        <div
                          style={{
                            left: `${(dragCreation.start - START_HOUR) * DESKTOP_HOUR_W}px`,
                            width: `${Math.max((dragCreation.end - dragCreation.start) * DESKTOP_HOUR_W, 30)}px`
                          }}
                          className="absolute top-2.5 h-[76px] rounded-xl border-2 border-dashed border-amber-600 bg-amber-200/50 z-20 pointer-events-none flex items-center justify-center p-1 text-xs font-bold text-amber-900 text-center"
                        >
                          + New ({formatTime(dragCreation.start)} - {formatTime(dragCreation.end)})
                        </div>
                      )}
                      {dayEvents.map(evt => {
                        const left = (evt.start - START_HOUR) * DESKTOP_HOUR_W;
                        const width = Math.max(evt.duration * DESKTOP_HOUR_W, 40);

                        return (
                          <div
                            key={evt.id}
                            id={`d-card-${evt.id}`}
                            onPointerDown={(e) => startDragHorizontal(evt, document.getElementById(`d-card-${evt.id}`), e)}
                            style={{ left: `${left}px`, width: `${width}px` }}
                            className={`absolute top-2.5 h-[76px] rounded-xl shadow-xs border p-2 flex flex-col justify-between cursor-grab active:cursor-grabbing select-none group touch-none ${getGroupColorClass(evt.group)}`}
                          >
                            {/* Left Handle */}
                            <div
                              className="horiz-resize-handle absolute top-0 bottom-0 left-0 w-3 cursor-ew-resize flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onPointerDown={(e) => startResizeHorizontal(evt, 'left', document.getElementById(`d-card-${evt.id}`), e)}
                            >
                              <div className="w-1 h-6 bg-amber-700/60 rounded-full" />
                            </div>

                            {/* Card Body */}
                            <div className="flex items-start justify-between gap-1 pointer-events-none px-1">
                              <span className="text-[11px] font-bold text-amber-900 whitespace-nowrap">
                                {formatTime(evt.start)} - {formatTime(evt.start + evt.duration)}
                              </span>
                              <div className="flex items-center gap-1 pointer-events-auto">
                                <button
                                  onClick={(e) => handleOpenEditEvent(evt, e)}
                                  className="text-gray-400 hover:text-gray-900 text-xs p-0.5"
                                  title="Edit"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => handleDeleteEvent(evt.id, e)}
                                  className="text-gray-400 hover:text-red-600 text-xs p-0.5"
                                  title="Delete"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            <div className="px-1 pointer-events-none">
                              <div className="font-bold text-xs text-gray-900 truncate" title={evt.title}>
                                {evt.title}
                              </div>
                              {evt.location && (
                                <div className="text-[10px] text-gray-500 truncate" title={evt.location}>
                                  📍 {evt.location}
                                </div>
                              )}
                            </div>

                            {/* Right Handle */}
                            <div
                              className="horiz-resize-handle absolute top-0 bottom-0 right-0 w-3 cursor-ew-resize flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onPointerDown={(e) => startResizeHorizontal(evt, 'right', document.getElementById(`d-card-${evt.id}`), e)}
                            >
                              <div className="w-1 h-6 bg-amber-700/60 rounded-full" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Submodal */}
      {isEventFormOpen && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-100 relative z-[71]">
            <h3 className="font-bold text-base text-gray-900 mb-3">
              {editingEventId ? "Edit Event" : "Add Itinerary Event"}
            </h3>

            <form onSubmit={handleSaveEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Day</label>
                <select
                  value={formDay}
                  onChange={(e) => setFormDay(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  {DAYS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}, {d.date} {d.isHoliday ? '(Thanksgiving 🦃)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Turkey Feast, Board Games, Nap Time"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Start Time</label>
                  <select
                    value={formStart}
                    onChange={(e) => setFormStart(parseFloat(e.target.value))}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium"
                  >
                    {Array.from({ length: (END_HOUR - START_HOUR) * 2 }).map((_, i) => {
                      const val = START_HOUR + i * 0.5;
                      return <option key={val} value={val}>{formatTime(val)}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Duration</label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseFloat(e.target.value))}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium"
                  >
                    <option value="0.5">30 mins</option>
                    <option value="1">1 hour</option>
                    <option value="1.5">1.5 hours</option>
                    <option value="2">2 hours</option>
                    <option value="2.5">2.5 hours</option>
                    <option value="3">3 hours</option>
                    <option value="4">4 hours</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Type / House</label>
                  <select
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value)}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium"
                  >
                    <option value="both-houses">Both Houses</option>
                    <option value="meal">Meal / Feast</option>
                    <option value="house-1">House 1</option>
                    <option value="house-2">House 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Location / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. House 1 Patio"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEventFormOpen(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
