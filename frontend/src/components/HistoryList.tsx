import React from 'react';
import { History, Trash2, Clock } from 'lucide-react';
import { DetectionRecord } from '../types';

interface HistoryListProps {
  history: DetectionRecord[];
  onClearHistory: () => void;
  isLoading: boolean;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  onClearHistory,
  isLoading,
}) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className="glass-card history-card">
      <div className="section-title-row">
        <h2 className="section-heading">
          <History size={20} color="#6366f1" />
          Recent Detections (MongoDB Sync)
        </h2>
        {history.length > 0 && (
          <button
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            onClick={onClearHistory}
            title="Clear History"
          >
            <Trash2 size={13} />
            Clear Log
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <Clock size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
          <div>No detection events saved yet.</div>
          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            Hold an object in your hand to automatically log stable color detections.
          </div>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item, idx) => (
            <div key={item._id || idx} className="history-row">
              <div className="history-color-info">
                <div
                  className="history-swatch"
                  style={{ backgroundColor: item.hexCode || '#6366f1' }}
                />
                <span style={{ fontWeight: 600, color: '#ffffff' }}>{item.color}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="badge" style={{ fontSize: '0.7rem' }}>
                  {item.confidence}% Conf
                </span>
                <span className="history-time">{formatTime(item.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
