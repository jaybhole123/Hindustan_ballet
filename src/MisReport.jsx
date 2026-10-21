import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import DateFilter from './DateFilter';
import { normalizeDate, getTodayIso, getHistory, getFromHistory } from './dateHistory';
import './App.css';

const fmt = (n, d = 3) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.000';
  return num.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
};

const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

export default function MisReport() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Check if either report has a saved date
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

  const [consData, setConsData] = useState(null);
  const [billetData, setBilletData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [mergeConfig, setMergeConfig] = useState(() => {
    const saved = localStorage.getItem('misMergeConfig');
    if (saved) try { return JSON.parse(saved); } catch (e) {}
    return {};
  });
  const [colorConfig, setColorConfig] = useState(() => {
    const saved = localStorage.getItem('misColorConfig');
    if (saved) try { return JSON.parse(saved); } catch (e) {}
    return {};
  });
  const [orderConfig, setOrderConfig] = useState(() => {
    const saved = localStorage.getItem('misOrderConfig');
    if (saved) try { return JSON.parse(saved); } catch (e) {}
    return {};
  });
  const [draggedItem, setDraggedItem] = useState(null);
  const [combineModal, setCombineModal] = useState({ isOpen: false, sizeIdx: null, label: '', count: 0 });

  // Function to load data for a specific date
  const loadDataForDate = (isoDate) => {
    const consHist = getHistory('consumptionHistory');
    const billetHist = getHistory('billetHistory');

    let cData = consHist[isoDate] || null;
    let bData = billetHist[isoDate] || null;

    // Fallback to active single report if date matches
    if (!cData) {
      const saved = localStorage.getItem('consumptionData');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (normalizeDate(parsed.date) === isoDate) cData = parsed;
        } catch (e) {}
      }
    }
    if (!bData) {
      const saved = localStorage.getItem('billetData');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (normalizeDate(parsed.date) === isoDate) bData = parsed;
        } catch (e) {}
      }
    }

    setConsData(cData);
    setBilletData(bData);
  };

  useEffect(() => {
    loadDataForDate(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (newIsoDate) => {
    setSelectedDate(newIsoDate);
  };

  useEffect(() => {
    localStorage.setItem('misMergeConfig', JSON.stringify(mergeConfig));
  }, [mergeConfig]);

  useEffect(() => {
    localStorage.setItem('misColorConfig', JSON.stringify(colorConfig));
  }, [colorConfig]);

  useEffect(() => {
    localStorage.setItem('misOrderConfig', JSON.stringify(orderConfig));
  }, [orderConfig]);

  const toggleRow = (sizeIdx, itemIdx) => {
    setSelectedRows(prev => {
      const key = sizeIdx;
      const current = prev[key] ? [...prev[key]] : [];
      const pos = current.indexOf(itemIdx);
      if (pos >= 0) current.splice(pos, 1);
      else current.push(itemIdx);
      return { ...prev, [key]: current };
    });
  };

  const combineSelected = (sizeIdx) => {
    const selected = selectedRows[sizeIdx];
    if (!selected || selected.length < 2) {
      alert('Please select at least 2 rows to combine.');
      return;
    }
    setCombineModal({
      isOpen: true,
      sizeIdx,
      label: '',
      count: selected.length
    });
  };

  const handleConfirmCombine = (e) => {
    if (e) e.preventDefault();
    const { sizeIdx, label } = combineModal;
    if (!label.trim()) return;

    const selected = selectedRows[sizeIdx];
    if (!selected || selected.length < 2) {
      setCombineModal({ isOpen: false, sizeIdx: null, label: '', count: 0 });
      return;
    }

    const indices = [...selected].sort((a, b) => a - b);
    const newGroup = { label: label.trim(), indices, color: '#ffffff' };
    setMergeConfig(prev => {
      const existing = prev[sizeIdx] || [];
      const filtered = existing.filter(g => !g.indices.some(i => indices.includes(i)));
      return { ...prev, [sizeIdx]: [...filtered, newGroup] };
    });
    setSelectedRows(prev => ({ ...prev, [sizeIdx]: [] }));
    setCombineModal({ isOpen: false, sizeIdx: null, label: '', count: 0 });
  };

  const changeColor = (sizeIdx, index, isMerged, newColor) => {
    if (isMerged) {
      setMergeConfig(prev => {
        const next = { ...prev };
        if (next[sizeIdx]) {
           const arr = [...next[sizeIdx]];
           arr[index] = { ...arr[index], color: newColor };
           next[sizeIdx] = arr;
        }
        return next;
      });
    } else {
      setColorConfig(prev => ({
        ...prev,
        [sizeIdx]: {
          ...(prev[sizeIdx] || {}),
          [index]: newColor
        }
      }));
    }
  };

  const removeMergeGroup = (sizeIdx, groupIdx) => {
    setMergeConfig(prev => {
      const existing = [...(prev[sizeIdx] || [])];
      existing.splice(groupIdx, 1);
      return { ...prev, [sizeIdx]: existing };
    });
  };

  const handleDragStart = (e, sizeIdx, rowIndex) => {
    if (!editMode) return;
    setDraggedItem({ sizeIdx, rowIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, sizeIdx, targetIndex, currentRenderList) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.sizeIdx !== sizeIdx || draggedItem.rowIndex === targetIndex) {
      setDraggedItem(null);
      return;
    }
    const newList = [...currentRenderList];
    const [movedItem] = newList.splice(draggedItem.rowIndex, 1);
    newList.splice(targetIndex, 0, movedItem);

    setOrderConfig(prev => ({
      ...prev,
      [sizeIdx]: newList.map(r => r.id)
    }));
    setDraggedItem(null);
  };

  const downloadPDF = () => {
    const element = document.getElementById('mis-report-content');
    const opt = {
      margin: 0.2,
      filename: `MIS_Report_${consData?.date || 'export'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const consDates = Object.keys(getHistory('consumptionHistory'));
  const billetDates = Object.keys(getHistory('billetHistory'));
  const availableDates = Array.from(new Set([...consDates, ...billetDates]));

  if (!consData || !billetData) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h1 className="page-title" style={{ margin: '0 0 4px' }}>MIS Report</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>Auto-generated from Consumption and Billet Data</p>
          </div>
          <DateFilter 
            selectedDate={selectedDate} 
            onDateChange={handleDateChange} 
            availableDates={availableDates} 
          />
        </div>
        <div className="card" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
          <p style={{ margin: 0, fontSize: '15px' }}>
            {!consData && !billetData 
              ? `No saved Consumption or Billet data found for ${selectedDate}.` 
              : !consData 
                ? `Consumption Report is missing for ${selectedDate}. Please save Consumption Report for this date.` 
                : `Billet Report is missing for ${selectedDate}. Please save Billet Report for this date.`}
          </p>
        </div>
      </div>
    );
  }

  const rawTot = consData.raw.reduce((acc, row) => {
    acc.opening += num(row.opening);
    acc.outside += num(row.outside);
    acc.inhouse += num(row.inhouse);
    acc.received += (num(row.outside) + num(row.inhouse)) || num(row.received);
    acc.trans += num(row.trans);
    acc.consumed += num(row.consumed);
    acc.closing += num(row.closing);
    return acc;
  }, { opening: 0, outside: 0, inhouse: 0, received: 0, trans: 0, consumed: 0, closing: 0 });

  const chargeTot = consData.charge.reduce((acc, row) => {
    acc.opening += num(row.opening);
    acc.outside += num(row.outside);
    acc.inhouse += num(row.inhouse);
    acc.received += num(row.outside) + num(row.inhouse);
    acc.consumed += num(row.consumed);
    acc.closing += num(row.closing);
    acc.metalPct += num(row.metalPct);
    return acc;
  }, { opening: 0, outside: 0, inhouse: 0, received: 0, consumed: 0, closing: 0, metalPct: 0 });

  const totalProdLiquid = consData.summary.totalProd || 0;
  const totalConsumption = chargeTot.consumed; 
  const finishProd = consData.summary.finishProd || 0;
  const loss1 = consData.summary.stdLoss || 0;
  const loss2 = consData.summary.loss2 || 0;

  // Calculate Billet Totals from BilletData
  let totNormal = 0, totTested = 0, totScrap = 0;
  billetData.sizes.forEach(s => {
    s.items.forEach(item => {
      const n = item.name.toLowerCase();
      if (n.includes('normal')) totNormal += num(item.production);
      else if (n.includes('tested')) totTested += num(item.production);
      else totScrap += num(item.production);
    });
  });

  const reportsDiff = num(finishProd) - (totNormal + totTested + totScrap);

  const thStyle = { border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', background: '#f8fafc' };
  const tdStyle = { border: '1px solid #000', padding: '4px', textAlign: 'center', fontSize: '11px', color: '#000' };
  const sectionHeaderStyle = { background: '#e2e8f0', color: '#000', fontWeight: 'bold', fontSize: '12px', padding: '6px', textAlign: 'center', border: '1px solid #000' };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 4px' }}>MIS Report</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Auto-generated from Consumption and Billet Data</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <DateFilter 
            selectedDate={selectedDate} 
            onDateChange={handleDateChange} 
            availableDates={availableDates} 
          />
          <button onClick={() => setEditMode(!editMode)} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', background: editMode ? '#ef4444' : '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
            {editMode ? '✕ Exit Edit Mode' : '✎ Edit Mode'}
          </button>
          <button onClick={downloadPDF} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--acc)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
            <Printer size={16} /> Download PDF
          </button>
        </div>
      </div>

      <div className="scroll">
        <div id="mis-report-content" style={{ background: 'white', width: '100%', minWidth: '900px', border: '2px solid #000' }}>
          
          {/* Header Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: 'none' }}>
            <tbody>
              <tr>
                <td style={{ background: '#1e3a8a', color: 'white', fontWeight: 'bold', fontSize: '16px', padding: '10px', textAlign: 'center', border: '1px solid #000' }}>
                  HINDUSTAN IRON & SPONGE REPORT (BILLET)
                </td>
                <td style={{ background: '#1e3a8a', color: 'white', fontWeight: 'bold', fontSize: '14px', padding: '10px', textAlign: 'center', width: '120px', border: '1px solid #000' }}>
                  {consData.date || billetData.date}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Raw Material Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', borderBottom: 'none' }}>
            <thead>
              <tr>
                <td colSpan="9" style={{ ...sectionHeaderStyle, borderTop: 'none' }}>RAW MATERIAL CONSUMPTION</td>
              </tr>
              <tr>
                <th rowSpan="2" style={{ ...thStyle, width: '22%' }}>MATERIAL</th>
                <th rowSpan="2" style={{ ...thStyle }}>OPENING</th>
                <th colSpan="3" style={{ ...thStyle }}>RECEIVED</th>
                <th rowSpan="2" style={{ ...thStyle }}>ISSUE</th>
                <th rowSpan="2" style={{ ...thStyle }}>TRANS.</th>
                <th rowSpan="2" style={{ ...thStyle }}>CONSUMPTION</th>
                <th rowSpan="2" style={{ ...thStyle }}>CLOSING</th>
              </tr>
              <tr>
                <th style={{ ...thStyle }}>OUT SIDE</th>
                <th style={{ ...thStyle }}>IN HOUSE</th>
                <th style={{ ...thStyle }}>TOTAL RECEIVED</th>
              </tr>
            </thead>
            <tbody>
              {consData.raw.map((r, i) => {
                const rec = (num(r.outside) + num(r.inhouse)) || num(r.received);
                return (
                  <tr key={i}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>{r.name}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.opening)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.outside)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.inhouse)}</td>
                    <td style={{ ...tdStyle }}>{fmt(rec)}</td>
                    <td style={{ ...tdStyle }}>{fmt(0)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.trans)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.consumed)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.closing)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: '#e0f2fe' }}>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.opening)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.outside)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.inhouse)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.received)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(0)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.trans)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.consumed)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.closing)}</td>
              </tr>
            </tbody>
          </table>

          {/* Charge Mix Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', borderBottom: 'none' }}>
            <thead>
              <tr>
                <td colSpan="8" style={{ ...sectionHeaderStyle, borderTop: 'none' }}>CHARGE MIX MATERIAL</td>
              </tr>
              <tr>
                <th rowSpan="2" style={{ ...thStyle, width: '22%' }}>MATERIAL</th>
                <th rowSpan="2" style={{ ...thStyle }}>OPENING</th>
                <th colSpan="3" style={{ ...thStyle }}>RECEIVED</th>
                <th rowSpan="2" style={{ ...thStyle }}>CONSUMPTION</th>
                <th rowSpan="2" style={{ ...thStyle }}>CLOSING</th>
                <th rowSpan="2" style={{ ...thStyle }}>METAL %</th>
              </tr>
              <tr>
                <th style={{ ...thStyle, width: '12%' }}>OUT SIDE</th>
                <th style={{ ...thStyle, width: '12%' }}>IN HOUSE</th>
                <th style={{ ...thStyle, width: '12%' }}>TOTAL RECEIVED</th>
              </tr>
            </thead>
            <tbody>
              {consData.charge.map((r, i) => {
                const rec = num(r.outside) + num(r.inhouse);
                return (
                  <tr key={i}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold', color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{r.name}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.opening)}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.outside)}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.inhouse)}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(rec)}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.consumed)}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.closing)}</td>
                    <td style={{ ...tdStyle, color: r.name.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.metalPct, 2)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: '#e0f2fe' }}>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.opening)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.outside)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.inhouse)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.received)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.consumed)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.closing)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(chargeTot.metalPct, 2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Consumption Totals */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', borderBottom: 'none' }}>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, width: '50%', fontWeight: 'bold', borderTop: 'none' }}>TOTAL PRODUCTION (LIQUID)</td>
                <td style={{ ...tdStyle, width: '50%', fontWeight: 'bold', borderTop: 'none' }}>{fmt(totalProdLiquid)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL CONSUMPTION</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totalConsumption)}</td>
              </tr>
            </tbody>
          </table>

          {/* Billets Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
            <tbody>
              {billetData.sizes.map((s, idx) => {
                const groups = mergeConfig[idx] || [];
                const mergedIndices = new Set(groups.flatMap(g => g.indices));
                const selected = selectedRows[idx] || [];

                // Build render list: merged groups + individual items, sorted by position
                const renderList = [];

                groups.forEach((group, gi) => {
                  const firstIdx = Math.min(...group.indices);
                  const items = group.indices.map(i => s.items[i]).filter(Boolean);
                  renderList.push({
                    id: `group-${gi}`,
                    type: 'merged', position: firstIdx, groupIdx: gi,
                    label: group.label, color: group.color || '#ffffff',
                    opening: items.reduce((a, x) => a + num(x.opening), 0),
                    production: items.reduce((a, x) => a + num(x.production), 0),
                    transfer: items.reduce((a, x) => a + num(x.transfer), 0),
                    returnBillet: items.reduce((a, x) => a + num(x.returnBillet), 0),
                    despatch: items.reduce((a, x) => a + num(x.despatch), 0),
                    closing: items.reduce((a, x) => a + num(x.closing), 0),
                    remarks: items.map(x => x.remarks).filter(Boolean).join(', ')
                  });
                });

                s.items.forEach((item, i) => {
                  if (!mergedIndices.has(i)) {
                    const n = item.name.toLowerCase();
                    let bg = colorConfig[idx]?.[i] || '#ffffff';
                    renderList.push({
                      id: `item-${i}`,
                      type: 'individual', position: i, itemIdx: i,
                      label: `BILLETS ${s.size} (${item.name})`, color: bg,
                      opening: num(item.opening), production: num(item.production),
                      transfer: num(item.transfer), returnBillet: num(item.returnBillet), despatch: num(item.despatch),
                      closing: num(item.closing), remarks: item.remarks || ''
                    });
                  }
                });

                renderList.sort((a, b) => a.position - b.position);
                const customOrder = orderConfig[idx];
                if (customOrder && customOrder.length > 0) {
                  renderList.sort((a, b) => {
                    let ai = customOrder.indexOf(a.id);
                    let bi = customOrder.indexOf(b.id);
                    if (ai === -1) ai = 999;
                    if (bi === -1) bi = 999;
                    return ai - bi;
                  });
                }

                return (
                  <React.Fragment key={idx}>
                    {/* Column header row */}
                    <tr>
                      <td style={{ ...tdStyle, borderTop: '2px solid #000', background: '#f8fafc', width: editMode ? '25%' : '30%' }}></td>
                      {editMode && <th style={{ ...thStyle, borderTop: '2px solid #000', width: '40px' }}>✓</th>}
                      <th style={{ ...thStyle, borderTop: '2px solid #000' }}>OPENING</th>
                      <th style={{ ...thStyle, borderTop: '2px solid #000' }}>PRODUCTION</th>
                      <th style={{ ...thStyle, borderTop: '2px solid #000' }}>TRANSFER</th>
                      <th style={{ ...thStyle, borderTop: '2px solid #000' }}>RETURN BILLET</th>
                      <th style={{ ...thStyle, borderTop: '2px solid #000' }}>DISPATCH</th>
                      <th style={{ ...thStyle, borderTop: '2px solid #000' }}>CLOSING</th>
                      <th style={{ ...thStyle, borderTop: '2px solid #000', width: '18%' }}>REMARK</th>
                    </tr>
                    {renderList.map((row, ri) => (
                      <tr 
                        key={row.id} 
                        draggable={editMode} 
                        onDragStart={(e) => handleDragStart(e, idx, ri)} 
                        onDragOver={handleDragOver} 
                        onDrop={(e) => handleDrop(e, idx, ri, renderList)} 
                        style={editMode ? { cursor: 'grab' } : {}}
                      >
                        <td style={{ ...tdStyle, background: row.color, fontWeight: 'bold', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{row.label}</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {editMode && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {['#86efac', '#fde047', '#bfdbfe', '#ffffff'].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => changeColor(idx, row.type === 'merged' ? row.groupIdx : row.itemIdx, row.type === 'merged', c)}
                                      style={{
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        border: c === '#ffffff' ? '1px solid #ccc' : '1px solid rgba(0,0,0,0.2)',
                                        cursor: 'pointer', background: c, padding: 0,
                                        boxShadow: row.color === c ? '0 0 0 2px #333' : 'none'
                                      }}
                                      title={c === '#ffffff' ? 'Reset to White' : 'Set Color'}
                                    />
                                  ))}
                                </div>
                              )}
                              {editMode && row.type === 'merged' && (
                                <button onClick={() => removeMergeGroup(idx, row.groupIdx)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>Unmerge</button>
                              )}
                            </div>
                          </div>
                        </td>
                        {editMode && (
                          <td style={{ ...tdStyle }}>
                            {row.type === 'individual' && (
                              <input type="checkbox" checked={selected.includes(row.itemIdx)} onChange={() => toggleRow(idx, row.itemIdx)} style={{ cursor: 'pointer' }} />
                            )}
                          </td>
                        )}
                        <td style={{ ...tdStyle }}>{fmt(row.opening)}</td>
                        <td style={{ ...tdStyle }}>{fmt(row.production)}</td>
                        <td style={{ ...tdStyle }}>{fmt(row.transfer)}</td>
                        <td style={{ ...tdStyle }}>{fmt(row.returnBillet)}</td>
                        <td style={{ ...tdStyle }}>{fmt(row.despatch)}</td>
                        <td style={{ ...tdStyle }}>{fmt(row.closing)}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{row.remarks}</td>
                      </tr>
                    ))}
                    {/* Combine button */}
                    {editMode && selected.length >= 2 && (
                      <tr>
                        <td colSpan="10" style={{ ...tdStyle, background: '#f0fdf4', textAlign: 'center' }}>
                          <button onClick={() => combineSelected(idx)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                            ✓ Combine {selected.length} rows
                          </button>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Footer Totals Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, width: '40%', fontWeight: 'bold', textAlign: 'right', paddingRight: '30px' }}>TOTAL CONSUMPTION</td>
                <td style={{ ...tdStyle, fontWeight: 'bold', width: '30%' }}>{fmt(totalConsumption)}</td>
                <td style={{ ...tdStyle, width: '30%' }}></td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '30px' }}>BURNING LOSS + SLAG</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(loss2)}</td>
                <td style={{ ...tdStyle }}></td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right', paddingRight: '30px' }}>TOTAL FINISH MATERIAL</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(finishProd)}</td>
                <td style={{ ...tdStyle }}></td>
              </tr>
            </tbody>
          </table>

          {/* Bottom Split Footer */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #000' }}>
            <tbody>
              <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                <td style={{ ...tdStyle }}>TOTAL</td>
                <td style={{ ...tdStyle }}>QTY</td>
                <td colSpan="2" style={{ ...tdStyle }}>SMS PRODUCTION</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>PRODUCTION (LIQUID)</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totalProdLiquid)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL PRODUCTION (LIQUID)</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totalProdLiquid)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL NORMAL BILLET</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totNormal)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>STANDARD LOSS + LAUNDER LOSS</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(loss1)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL TESTED BILLET</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totTested)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL FINISH MATERIAL (SOLID)</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(finishProd)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL 4.3 meter, 5/4 meter, 2/3 Meter, Scraps/End Cut</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totScrap)}</td>
                <td colSpan="2" rowSpan="2" style={{ border: 'none' }}></td>
              </tr>
              <tr>
                <td colSpan="2" style={{ ...tdStyle, background: '#bfdbfe', fontWeight: 'bold' }}>
                  REPORTS & SMS REPORT DIFFERENCE QTY &nbsp;&nbsp;&nbsp;&nbsp; {fmt(reportsDiff)}
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>

      {combineModal.isOpen && (
        <div className="modal-overlay" onClick={() => setCombineModal({ isOpen: false, sizeIdx: null, label: '', count: 0 })}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Combine {combineModal.count} Selected Rows</h3>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setCombineModal({ isOpen: false, sizeIdx: null, label: '', count: 0 })}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleConfirmCombine}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '8px' }}>
                  Enter Label for Combined Row:
                </label>
                <input 
                  autoFocus 
                  required 
                  type="text" 
                  value={combineModal.label} 
                  onChange={e => setCombineModal(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. Combined Tested Billets"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCombineModal({ isOpen: false, sizeIdx: null, label: '', count: 0 })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#475569',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!combineModal.label.trim()}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: '600',
                    cursor: combineModal.label.trim() ? 'pointer' : 'not-allowed',
                    opacity: combineModal.label.trim() ? 1 : 0.6
                  }}
                >
                  Combine Rows
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
