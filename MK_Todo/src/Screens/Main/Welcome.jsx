import React, { useEffect, useState } from 'react';
import StrokeText from '../Components/StrokeText';

export default function Welcome({ onFinish, userName = '' }) {
  const [secondsLeft, setSecondsLeft] = useState(6);

  useEffect(() => {
    // Automatically transition to Home screen after exactly 6 seconds
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 6000);

    // Countdown interval to show remaining seconds (6, 5, 4, 3, 2, 1)
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onFinish]);

  return (
    <div className="welcome-screen-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .welcome-screen-container {
          min-height: 100vh;
          width: 100%;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #111827;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          padding: 24px;
        }

        /* Center card */
        .welcome-card-box {
          position: relative;
          z-index: 10;
          max-width: 780px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        /* Top badge */
        .welcome-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 18px;
          border-radius: 9999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
        }

        .welcome-pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 8px rgba(22, 163, 74, 0.4);
          display: inline-block;
        }

        /* StrokeText wrapper */
        .stroke-text-wrap {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Subtitle */
        .welcome-subtext {
          font-size: 18px;
          font-weight: 500;
          color: #64748b;
          margin: 20px 0 36px 0;
          max-width: 520px;
          line-height: 1.5;
        }

        .welcome-subtext-highlight {
          color: #0f172a;
          font-weight: 700;
        }

        /* 6-Second Animated Progress Bar */
        .progress-bar-track {
          width: 100%;
          max-width: 380px;
          height: 6px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
          position: relative;
        }

        .progress-bar-fill {
          height: 100%;
          width: 0%;
          background: #000000;
          border-radius: 999px;
          animation: fillProgress 6s linear forwards;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
        }

        @keyframes fillProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>

      <div className="welcome-card-box">
        {/* Status Pill Badge */}
        <div className="welcome-pill-badge">
          <span className="welcome-pill-dot" />
          <span>Authenticated as {userName}</span>
        </div>

        {/* React Bits <StrokeText /> Component - Solid Black */}
        <div className="stroke-text-wrap">
          <StrokeText
            text={`Welcome Back! ${userName}`}
            strokeColor="#000000"
            fillColor="#000000"
            strokeWidth={1.8}
            drawDuration={1.8}
            fillDelay={0.3}
            stagger={0.045}
            ease="power2.out"
            trigger="mount"
            fillMode="wipe"
            fontSize={76}
            fontWeight={800}
            letterSpacing={-2.5}
          />
        </div>

        <p className="welcome-subtext">
          Syncing your notes, folders, and schedule. Entering your workspace in{' '}
          <span className="welcome-subtext-highlight">{secondsLeft}s</span>...
        </p>

        {/* 6-Second Animated Progress Bar */}
        <div className="progress-bar-track">
          <div className="progress-bar-fill" />
        </div>
      </div>
    </div>
  );
}
