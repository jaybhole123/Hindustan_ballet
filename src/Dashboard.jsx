import React, { useState, useEffect } from 'react';
import { Activity, Box, TrendingUp, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import './App.css';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'];

export default function Dashboard() {
  const [consData, setConsData] = useState(null);
  const [billetData, setBilletData] = useState(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem('consumptionData');
      if (c) setConsData(JSON.parse(c));
    } catch (e) {}
    try {
      const b = localStorage.getItem('billetData');
      if (b) setBilletData(JSON.parse(b));
    } catch (e) {}
  }, []);

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
    .slice(0, 8) // top 8 materials
    .map(x => ({ name: x.name, value: x.consumed })) : [];

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard Overview</h1>
      <p className="page-subtitle">Welcome back! Here's what's happening today in the plant.</p>
      
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
            <p style={{color: 'var(--mute)', fontSize: '14px'}}>No consumption data available. Upload Excel in Consumption Report.</p>
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
            <p style={{color: 'var(--mute)', fontSize: '14px'}}>No billet data available. Upload Excel in Billet Report.</p>
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
