import React, { useState, useEffect } from 'react';
import { fetchEvents, createEventApi, deleteEventApi } from '../../services/api';

function formatTimeTo12Hour(timeStr) {
  if (!timeStr) return '10:00 AM';
  if (/am|pm/i.test(timeStr)) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1].slice(0, 2);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const formattedH = String(h).padStart(2, '0');
  return `${formattedH}:${m} ${ampm}`;
}

export default function Calendar() {
  const today = new Date();

  const [currentView, setCurrentView] = useState('Month');
  // Track current month/year as numbers — start with TODAY
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [slideDir, setSlideDir] = useState(null); // 'left' | 'right'
  const [isAnimating, setIsAnimating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeAmPm, setTimeAmPm] = useState('AM');

  // Default new-event date = today
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: todayISO,
    time: '10:00',
    content: '',
  });

  // Convert 12h display time (HH:MM) + AM/PM -> 24h string for storage
  const to24h = (displayTime, ampm) => {
    const parts = displayTime.split(':');
    let h = parseInt(parts[0], 10) || 10;
    const m = parts[1] ? parts[1].slice(0, 2) : '00';
    if (ampm === 'AM') {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h = h + 12;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
  };

  // Convert 24h string -> { displayTime: 'HH:MM', ampm: 'AM'|'PM' }
  const from24h = (time24) => {
    const parts = time24.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parts[1].slice(0, 2) : '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return { displayTime: `${String(h).padStart(2, '0')}:${m}`, ampm };
  };

  // Events state fetched purely from DB
  const [sidebarEvents, setSidebarEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);
  // Kebab menu + view modal state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);
  // Map of eventId -> setTimeout ID for scheduled notifications
  const scheduledTimers = React.useRef({});

  const addToast = (title, date, time) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, date, time }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Actually fire the notification (called by setTimeout at event time)
  const fireEventNotification = (title, date, time) => {
    // In-app toast
    addToast(title, date, time);

    // Native browser notification
    if (!('Notification' in window)) return;
    const send = () => {
      try {
        new Notification('⏰ Event Starting Now!', {
          body: `${title}\n📆 ${date}   🕐 ${time}`,
          tag: `event-fire-${Date.now()}`,
          requireInteraction: true,
        });
      } catch (_) {}
    };
    if (Notification.permission === 'granted') {
      send();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') send();
      });
    }
  };

  // Schedule a notification to fire at the event's date+time
  // event.date = 'YYYY-MM-DD', event.time = 'YYYY-MM-DD at HH:MM AM/PM'
  const scheduleEventNotification = (event) => {
    // Cancel any existing timer for this event
    if (scheduledTimers.current[event.id]) {
      clearTimeout(scheduledTimers.current[event.id]);
      delete scheduledTimers.current[event.id];
    }

    // Parse event date + time
    // event.date: 'YYYY-MM-DD'
    // event.time: 'YYYY-MM-DD at HH:MM AM/PM'  (stored string)
    // We need the raw date + original 24h time, so store rawTime on the item
    let eventMs = null;
    if (event.date && event.rawTime) {
      // rawTime is HH:MM (24h) set when created
      const dt = new Date(`${event.date}T${event.rawTime}:00`);
      if (!isNaN(dt.getTime())) eventMs = dt.getTime();
    } else if (event.date && event.time) {
      // Fallback: try parsing the stored 'YYYY-MM-DD at HH:MM AM' string
      const match = event.time.match(/(\d{4}-\d{2}-\d{2}) at (.+)/);
      if (match) {
        // Convert 12h to 24h for Date parsing
        const d = match[1];
        const t12 = match[2].trim();
        const tDate = new Date(`${d} ${t12}`);
        if (!isNaN(tDate.getTime())) eventMs = tDate.getTime();
      }
    }

    if (!eventMs) return; // can't parse time
    const delay = eventMs - Date.now();
    if (delay <= 0) return; // event already passed

    const timerId = setTimeout(() => {
      const [datePart, timePart] = (event.time || '').split(' at ');
      fireEventNotification(event.title, datePart || event.date, timePart || '');
      delete scheduledTimers.current[event.id];
    }, delay);

    scheduledTimers.current[event.id] = timerId;
  };

  // Fetch calendar events from DB on mount
  useEffect(() => {
    setIsLoadingEvents(true);
    fetchEvents()
      .then((data) => {
        if (data && Array.isArray(data)) {
          const mapped = data.map((e) => ({ ...e, id: e._id || e.id }));
          setSidebarEvents(mapped);
          // Schedule notifications for all future events
          mapped.forEach((ev) => scheduleEventNotification(ev));
        } else {
          setSidebarEvents([]);
        }
      })
      .catch((err) => console.warn('Could not fetch events:', err))
      .finally(() => setIsLoadingEvents(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // ── Dynamic calendar grid generator ──────────────────────────────
  // Weeks start on Monday (ISO). Returns array of rows, each with 7 day objects.
  const buildCalendarRows = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Day of week for 1st: 0=Sun…6=Sat → convert to Mon-based (0=Mon…6=Sun)
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = (startDow === 0) ? 6 : startDow - 1; // Mon-based

    const days = [];

    // Pad with previous month's days
    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      days.push({ day: prevLast - i, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({ day: d, isCurrentMonth: true });
    }

    // Pad to complete the last row (fill up to multiple of 7)
    let next = 1;
    while (days.length % 7 !== 0) {
      days.push({ day: next++, isCurrentMonth: false });
    }

    // Split into rows of 7
    const rows = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push({ id: `row-${i / 7}`, days: days.slice(i, i + 7) });
    }
    return rows;
  };

  const calendarRows = buildCalendarRows(calYear, calMonth);
  const currentMonthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const animateNav = (dir, fn) => {
    if (isAnimating) return;
    setSlideDir(dir);
    setIsAnimating(true);
    fn();
    setTimeout(() => { setSlideDir(null); setIsAnimating(false); }, 360);
  };

  const handlePrevMonth = () => animateNav('prev', () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else { setCalMonth(m => m - 1); }
    setSelectedDay(null);
  });

  const handleNextMonth = () => animateNav('next', () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else { setCalMonth(m => m + 1); }
    setSelectedDay(null);
  });

  const handleResetToday = () => {
    const now = new Date();
    const isDiff = (calYear !== now.getFullYear() || calMonth !== now.getMonth());
    if (isDiff) {
      const isForward = now.getFullYear() > calYear || (now.getFullYear() === calYear && now.getMonth() > calMonth);
      animateNav(isForward ? 'next' : 'prev', () => {
        setCalYear(now.getFullYear());
        setCalMonth(now.getMonth());
        setSelectedDay(now.getDate());
      });
    } else {
      setSelectedDay(now.getDate());
    }
  };

  const handleAddEventSubmit = (e) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    const formattedTime = formatTimeTo12Hour(newEvent.time);
    const tempId = `ev_${Date.now()}`;
    const addedItem = {
      id: tempId,
      title: newEvent.title.trim(),
      name: newEvent.title.trim(),
      time: `${newEvent.date} at ${formattedTime}`,
      date: newEvent.date,
      rawTime: newEvent.time, // HH:MM 24h — used by scheduler
      content: newEvent.content ? newEvent.content.trim() : '',
      location: newEvent.content ? newEvent.content.trim() : '',
    };

    setSidebarEvents([addedItem, ...sidebarEvents]);
    setNewEvent({ title: '', date: todayISO, time: '10:00', content: '' });
    setTimeAmPm('AM');
    setIsModalOpen(false);

    // Schedule notification to fire at event time (not now)
    scheduleEventNotification(addedItem);

    // Request permission now (triggered by click gesture) so it's ready when timer fires
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Persist to backend DB
    createEventApi(addedItem).then((saved) => {
      if (saved && (saved._id || saved.id)) {
        setSidebarEvents((prev) =>
          prev.map((ev) => (ev.id === tempId ? { ...saved, id: saved._id || saved.id } : ev))
        );
      }
    });
  };

  const handleDeleteEvent = (eventId) => {
    // Cancel any scheduled notification for this event
    if (scheduledTimers.current[eventId]) {
      clearTimeout(scheduledTimers.current[eventId]);
      delete scheduledTimers.current[eventId];
    }
    setSidebarEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    setOpenMenuId(null);
    setViewingEvent(null);
    deleteEventApi(eventId).catch(() => {});
  };

  return (
    <div className="cal-wrapper">
      {/* Self-contained In-File CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .cal-wrapper {
          box-sizing: border-box;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f8fafc;
          min-height: 100vh;
          padding: 40px 24px 110px 24px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          color: #1e293b;
          -webkit-font-smoothing: antialiased;
          text-align: left;
          width: 100%;
          max-width: 100vw;
          overflow-x: hidden;
        }

        .cal-wrapper *,
        .cal-wrapper *::before,
        .cal-wrapper *::after {
          box-sizing: border-box;
        }

        .cal-dashboard-container {
          display: flex;
          flex-direction: row;
          gap: 28px;
          max-width: 1260px;
          width: 100%;
          min-width: 0;
          align-items: stretch;
        }

        /* ---------------- Left Main Calendar Card ---------------- */
        .cal-main-card {
          flex: 1;
          min-width: 0;
          width: 100%;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef0f5;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          padding: 28px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }

        .cal-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 16px;
          width: 100%;
          min-width: 0;
        }

        .cal-top-bar-left {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          min-width: 80px;
        }

        .cal-top-bar-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-width: 80px;
        }

        /* Today pill button with live pulse dot */
        .cal-today-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #334155;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 8px 18px;
          border-radius: 999px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          letter-spacing: 0.01em;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .cal-today-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4c84ff;
          box-shadow: 0 0 6px rgba(76, 132, 255, 0.8);
          transition: background-color 0.2s ease, box-shadow 0.2s ease;
        }

        .cal-today-btn:hover {
          background: #4c84ff;
          border-color: #4c84ff;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(76, 132, 255, 0.32);
          transform: translateY(-1px);
        }

        .cal-today-btn:hover .cal-today-dot {
          background: #ffffff;
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
        }

        .cal-today-btn:active {
          transform: translateY(0);
        }

        /* Month navigation capsule */
        .cal-month-nav {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 999px;
          padding: 5px 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          user-select: none;
        }

        /* Cool interactive arrow buttons */
        .cal-nav-arrow {
          position: relative;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          color: #475569;
          cursor: pointer;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          user-select: none;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .cal-nav-arrow svg {
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Directional nudge on hover */
        .cal-nav-arrow-prev:hover svg {
          transform: translateX(-3px);
        }

        .cal-nav-arrow-next:hover svg {
          transform: translateX(3px);
        }

        .cal-nav-arrow:hover {
          background: linear-gradient(135deg, #4c84ff 0%, #3b71f7 100%);
          border-color: #3b71f7;
          color: #ffffff;
          transform: scale(1.1);
          box-shadow: 0 4px 14px rgba(76, 132, 255, 0.38), 0 0 0 3px rgba(76, 132, 255, 0.15);
        }

        .cal-nav-arrow:active {
          transform: scale(0.9);
          box-shadow: 0 2px 6px rgba(76, 132, 255, 0.3);
        }

        /* Micro-bounce animation when arrow clicked */
        .cal-nav-arrow.arrow-animating {
          animation: arrowClickPop 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes arrowClickPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(0.88); }
          70%  { transform: scale(1.14); }
          100% { transform: scale(1); }
        }

        /* Month and Year title display inside capsule */
        .cal-month-title-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-width: 0;
          padding: 0 8px;
        }

        .cal-month-name {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.3px;
          margin: 0;
          line-height: 1;
        }

        .cal-year-tag {
          font-size: 13px;
          font-weight: 600;
          color: #4c84ff;
          background: #eff6ff;
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #dbeafe;
          letter-spacing: 0.2px;
          line-height: 1.4;
        }

        /* Sliding animations for Month Title */
        .cal-month-title-wrapper.slide-next {
          animation: titleSlideNext 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .cal-month-title-wrapper.slide-prev {
          animation: titleSlidePrev 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes titleSlideNext {
          0% {
            opacity: 0;
            transform: translateX(26px) scale(0.96);
            filter: blur(2px);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes titleSlidePrev {
          0% {
            opacity: 0;
            transform: translateX(-26px) scale(0.96);
            filter: blur(2px);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
            filter: blur(0);
          }
        }

        /* Grid Wrapper & Smooth glide transitions on month change */
        .cal-grid-wrapper {
          position: relative;
          overflow: hidden;
          border-radius: 6px;
        }

        .cal-grid-wrapper.grid-slide-next {
          animation: gridSlideNext 0.34s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .cal-grid-wrapper.grid-slide-prev {
          animation: gridSlidePrev 0.34s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes gridSlideNext {
          0% {
            opacity: 0.35;
            transform: translateX(22px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes gridSlidePrev {
          0% {
            opacity: 0.35;
            transform: translateX(-22px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* View switcher tabs: Day | Week | Month */
        .cal-view-toggle {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 2px;
        }

        .cal-view-btn {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cal-view-btn:hover {
          color: #1e293b;
        }

        .cal-view-btn.active {
          background: #4c84ff;
          color: #ffffff;
          font-weight: 600;
        }

        /* Weekdays header bar */
        .cal-weekdays-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          background: #f3f6fa;
          border-radius: 8px;
          padding: 11px 0;
          margin-bottom: 2px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .cal-weekday-label {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          letter-spacing: 0.6px;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Calendar Grid */
        .cal-grid {
          display: flex;
          flex-direction: column;
          border: 1px solid #edf2f7;
          border-radius: 4px;
          overflow: hidden;
          background: #ffffff;
          width: 100%;
          min-width: 0;
        }

        .cal-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          position: relative;
          min-height: 90px;
          border-bottom: 1px solid #edf2f7;
          width: 100%;
          min-width: 0;
        }

        .cal-row:last-child {
          border-bottom: none;
        }

        .cal-cell {
          position: relative;
          border-right: 1px solid #edf2f7;
          padding: 8px 6px 8px 2px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          transition: background-color 0.15s ease;
          min-width: 0;
          overflow: hidden;
          box-sizing: border-box;
        }

        .cal-cell:last-child {
          border-right: none;
        }

        .cal-cell:hover {
          background-color: #fafbfd;
        }

        /* Inactive cell diagonal striped hatch pattern */
        .cal-cell.inactive {
          background-color: #fbfcfe;
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 6px,
            rgba(215, 227, 245, 0.45) 6px,
            rgba(215, 227, 245, 0.45) 7.5px
          );
        }

        .cal-cell.inactive:hover {
          background-color: #f5f8fd;
        }

        .cal-day-num {
          align-self: flex-end;
          padding-right: 12px;
          padding-top: 2px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          line-height: 1;
        }

        .cal-cell.inactive .cal-day-num {
          color: #b3bdcb;
          font-weight: 500;
        }

        .cal-cell.selected {
          background-color: #f4f8ff;
        }

        /* Event Pills */
        .cal-event-pill {
          align-self: flex-start;
          width: calc(100% - 4px);
          font-size: 10px;
          letter-spacing: -0.15px;
          font-weight: 600;
          padding: 3px 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
          display: block;
          line-height: 1.3;
          border-radius: 0 3px 3px 0;
          margin-bottom: 4px;
        }

        /* Purple event (Design Conference) */
        .cal-event-pill.purple {
          background-color: #ede9fe;
          color: #5542d0;
          border-left: 3.5px solid #6366f1;
        }

        /* Pink event (Weekend Festival) */
        .cal-event-pill.pink {
          background-color: #fce7f3;
          color: #db2777;
          border-left: 3.5px solid #ec4899;
        }

        /* Blue event (Glastonbury / Ultra) */
        .cal-event-pill.blue {
          background-color: #dbeafe;
          color: #2563eb;
          border-left: 3.5px solid #3b82f6;
        }

        /* Spanning multi-day event bar (Glastonbury Festival) */
        .cal-spanning-event {
          position: absolute;
          bottom: 12px;
          height: 25px;
          background-color: #ffeedb;
          border-left: 3.5px solid #f97316;
          color: #ea580c;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10.5px;
          font-weight: 600;
          padding: 0 12px;
          pointer-events: auto;
          z-index: 2;
          border-radius: 0 3px 3px 0;
        }

        /* ---------------- Right Sidebar ---------------- */
        .cal-sidebar-card {
          width: 350px;
          flex-shrink: 0;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef0f5;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          padding: 24px;
          display: flex;
          flex-direction: column;
        }

        /* Add event button */
        .cal-add-btn {
          width: 100%;
          background: #4c84ff;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 13px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .cal-add-btn:hover {
          background: #3b73f0;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(76, 132, 255, 0.3);
        }

        .cal-add-btn:active {
          transform: translateY(0);
        }

        .cal-sidebar-heading {
          font-size: 17px;
          font-weight: 700;
          color: #1e293b;
          margin: 24px 0 18px 0;
        }

        /* Event list item */
        .cal-event-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }

        .cal-event-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          transition: box-shadow 0.15s ease;
          position: relative;
        }

        .cal-event-item:hover {
          box-shadow: 0 2px 10px rgba(76,132,255,0.08);
        }

        .cal-event-meta {
          margin-top: 5px;
        }

        .cal-event-date-badge {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }

        /* Kebab (3-dot) menu */
        .cal-kebab-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          padding: 4px 6px;
          border-radius: 6px;
          line-height: 1;
          flex-shrink: 0;
          margin-left: auto;
          font-size: 18px;
          letter-spacing: 1px;
          transition: background 0.15s ease, color 0.15s ease;
          align-self: flex-start;
        }

        .cal-kebab-btn:hover {
          background: #f1f5f9;
          color: #475569;
        }

        .cal-kebab-dropdown {
          position: absolute;
          top: 0;
          right: 0;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          z-index: 999;
          min-width: 130px;
          overflow: hidden;
          animation: kebab-in 0.15s ease both;
        }

        @keyframes kebab-in {
          from { opacity: 0; transform: scale(0.92) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .cal-kebab-option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          border: none;
          background: none;
          cursor: pointer;
          color: #1e293b;
          transition: background 0.12s ease;
          text-align: left;
        }

        .cal-kebab-option:hover {
          background: #f8fafc;
        }

        .cal-kebab-option.delete {
          color: #ef4444;
        }

        .cal-kebab-option.delete:hover {
          background: #fef2f2;
        }

        .cal-kebab-divider {
          height: 1px;
          background: #f1f5f9;
          margin: 0;
        }

        /* View event modal */
        .cal-view-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.45);
          backdrop-filter: blur(4px);
          z-index: 9000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .cal-view-card {
          background: #ffffff;
          border-radius: 18px;
          padding: 28px 26px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.18);
          animation: modal-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .cal-view-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .cal-view-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .cal-view-close {
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          cursor: pointer;
          color: #64748b;
          line-height: 1;
        }

        .cal-view-thumb {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 12px;
          margin-bottom: 18px;
          background: #f1f5f9;
        }

        .cal-view-field {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 14px;
        }

        .cal-view-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #94a3b8;
        }

        .cal-view-value {
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          line-height: 1.5;
        }

        .cal-view-delete-btn {
          width: 100%;
          margin-top: 18px;
          padding: 10px;
          background: #fef2f2;
          color: #ef4444;
          border: 1px solid #fecaca;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .cal-view-delete-btn:hover {
          background: #fee2e2;
        }

        .cal-event-thumb {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          background-color: #f1f5f9;
        }

        .cal-event-details {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .cal-event-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
          line-height: 1.3;
        }

        .cal-event-time {
          font-size: 12px;
          color: #8c9ba5;
          margin: 3px 0 2px 0;
          font-weight: 500;
        }

        .cal-event-location {
          font-size: 12px;
          color: #8c9ba5;
          line-height: 1.35;
          white-space: pre-line;
          margin: 0 0 6px 0;
        }

        /* Attendees row */
        .cal-attendees-row {
          display: flex;
          align-items: center;
          margin-top: 1px;
        }

        .cal-avatar-group {
          display: flex;
          align-items: center;
        }

        .cal-attendee-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          margin-left: -6px;
          object-fit: cover;
          background-color: #e2e8f0;
        }

        .cal-attendee-avatar:first-child {
          margin-left: 0;
        }

        .cal-attendee-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 20px;
          padding: 0 5px;
          border-radius: 10px;
          border: 1px solid #93c5fd;
          color: #3b82f6;
          font-size: 10.5px;
          font-weight: 500;
          margin-left: 5px;
          background: #ffffff;
        }

        /* See More button */
        .cal-see-more-btn {
          margin-top: 18px;
          width: 100%;
          max-width: 120px;
          align-self: center;
          background: #eef3f9;
          color: #475569;
          border: none;
          border-radius: 8px;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .cal-see-more-btn:hover {
          background: #e2e9f3;
          color: #1e293b;
        }

        /* Modal styling for + Add New Event */
        .cal-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }

        .cal-modal-card {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 420px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        .cal-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .cal-modal-title {
          font-size: 17px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .cal-modal-close {
          background: none;
          border: none;
          font-size: 22px;
          color: #64748b;
          cursor: pointer;
          padding: 2px;
          line-height: 1;
        }

        .cal-form-group {
          margin-bottom: 14px;
        }

        .cal-form-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 5px;
        }

        .cal-form-input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          outline: none;
        }

        .cal-form-input:focus {
          border-color: #4c84ff;
          box-shadow: 0 0 0 2px rgba(76, 132, 255, 0.15);
        }

        .cal-time-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .cal-time-row .cal-form-input {
          flex: 1;
        }

        .cal-ampm-toggle {
          display: flex;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .cal-ampm-btn {
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          background: #f8fafc;
          color: #64748b;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          line-height: 1;
        }

        .cal-ampm-btn:first-child {
          border-right: 1px solid #cbd5e1;
        }

        .cal-ampm-btn.active {
          background: #4c84ff;
          color: #ffffff;
          font-weight: 600;
        }

        .cal-ampm-btn:not(.active):hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .cal-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        /* ── Toast Notifications ── */
        .cal-toast-container {
          position: fixed;
          bottom: 90px;
          right: 20px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }

        .cal-toast {
          background: #1e293b;
          color: #ffffff;
          border-radius: 12px;
          padding: 14px 18px;
          min-width: 270px;
          max-width: 320px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.22);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          animation: cal-toast-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
          pointer-events: all;
        }

        .cal-toast-exit {
          animation: cal-toast-out 0.3s ease forwards;
        }

        @keyframes cal-toast-in {
          from { opacity: 0; transform: translateX(60px) scale(0.92); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }

        @keyframes cal-toast-out {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(60px) scale(0.92); }
        }

        .cal-toast-icon {
          font-size: 22px;
          line-height: 1;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .cal-toast-body {
          flex: 1;
        }

        .cal-toast-heading {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 3px;
        }

        .cal-toast-title {
          font-size: 14px;
          font-weight: 600;
          color: #7dd3fc;
          margin-bottom: 4px;
        }

        .cal-toast-meta {
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cal-btn-cancel {
          background: #f1f5f9;
          color: #475569;
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .cal-btn-submit {
          background: #4c84ff;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        /* ── Responsive Breakpoints ── */

        /* Tablet (≤1080px): sidebar moves below calendar */
        @media (max-width: 1080px) {
          .cal-dashboard-container {
            flex-direction: column;
            gap: 24px;
          }
          .cal-sidebar-card {
            width: 100%;
          }
        }

        /* Large Mobile (≤768px) */
        @media (max-width: 768px) {
          .cal-wrapper {
            padding: 18px 12px 100px 12px;
          }
          .cal-main-card {
            padding: 16px 12px;
            border-radius: 16px;
            min-width: 0;
          }
          .cal-sidebar-card {
            padding: 18px 14px;
            border-radius: 16px;
            width: 100%;
            min-width: 0;
          }
          .cal-top-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            margin-bottom: 16px;
          }
          .cal-top-bar-left {
            order: 1;
            display: flex;
            justify-content: flex-end;
            width: 100%;
            min-width: 0;
          }
          .cal-top-bar-right {
            display: none;
          }
          .cal-month-nav {
            order: 2;
            width: 100%;
            max-width: 100%;
            display: flex;
            justify-content: space-between;
            padding: 6px 10px;
            box-sizing: border-box;
          }
          .cal-month-title-wrapper {
            padding: 0 4px;
            gap: 8px;
            min-width: 0;
          }
          .cal-month-name {
            font-size: 16px;
          }
          .cal-year-tag {
            font-size: 12px;
            padding: 2px 6px;
          }
          .cal-nav-arrow {
            width: 34px;
            height: 34px;
          }
          .cal-today-btn {
            padding: 6px 14px;
            font-size: 12px;
          }
          .cal-weekdays-row {
            padding: 8px 0;
          }
          .cal-weekday-label {
            font-size: 11px;
            letter-spacing: 0.2px;
          }
          .cal-row {
            min-height: 58px;
          }
          .cal-cell {
            padding: 4px 2px;
          }
          .cal-day-num {
            font-size: 12px;
            padding-right: 3px;
            padding-top: 1px;
          }
          .cal-event-pill {
            font-size: 8.5px;
            padding: 1px 3px;
            margin-bottom: 2px;
          }
          .cal-spanning-event {
            font-size: 8.5px;
            height: 18px;
            padding: 0 4px;
          }
          .cal-modal-overlay {
            padding: 16px;
            align-items: center;
          }
          .cal-modal-card {
            max-width: 440px;
            width: 100%;
            padding: 22px 18px;
            border-radius: 16px;
          }
        }

        /* Small Mobile (≤480px) */
        @media (max-width: 480px) {
          .cal-wrapper {
            padding: 12px 6px 90px 6px;
          }
          .cal-main-card {
            padding: 12px 6px;
            border-radius: 12px;
          }
          .cal-sidebar-card {
            padding: 16px 10px;
            border-radius: 12px;
          }
          .cal-month-nav {
            padding: 4px 6px;
          }
          .cal-month-name {
            font-size: 14.5px;
          }
          .cal-year-tag {
            font-size: 11px;
            padding: 1px 5px;
          }
          .cal-nav-arrow {
            width: 30px;
            height: 30px;
          }
          .cal-today-btn {
            padding: 5px 12px;
            font-size: 11.5px;
          }
          .cal-weekdays-row {
            padding: 6px 0;
          }
          .cal-weekday-label {
            font-size: 9.5px;
            letter-spacing: 0;
          }
          .cal-row {
            min-height: 48px;
          }
          .cal-cell {
            padding: 2px 1px;
          }
          .cal-day-num {
            font-size: 10px;
            padding-right: 1px;
          }
          .cal-event-pill {
            font-size: 7.5px;
            padding: 1px 2px;
            line-height: 1.1;
            margin-bottom: 1px;
          }
          .cal-spanning-event {
            font-size: 7.5px;
            height: 16px;
            padding: 0 3px;
          }
          .cal-add-btn {
            font-size: 13px;
            padding: 11px 16px;
          }
          .cal-sidebar-heading {
            font-size: 15px;
            margin: 18px 0 14px 0;
          }
          /* Modal: centered card on mobile */
          .cal-modal-overlay {
            padding: 12px;
            align-items: center;
          }
          .cal-modal-card {
            border-radius: 16px;
            max-width: 100%;
            padding: 20px 16px;
          }
        }
      `}</style>

      <div className="cal-dashboard-container">
        {/* ==================== LEFT MAIN CALENDAR ==================== */}
        <section className="cal-main-card" aria-label="Monthly Calendar">
          {/* Header Navigation */}
          <div className="cal-top-bar">
            <div className="cal-top-bar-left">
              <button
                type="button"
                className="cal-today-btn"
                onClick={handleResetToday}
                title="Jump to today"
              >
                <span className="cal-today-dot" />
                Today
              </button>
            </div>

            <div className="cal-month-nav">
              {/* Prev arrow — SVG chevron with directional nudge */}
              <button
                type="button"
                className={`cal-nav-arrow cal-nav-arrow-prev ${slideDir === 'prev' ? 'arrow-animating' : ''}`}
                onClick={handlePrevMonth}
                aria-label="Previous month"
                disabled={isAnimating}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div
                className={`cal-month-title-wrapper ${slideDir === 'next' ? 'slide-next' :
                    slideDir === 'prev' ? 'slide-prev' : ''
                  }`}
              >
                <h1 className="cal-month-name">{MONTH_NAMES[calMonth]}</h1>
                <span className="cal-year-tag">{calYear}</span>
              </div>

              {/* Next arrow — SVG chevron with directional nudge */}
              <button
                type="button"
                className={`cal-nav-arrow cal-nav-arrow-next ${slideDir === 'next' ? 'arrow-animating' : ''}`}
                onClick={handleNextMonth}
                aria-label="Next month"
                disabled={isAnimating}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            <div className="cal-top-bar-right" />
          </div>

          {/* Weekday Column Headers */}
          <div className="cal-weekdays-row">
            {weekdays.map((day, idx) => (
              <div key={idx} className="cal-weekday-label">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid Container with slide animation */}
          <div className={`cal-grid-wrapper ${slideDir === 'next' ? 'grid-slide-next' :
              slideDir === 'prev' ? 'grid-slide-prev' : ''
            }`}>
            <div className="cal-grid">
              {calendarRows.map((row) => (
                <div key={row.id} className="cal-row">
                  {row.days.map((item, dIdx) => (
                    <div
                      key={dIdx}
                      className={[
                        'cal-cell',
                        !item.isCurrentMonth ? 'inactive' : '',
                        item.isCurrentMonth && item.day === selectedDay ? 'selected' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => {
                        if (item.isCurrentMonth) setSelectedDay(item.day);
                      }}
                    >
                      {/* Today indicator: blue circle on today's date */}
                      <span
                        className="cal-day-num"
                        style={
                          item.isCurrentMonth &&
                            item.day === today.getDate() &&
                            calMonth === today.getMonth() &&
                            calYear === today.getFullYear()
                            ? {
                              background: '#4c84ff',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '26px',
                              height: '26px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              marginRight: '6px',
                              fontSize: '13px',
                            }
                            : undefined
                        }
                      >
                        {item.day}
                      </span>

                      {/* Single cell event */}
                      {item.event && (
                        <div className={`cal-event-pill ${item.event.type}`}>
                          {item.event.name}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Spanning multi-day event (Glastonbury Festival across cols 5, 6, 7) */}
                  {row.spanningEvent && (
                    <div
                      className="cal-spanning-event"
                      style={{
                        left: `calc(${((row.spanningEvent.startCol - 1) / 7) * 100}%)`,
                        width: `calc(${((row.spanningEvent.endCol - row.spanningEvent.startCol) / 7) * 100}%)`
                      }}
                    >
                      {row.spanningEvent.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== RIGHT SIDEBAR ==================== */}
        <aside className="cal-sidebar-card" aria-label="Upcoming Events">
          {/* Add New Event Button */}
          <button
            type="button"
            className="cal-add-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <span>+</span> Add New Event
          </button>

          <h2 className="cal-sidebar-heading">You are going to</h2>

          {/* List of Events */}
          <div className="cal-event-list">
            {sidebarEvents.map((event) => (
              <article key={event.id} className="cal-event-item">
                <div className="cal-event-details">
                  <h3 className="cal-event-title">{event.title}</h3>
                  {(event.content || event.location) && (
                    <div className="cal-event-location">{event.content || event.location}</div>
                  )}
                  <div className="cal-event-meta">
                    <span className="cal-event-date-badge">📆 {event.date}</span>
                  </div>
                </div>

                {/* 3-dot kebab menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="cal-kebab-btn"
                    aria-label="Event options"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === event.id ? null : event.id);
                    }}
                  >
                    &#8942;
                  </button>

                  {openMenuId === event.id && (
                    <>
                      {/* Click-outside overlay */}
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="cal-kebab-dropdown">
                        <button
                          type="button"
                          className="cal-kebab-option"
                          onClick={() => {
                            setViewingEvent(event);
                            setOpenMenuId(null);
                          }}
                        >
                          <span>👁</span> View
                        </button>
                        <div className="cal-kebab-divider" />
                        <button
                          type="button"
                          className="cal-kebab-option delete"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <span>🗑</span> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* See More Button */}
          <button type="button" className="cal-see-more-btn">
            See More
          </button>
        </aside>
      </div>
      {/* ==================== VIEW EVENT MODAL ==================== */}
      {viewingEvent && (
        <div
          className="cal-view-overlay"
          onClick={() => setViewingEvent(null)}
        >
          <div className="cal-view-card" onClick={(e) => e.stopPropagation()}>
            <div className="cal-view-header">
              <h2 className="cal-view-title">Event Details</h2>
              <button
                type="button"
                className="cal-view-close"
                onClick={() => setViewingEvent(null)}
              >&times;</button>
            </div>

            <div className="cal-view-field">
              <span className="cal-view-label">Event Name</span>
              <span className="cal-view-value">{viewingEvent.title}</span>
            </div>

            <div className="cal-view-field">
              <span className="cal-view-label">Date &amp; Time</span>
              <span className="cal-view-value">{viewingEvent.time}</span>
            </div>

            {(viewingEvent.content || viewingEvent.location) && (
              <div className="cal-view-field">
                <span className="cal-view-label">Content</span>
                <span className="cal-view-value">{viewingEvent.content || viewingEvent.location}</span>
              </div>
            )}

            <button
              type="button"
              className="cal-view-delete-btn"
              onClick={() => {
                handleDeleteEvent(viewingEvent.id);
                setViewingEvent(null);
              }}
            >
              🗑 Delete Event
            </button>
          </div>
        </div>
      )}

      {/* ==================== ADD EVENT MODAL ==================== */}
      {isModalOpen && (
        <div
          className="cal-modal-overlay"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="cal-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-header">
              <h2 className="cal-modal-title">Create New Event</h2>
              <button
                type="button"
                className="cal-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddEventSubmit}>
              <div className="cal-form-group">
                <label className="cal-form-label">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Tech Symposium"
                  className="cal-form-input"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </div>

              <div className="cal-form-group">
                <label className="cal-form-label">Date</label>
                <input
                  type="date"
                  required
                  className="cal-form-input"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>

              <div className="cal-form-group">
                <label className="cal-form-label">Time</label>
                <div className="cal-time-row">
                  <input
                    type="time"
                    required
                    className="cal-form-input"
                    value={newEvent.time}
                    onChange={(e) => {
                      const raw = e.target.value; // always HH:MM in 24h from browser
                      const { ampm } = from24h(raw);
                      setTimeAmPm(ampm);
                      setNewEvent({ ...newEvent, time: raw });
                    }}
                  />
                  <div className="cal-ampm-toggle">
                    <button
                      type="button"
                      className={`cal-ampm-btn${timeAmPm === 'AM' ? ' active' : ''}`}
                      onClick={() => {
                        const { displayTime } = from24h(newEvent.time);
                        setTimeAmPm('AM');
                        setNewEvent({ ...newEvent, time: to24h(displayTime, 'AM') });
                      }}
                    >AM</button>
                    <button
                      type="button"
                      className={`cal-ampm-btn${timeAmPm === 'PM' ? ' active' : ''}`}
                      onClick={() => {
                        const { displayTime } = from24h(newEvent.time);
                        setTimeAmPm('PM');
                        setNewEvent({ ...newEvent, time: to24h(displayTime, 'PM') });
                      }}
                    >PM</button>
                  </div>
                </div>
              </div>

              <div className="cal-form-group">
                <label className="cal-form-label">Content</label>
                <textarea
                  rows="3"
                  placeholder="Event content or details..."
                  className="cal-form-input"
                  value={newEvent.content}
                  onChange={(e) => setNewEvent({ ...newEvent, content: e.target.value })}
                />
              </div>

              <div className="cal-form-actions">
                <button
                  type="button"
                  className="cal-btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="cal-btn-submit">
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ── */}
      <div className="cal-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="cal-toast">
            <span className="cal-toast-icon">📅</span>
            <div className="cal-toast-body">
              <div className="cal-toast-heading">Event Created!</div>
              <div className="cal-toast-title">{t.title}</div>
              <div className="cal-toast-meta">
                <span>📆 {t.date}</span>
                <span>🕐 {t.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
