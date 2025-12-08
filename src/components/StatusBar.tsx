import React from 'react';

interface StatusBarProps {
  status: string;
  stats: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, stats }) => (
  <footer className="status-bar">
    <span id="status-text">{status}</span>
    <span id="stats-text">{stats}</span>
  </footer>
);
