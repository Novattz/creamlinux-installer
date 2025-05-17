// src/components/Header.tsx
import React from 'react';

interface HeaderProps {
  onRefresh: () => void;
  refreshDisabled?: boolean;
  onSearch: (query: string) => void;
  searchQuery: string;
}

const Header: React.FC<HeaderProps> = ({ 
  onRefresh, 
  refreshDisabled = false,
  onSearch,
  searchQuery
}) => {
  return (
    <header className="app-header">
      <h1>CreamLinux</h1>
      <div className="header-controls">
        <button 
          className="refresh-button" 
          onClick={onRefresh}
          disabled={refreshDisabled}
        >
          Refresh
        </button>
        <input 
          type="text" 
          placeholder="Search games..." 
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </header>
  );
};

export default Header;