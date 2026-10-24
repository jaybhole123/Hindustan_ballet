import React, { useState, useEffect } from 'react';
import { Activity, Box, TrendingUp, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import DateFilter from './DateFilter';
import { normalizeDate, getTodayIso, getHistory } from './dateHistory';
import './App.css';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'];

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const cd = localStorage.getItem('consumptionData');
    if (cd) {
      try {
        const p = JSON.parse(cd);
        if (p.date) return normalizeDate(p.date);
      } catch (e) {}
    }
    const bd = localStorage.getItem('billetData');
    if (bd) {
      try {
        const p = JSON.parse(bd);
        if (p.date) return normalizeDate(p.date);
      } catch (e) {}
    }
    return getTodayIso();
  });

  const [isOverall, setIsOverall] = useState(false);
  const [consData, setConsData] = useState(null);
  const [billetData, setBilletData] = useState(null);

  // Available dates for DateFilter dot indicator
  const consHist = getHistory('consumptionHistory');
  const billetHist = getHistory('billetHistory');
  const availableDates = Array.from(new Set([
    ...Object.keys(consHist).map(k => normalizeDate(k)),
    ...Object.keys(billetHist).map(k => normalizeDate(k))
  ])).filter(Boolean);

  // Include active saved report date if available
  try {
    const cd = localStorage.getItem('consumptionData');
    if (cd) {
      const p = JSON.parse(cd);
      if (p.date) {
        const nd = normalizeDate(p.date);
        if (nd && !availableDates.includes(nd)) availableDates.push(nd);
      }
    }
  } catch (e) {}

  // Compute Overall or Date-specific data
  useEffect(() => {
    const currentConsHist = getHistory('consumptionHistory');
    const currentBilletHist = getHistory('billetHistory');

    if (isOverall) {
      // 1. Combine All Dates for Overall Consumption
      const allCons = Object.values(currentConsHist);
      if (allCons.length === 0) {
        // Fallback to active single report
        const saved = localStorage.getItem('consumptionData');
        if (saved) {
          try { allCons.push(JSON.parse(saved)); } catch (e) {}
        }
      }

      let combinedCons = null;
      if (allCons.length > 0) {
        const summary = {
          totalHeat: 0,
          totalCons: 0,
          finishProd: 0,
          totalProd: 0,
          mnYield: 0,
          avgYield: 0
        };
        const rawMap = {};
        const chargeMap = {};

        allCons.forEach(c => {
          summary.totalHeat += Number(c.summary?.totalHeat || 0);
          summary.totalCons += Number(c.summary?.totalCons || 0);
          summary.finishProd += Number(c.summary?.finishProd || 0);
          summary.totalProd += Number(c.summary?.totalProd || 0);

          (c.raw || []).forEach(r => {
            const name = r.name || 'Unknown';
            if (!rawMap[name]) rawMap[name] = { ...r, consumed: 0, opening: 0, closing: 0 };
            rawMap[name].consumed += Number(r.consumed || 0);
            rawMap[name].closing += Number(r.closing || 0);
          });

          (c.charge || []).forEach(ch => {
            const name = ch.name || 'Unknown';
            if (!chargeMap[name]) chargeMap[name] = { ...ch, consumed: 0, opening: 0, closing: 0 };
            chargeMap[name].consumed += Number(ch.consumed || 0);
            chargeMap[name].closing += Number(ch.closing || 0);
          });
        });

        summary.avgYield = summary.totalCons ? (summary.totalProd / summary.totalCons) * 100 : 0;
        summary.mnYield = allCons.reduce((acc, c) => acc + Number(c.summary?.mnYield || 0), 0) / (allCons.length || 1);

        combinedCons = {
          date: 'All Time Overall',
          summary,
          raw: Object.values(rawMap),
          charge: Object.values(chargeMap)
        };
      }

      // 2. Combine All Dates for Overall Billet
      const allBillet = Object.values(currentBilletHist);
      if (allBillet.length === 0) {
        const saved = localStorage.getItem('billetData');
        if (saved) {
          try { allBillet.push(JSON.parse(saved)); } catch (e) {}
        }
      }

      let combinedBillet = null;
      if (allBillet.length > 0) {
        const grand = { opening: 0, production: 0, despatch: 0, transfer: 0, closing: 0 };
        const sizeMap = {};

        allBillet.forEach(b => {
          grand.opening += Number(b.grand?.opening || 0);
          grand.production += Number(b.grand?.production || 0);
          grand.despatch += Number(b.grand?.despatch || 0);
          grand.transfer += Number(b.grand?.transfer || 0);
          grand.closing += Number(b.grand?.closing || 0);

          (b.sizes || []).forEach(s => {
            const sz = s.size || 'Standard';
            if (!sizeMap[sz]) {
              sizeMap[sz] = {
                size: sz,
                totals: { opening: 0, production: 0, despatch: 0, transfer: 0, closing: 0 }
              };
            }
            sizeMap[sz].totals.opening += Number(s.totals?.opening || 0);
            sizeMap[sz].totals.production += Number(s.totals?.production || 0);
            sizeMap[sz].totals.despatch += Number(s.totals?.despatch || 0);
            sizeMap[sz].totals.transfer += Number(s.totals?.transfer || 0);
            sizeMap[sz].totals.closing += Number(s.totals?.closing || 0);
          });
        });

        combinedBillet = {
          date: 'All Time Overall',
          grand,
          sizes: Object.values(sizeMap)
        };
      }

      setConsData(combinedCons);
      setBilletData(combinedBillet);
    } else {
      // Single Date Lookup
      let cData = currentConsHist[selectedDate] || null;
      let bData = currentBilletHist[selectedDate] || null;

      if (!cData) {
        const matchKey = Object.keys(currentConsHist).find(k => normalizeDate(k) === selectedDate);
        if (matchKey) cData = currentConsHist[matchKey];
      }
      if (!bData) {
        const matchKey = Object.keys(currentBilletHist).find(k => normalizeDate(k) === selectedDate);
        if (matchKey) bData = currentBilletHist[matchKey];
      }

      // Fallback to active report if date matches or if single report exists
      if (!cData) {
        const saved = localStorage.getItem('consumptionData');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (normalizeDate(parsed.date) === selectedDate || !parsed.date) {
              cData = parsed;
            }
          } catch (e) {}
        }
      }
      if (!bData) {
        const saved = localStorage.getItem('billetData');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (normalizeDate(parsed.date) === selectedDate || !parsed.date) {
              bData = parsed;
            }
          } catch (e) {}
        }
      }

      setConsData(cData);
      setBilletData(bData);
    }
  }, [selectedDate, isOverall]);

  const handleDateChange = (newIsoDate) => {
    setIsOverall(false);
    setSelectedDate(newIsoDate);
  };

  const handleToggleOverall = (val) => {
    setIsOverall(typeof val === 'boolean' ? val : !isOverall);
  };

  const totalProduction = billetData?.grand?.production || consData?.summary?.totalProd || 0;
  const avgYield = consData?.summary?.avgYield || 0;
  const rawStock = consData ? [...(consData.raw || []), ...(consData.charge || [])].reduce((acc, x) => acc + (parseFloat(x.closing) || 0), 0) : 0;
  const billetStock = billetData?.grand?.closing || 0;
  
  const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // Prepare data for Billet Production Bar Chart
  const billetChartData = billetData?.sizes?.map(s => ({
    name: s.size,
    Production: s.totals.production,
    Despatch: s.totals.despatch
  })) || [];

  // Prepare data for Material Consumption Pie Chart
  const consChartData = consData ? [...(consData.raw || []), ...(consData.charge || [])]
    .filter(x => x.consumed > 0)
    .sort((a, b) => b.consumed - a.consumed)
    .slice(0, 8)
    .map(x => ({ name: x.name, value: x.consumed })) : [];

  return (
    <div className="dashboard" style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 4px' }}>Dashboard Overview</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {isOverall 
              ? 'Showing cumulative summary across all available records.' 
              : "Welcome back! Here's what's happening today in the plant."}
          </p>
        </div>
        <DateFilter 
          selectedDate={selectedDate} 
          onDateChange={handleDateChange} 
          availableDates={availableDates}
          isOverall={isOverall}
          onToggleOverall={handleToggleOverall}
        />
      </div>
      
      <div className="erp-kpis">
        <div className="erp-kpi-card">
          <div className="kpi-icon"><Activity size={24} /></div>
          <div className="kpi-info">
            <span>Total Production</span>
            <b>{fmt(totalProduction)} MT</b>
          </div>
        </div>
        <div className="erp-kpi-card">
          <div className="kpi-icon" style={{background: '#e8f5e9', color: '#2e7d32'}}><TrendingUp size={24} /></div>
          <div className="kpi-info">
            <span>Average Yield</span>
            <b>{avgYield ? Number(avgYield).toFixed(2) + '%' : '0%'}</b>
          </div>
        </div>
        <div className="erp-kpi-card">
          <div className="kpi-icon" style={{background: '#fff3e0', color: '#e65100'}}><Box size={24} /></div>
          <div className="kpi-info">
            <span>Raw Material Stock</span>
            <b>{fmt(rawStock)} MT</b>
          </div>
        </div>
        <div className="erp-kpi-card">
          <div className="kpi-icon" style={{background: '#e3f2fd', color: '#1565c0'}}><Package size={24} /></div>
          <div className="kpi-info">
            <span>Billet Stock</span>
            <b>{fmt(billetStock)} MT</b>
          </div>
        </div>
      </div>

      <div className="dashboard-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>Consumption Overview {consData?.date ? <span style={{fontSize: '13px', color: 'var(--mute)', fontWeight: 'normal'}}>({consData.date})</span> : ''}</h2>
          {consData ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--ink)', lineHeight: '2' }}>
              <li style={{display: 'flex', justifyContent: 'space-between'}}><strong>Total Heat:</strong> <span>{consData.summary?.totalHeat || 0}</span></li>
              <li style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px'}}><strong>Total Consumption:</strong> <span>{fmt(consData.summary?.totalCons || 0)} MT</span></li>
              <li style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px'}}><strong>Mn Yield:</strong> <span>{consData.summary?.mnYield ? Number(consData.summary.mnYield).toFixed(2) + '%' : '0%'}</span></li>
              <li style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px'}}><strong>Finish Production:</strong> <span>{fmt(consData.summary?.finishProd || 0)} MT</span></li>
            </ul>
          ) : (
            <p style={{color: 'var(--mute)', fontSize: '14px'}}>No consumption data available for {selectedDate}.</p>
          )}
        </div>
        
        <div className="card" style={{ marginBottom: 0 }}>
          <h2>Billet Overview {billetData?.date ? <span style={{fontSize: '13px', color: 'var(--mute)', fontWeight: 'normal'}}>({billetData.date})</span> : ''}</h2>
          {billetData ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--ink)', lineHeight: '2' }}>
              <li style={{display: 'flex', justifyContent: 'space-between'}}><strong>Total Opening:</strong> <span>{fmt(billetData.grand?.opening || 0)} MT</span></li>
              <li style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px'}}><strong>Total Production:</strong> <span>{fmt(billetData.grand?.production || 0)} MT</span></li>
              <li style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px'}}><strong>Total Despatch:</strong> <span>{fmt(billetData.grand?.despatch || 0)} MT</span></li>
              <li style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px'}}><strong>Total Transfer:</strong> <span>{fmt(billetData.grand?.transfer || 0)} MT</span></li>
            </ul>
          ) : (
            <p style={{color: 'var(--mute)', fontSize: '14px'}}>No billet data available for {selectedDate}.</p>
          )}
        </div>
      </div>

      <div className="dashboard-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="card">
          <h2>Billet Production vs Despatch</h2>
          {billetChartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={billetChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e6ec" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#6b7683'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#6b7683'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e6ec', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'}} />
                  <Legend wrapperStyle={{fontSize: '13px'}} />
                  <Bar dataKey="Production" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despatch" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{color: 'var(--mute)', fontSize: '14px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>No data to display graph.</p>
          )}
        </div>

        <div className="card">
          <h2>Top Material Consumption</h2>
          {consChartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={consChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {consChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val) => fmt(val) + ' MT'} contentStyle={{borderRadius: '8px', border: '1px solid #e2e6ec', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'}} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '13px', paddingLeft: '20px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{color: 'var(--mute)', fontSize: '14px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>No data to display pie chart.</p>
          )}
        </div>
      </div>
    </div>
  );
}
