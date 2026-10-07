import React, { useState, useEffect } from 'react';
import homeIcon from '../../assets/home.png';
import calendarIcon from '../../assets/calendar.png';
import galleryIcon from '../../assets/gallery.png';

/**
 * FloatingNav — pill-shaped bottom-center dock with Home, Photos, Calendar, Logout.
 * Props:
 *   activeScreen  — 'home' | 'photos' | 'calendar' | 'folder'
 *   onHome        — navigate to home
 *   onPhotos      — navigate to photos/gallery
 *   onCalendar    — navigate to calendar
 *   onLogout      — logout
 */
export default function FloatingNav({ activeScreen, onHome, onPhotos, onCalendar, onLogout }) {
  const [visible, setVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // Hide nav on scroll down, show on scroll up
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastY + 10 && currentY > 80) {
        setVisible(false);
      } else if (currentY < lastY - 6) {
        setVisible(true);
      }
      setLastY(currentY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastY]);

  // Auto-cancel logout confirm after 3s
  useEffect(() => {
    if (!logoutConfirm) return;
    const timer = setTimeout(() => setLogoutConfirm(false), 3000);
    return () => clearTimeout(timer);
  }, [logoutConfirm]);

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      onClick: onHome,
      icon: <img src={homeIcon} alt="Home" width="26" height="26" style={{ objectFit: 'contain', display: 'block' }} />,
    },
    {
      id: 'photos',
      label: 'Gallery',
      onClick: onPhotos,
      icon: <img src={galleryIcon} alt="Gallery" width="26" height="26" style={{ objectFit: 'contain', display: 'block' }} />,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      onClick: onCalendar,
      icon: <img src={calendarIcon} alt="Calendar" width="26" height="26" style={{ objectFit: 'contain', display: 'block' }} />,
    },
    {
      id: 'logout',
      label: logoutConfirm ? 'Sure?' : 'Logout',
      isLogout: true,
      onClick: () => {
        if (logoutConfirm) {
          onLogout?.();
        } else {
          setLogoutConfirm(true);
        }
      },
      icon: logoutConfirm ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{`
        @keyframes floatnav-rise {
          from { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        .floatnav-dock {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%) translateY(0);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 7px 10px;
          background: #ffffff;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          box-shadow:
            0 8px 30px rgba(0,0,0,0.10),
            0 2px 8px rgba(0,0,0,0.06);
          transition:
            transform 0.38s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.38s cubic-bezier(0.4, 0, 0.2, 1);
          animation: floatnav-rise 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          user-select: none;
        }

        .floatnav-dock.hidden {
          transform: translateX(-50%) translateY(120px);
          opacity: 0;
          pointer-events: none;
        }

        /* ── Individual nav button ── */
        .floatnav-btn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 10px 20px;
          border: none;
          background: transparent;
          border-radius: 999px;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          min-width: 60px;
        }

        .floatnav-btn:hover {
          color: #111827;
          background: #f3f4f6;
        }

        .floatnav-btn:active {
          transform: scale(0.92);
        }

        /* ── Active state ── */
        .floatnav-btn.is-active {
          color: #4f46e5;
          background: #eef2ff;
        }

        .floatnav-btn.is-active .floatnav-icon {
          filter: drop-shadow(0 0 6px rgba(99,102,241,0.3));
          color: #6366f1;
        }

        /* ── Photos active tint: warm orange ── */
        .floatnav-btn.photos-active {
          background: #fff7ed;
          color: #ea580c;
        }

        .floatnav-btn.photos-active .floatnav-icon {
          filter: drop-shadow(0 0 5px rgba(234,88,12,0.25));
          color: #f97316;
        }

        /* ── Calendar active tint: sky blue ── */
        .floatnav-btn.calendar-active {
          background: #eff6ff;
          color: #2563eb;
        }

        .floatnav-btn.calendar-active .floatnav-icon {
          filter: drop-shadow(0 0 5px rgba(37,99,235,0.25));
          color: #3b82f6;
        }

        /* ── Logout button: red tint ── */
        .floatnav-btn.logout:hover {
          background: #fee2e2;
          color: #dc2626;
        }

        .floatnav-btn.logout.confirming {
          background: #fee2e2;
          color: #dc2626;
        }

        .floatnav-btn.logout.confirming .floatnav-icon {
          color: #dc2626;
          filter: drop-shadow(0 0 4px rgba(220,38,38,0.3));
        }

        .floatnav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, color 0.2s ease, filter 0.2s ease;
          line-height: 0;
        }

        /* PNG icon sizing & active tint via opacity/brightness */
        .floatnav-icon img {
          width: 26px;
          height: 26px;
          object-fit: contain;
          opacity: 0.45;
          transition: opacity 0.2s ease, filter 0.2s ease;
        }

        .floatnav-btn:hover .floatnav-icon img {
          opacity: 0.75;
        }

        .floatnav-btn.is-active .floatnav-icon img {
          opacity: 1;
          filter: none;
        }

        .floatnav-btn.photos-active .floatnav-icon img {
          opacity: 1;
          filter: none;
        }

        .floatnav-btn.calendar-active .floatnav-icon img {
          opacity: 1;
          filter: none;
        }

        .floatnav-btn:hover .floatnav-icon {
          transform: translateY(-2px) scale(1.06);
        }

        .floatnav-btn:active .floatnav-icon {
          transform: scale(0.9);
        }

        .floatnav-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          line-height: 1;
          transition: opacity 0.2s;
        }

        /* ── Active indicator dot ── */
        .floatnav-dot {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
        }

        .floatnav-btn.is-active .floatnav-dot {
          background: #6366f1;
          box-shadow: 0 0 5px rgba(99,102,241,0.5);
        }

        .floatnav-btn.photos-active .floatnav-dot {
          background: #f97316;
          box-shadow: 0 0 5px rgba(249,115,22,0.5);
        }

        .floatnav-btn.calendar-active .floatnav-dot {
          background: #3b82f6;
          box-shadow: 0 0 5px rgba(59,130,246,0.5);
        }

        /* ── Divider before logout ── */
        .floatnav-divider {
          width: 1px;
          height: 28px;
          background: #e5e7eb;
          margin: 0 4px;
          flex-shrink: 0;
          border-radius: 1px;
        }

        /* ── Tooltip ── */
        .floatnav-btn::before {
          content: attr(data-tip);
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%) scale(0.82);
          background: #111827;
          color: #f9fafb;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 7px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: all 0.16s ease;
          letter-spacing: 0.02em;
          border: 1px solid #374151;
        }

        .floatnav-btn:hover::before {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .floatnav-dock {
            bottom: 18px;
            padding: 6px 8px;
            gap: 0;
          }
          .floatnav-btn {
            padding: 9px 14px;
            min-width: 52px;
          }
          .floatnav-label {
            font-size: 9px;
          }
        }

        @media (max-width: 360px) {
          .floatnav-btn {
            padding: 8px 11px;
            min-width: 46px;
          }
        }
      `}</style>

      <nav
        className={`floatnav-dock${!visible ? ' hidden' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const isActive = !item.isLogout && (
            activeScreen === item.id ||
            (item.id === 'home' && activeScreen === 'folder')
          );

          const activeClass = isActive
            ? item.id === 'photos'
              ? 'photos-active'
              : item.id === 'calendar'
              ? 'calendar-active'
              : 'is-active'
            : '';

          return (
            <React.Fragment key={item.id}>
              {/* Divider before logout */}
              {item.id === 'logout' && (
                <div className="floatnav-divider" aria-hidden="true" />
              )}

              <button
                className={[
                  'floatnav-btn',
                  item.isLogout ? 'logout' : '',
                  item.isLogout && logoutConfirm ? 'confirming' : '',
                  activeClass,
                ].filter(Boolean).join(' ')}
                onClick={item.onClick}
                data-tip={
                  item.isLogout && logoutConfirm
                    ? 'Tap again to confirm'
                    : item.label
                }
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="floatnav-icon">{item.icon}</span>
                <span className="floatnav-label">{item.label}</span>

                {/* Active glow dot */}
                {(isActive || (item.isLogout && logoutConfirm)) && (
                  <span className="floatnav-dot" aria-hidden="true" />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
    </>
  );
}
