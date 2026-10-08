import React from 'react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mk-app-footer">
      <style>{`
        .mk-app-footer {
          max-width: 1400px;
          width: 100%;
          margin: 52px auto 80px auto;
          padding: 20px 28px;
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          box-sizing: border-box;
          font-family: inherit;
        }

        .mk-footer-left {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .mk-footer-brand {
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .mk-footer-divider {
          color: #cbd5e1;
          user-select: none;
        }

        .mk-footer-copyright {
          color: #64748b;
          font-size: 13px;
        }

        .mk-footer-right {
          display: flex;
          align-items: center;
        }

        .mk-footer-credit {
          font-size: 13px;
          color: #475569;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .mk-footer-author-badge {
          font-weight: 700;
          color: #0f172a;
          background: #f1f5f9;
          padding: 3px 10px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          letter-spacing: 0.02em;
        }

        @media (max-width: 768px) {
          .mk-app-footer {
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 18px 20px;
            gap: 12px;
            margin-top: 40px;
            margin-bottom: 74px;
          }
          .mk-footer-left {
            flex-direction: column;
            gap: 4px;
            justify-content: center;
          }
          .mk-footer-divider {
            display: none;
          }
        }
      `}</style>

      <div className="mk-footer-left">
        <span className="mk-footer-brand">
          MK TODO's
        </span>
        <span className="mk-footer-divider">•</span>
        <span className="mk-footer-copyright">
          © {currentYear} MK TODO's. All rights reserved.
        </span>
      </div>

      <div className="mk-footer-right">
        <span className="mk-footer-credit">
          Created &amp; Designed by <strong className="mk-footer-author-badge">Cavin</strong>
        </span>
      </div>
    </footer>
  );
}
