import React, { useState, useEffect } from 'react';
import Consumption from './Consumption';
import Dashboard from './Dashboard';
import Billet from './Billet';
import MisReport from './MisReport';
import { LayoutDashboard, FileSpreadsheet, Settings, User, Menu, FileText, ClipboardList, X } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  return (
    <div className="erp-layout">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`erp-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-logo">HB</div>
            <h2>Hindustan billet</h2>
          </div>
          <button className="icon-btn close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="sidebar-section">Main Menu</div>
        <ul className="sidebar-nav">
          <li 
            className={activeTab === 'dashboard' ? 'active' : ''} 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </li>
          <li 
            className={activeTab === 'consumption' ? 'active' : ''} 
            onClick={() => { setActiveTab('consumption'); setIsMobileMenuOpen(false); }}
          >
            <FileSpreadsheet size={20} />
            <span>Consumption Report</span>
          </li>
          <li 
            className={activeTab === 'billet' ? 'active' : ''} 
            onClick={() => { setActiveTab('billet'); setIsMobileMenuOpen(false); }}
          >
            <FileText size={20} />
            <span>Billet Report</span>
          </li>
          <li 
            className={activeTab === 'mis' ? 'active' : ''} 
            onClick={() => { setActiveTab('mis'); setIsMobileMenuOpen(false); }}
          >
            <ClipboardList size={20} />
            <span>MIS Report</span>
          </li>
        </ul>

      </aside>

      {/* Main Area */}
      <div className="erp-main">
        {/* Top Header */}
        <header className="erp-header">
          <div className="header-search">
             <button className="icon-btn mobile-menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
               <Menu size={20} />
             </button>
          </div>
          <div className="header-actions">
            <div className="user-profile">
              <div className="avatar"><User size={20} /></div>
              <div className="user-info">
                <strong>Admin User</strong>
                <span>Plant Manager</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="erp-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'consumption' && <Consumption />}
          {activeTab === 'billet' && <Billet />}
          {activeTab === 'mis' && <MisReport />}
        </main>
      </div>
    </div>
  );
}

export default App;
