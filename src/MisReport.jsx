import React, { useState, useEffect } from 'react';
import { Printer, X, Check } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import DateFilter from './DateFilter';
import { normalizeDate, getTodayIso, getHistory, getFromHistory } from './dateHistory';
import './App.css';

// Custom SVG icon matching the exact square + pencil edit icon requested
const EditSquareIcon = ({ size = 15, color = 'currentColor', className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    {/* Rounded open square container */}
    <path
      d="M11 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V13"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Pencil editing out of square */}
    <path
      d="M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z"
      fill={color}
      stroke={color}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

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
  const [nameConfig, setNameConfig] = useState(() => {
    const saved = localStorage.getItem('misNameConfig');
    if (saved) try { return JSON.parse(saved); } catch (e) {}
    return {};
  });
  const [editingNameKey, setEditingNameKey] = useState(null);
  const [editingNameVal, setEditingNameVal] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [headingPresets, setHeadingPresets] = useState(() => {
    const saved = localStorage.getItem('misHeadingPresets');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      'BILLETS 110 * 110 MM',
      'BILLETS 125 * 125 MM',
      'BILLETS 160 * 160 MM',
      '5/4 meter, 2/3 Meter, Scraps/End Cut',
      '4.3 meter, 5/4 meter, 2/3 Meter, Scraps/End Cut'
    ];
  });
  const [isAddingNewPreset, setIsAddingNewPreset] = useState(false);
  const [newPresetVal, setNewPresetVal] = useState('');
  const [combineModal, setCombineModal] = useState({ isOpen: false, sizeIdx: null, label: '', suffixType: 'Tested', count: 0 });

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

  useEffect(() => {
    localStorage.setItem('misNameConfig', JSON.stringify(nameConfig));
  }, [nameConfig]);

  useEffect(() => {
    localStorage.setItem('misHeadingPresets', JSON.stringify(headingPresets));
  }, [headingPresets]);

  const handleAddNewPreset = (e) => {
    if (e) e.preventDefault();
    const val = newPresetVal.trim();
    if (!val) return;
    if (!headingPresets.includes(val)) {
      setHeadingPresets(prev => [...prev, val]);
    }
    setCombineModal(prev => ({ ...prev, label: val }));
    setNewPresetVal('');
    setIsAddingNewPreset(false);
  };

  const handleStartEditName = (key, currentVal) => {
    setEditingNameKey(key);
    setEditingNameVal(currentVal);
  };

  const handleSaveName = (key) => {
    setNameConfig(prev => {
      const next = { ...prev };
      if (editingNameVal.trim()) {
        next[key] = editingNameVal.trim();
      } else {
        delete next[key];
      }
      return next;
    });
    setEditingNameKey(null);
    setEditingNameVal('');
  };

  const handleCancelEditName = () => {
    setEditingNameKey(null);
    setEditingNameVal('');
  };

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
      label: headingPresets[0] || 'BILLETS 110 * 110 MM',
      suffixType: 'Tested',
      count: selected.length
    });
    setIsAddingNewPreset(false);
    setNewPresetVal('');
  };

  const handleConfirmCombine = (e) => {
    if (e) e.preventDefault();
    const { sizeIdx, label, suffixType } = combineModal;
    if (!label.trim()) return;

    const selected = selectedRows[sizeIdx];
    if (!selected || selected.length < 2) {
      setCombineModal({ isOpen: false, sizeIdx: null, label: '', suffixType: 'Tested', count: 0 });
      return;
    }

    let finalLabel = label.trim();
    let defaultColor = '#ffffff';

    if (suffixType && suffixType !== 'None') {
      finalLabel = `${finalLabel} ( ${suffixType} )`;
      if (suffixType === 'Normal') defaultColor = '#86efac';
      else if (suffixType === 'Tested') defaultColor = '#fde047';
      else if (suffixType === 'Random') defaultColor = '#bfdbfe';
    }

    const indices = [...selected].sort((a, b) => a - b);
    const newGroup = { label: finalLabel, indices, color: defaultColor };
    setMergeConfig(prev => {
      const existing = prev[sizeIdx] || [];
      const filtered = existing.filter(g => !g.indices.some(i => indices.includes(i)));
      return { ...prev, [sizeIdx]: [...filtered, newGroup] };
    });
    setSelectedRows(prev => ({ ...prev, [sizeIdx]: [] }));
    setCombineModal({ isOpen: false, sizeIdx: null, label: '', suffixType: 'Tested', count: 0 });
  };

  // 1-Click Auto Merge by Color for all sizes
  const autoMergeByColor = () => {
    if (!billetData || !billetData.sizes) return;
    const newMergeConfig = {};

    billetData.sizes.forEach((s, sIdx) => {
      const greenIndices = [];
      const yellowIndices = [];
      const blueIndices = [];

      s.items.forEach((item, itemIdx) => {
        const c = (colorConfig[sIdx]?.[itemIdx] || '').toLowerCase();
        if (c === '#86efac') {
          greenIndices.push(itemIdx);
        } else if (c === '#fde047') {
          yellowIndices.push(itemIdx);
        } else if (c === '#bfdbfe') {
          blueIndices.push(itemIdx);
        } else {
          // Fallback based on item name if color not yet explicitly set
          const n = (item.name || '').toLowerCase();
          if (n.includes('normal')) greenIndices.push(itemIdx);
          else if (n.includes('tested')) yellowIndices.push(itemIdx);
          else blueIndices.push(itemIdx);
        }
      });

      const groups = [];
      if (greenIndices.length >= 2) {
        groups.push({
          label: `BILLETS ${s.size} ( Normal )`,
          indices: greenIndices.sort((a, b) => a - b),
          color: '#86efac'
        });
      }
      if (yellowIndices.length >= 2) {
        groups.push({
          label: `BILLETS ${s.size} ( Tested )`,
          indices: yellowIndices.sort((a, b) => a - b),
          color: '#fde047'
        });
      }
      if (blueIndices.length >= 2) {
        groups.push({
          label: `${s.size.includes('160') ? '4.3 meter, 5/4 meter, 2/3 Meter, Scraps/End Cut' : '5/4 meter, 2/3 Meter, Scraps/End Cut'} ( Random )`,
          indices: blueIndices.sort((a, b) => a - b),
          color: '#bfdbfe'
        });
      }

      if (groups.length > 0) {
        newMergeConfig[sIdx] = groups;
      }
    });

    setMergeConfig(newMergeConfig);
    setSelectedRows({});
  };

  const resetAllMerges = () => {
    if (window.confirm('Are you sure you want to unmerge all rows back to individual rows?')) {
      setMergeConfig({});
      setSelectedRows({});
    }
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
    if (!element) return;

    // Apply print-fit class temporarily
    element.classList.add('mis-pdf-single-page');

    const opt = {
      margin: [0.15, 0.15, 0.15, 0.15],
      filename: `MIS_Report_${consData?.date || 'export'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all'] }
    };

    html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
      const totalPages = pdf.internal.getNumberOfPages();
      if (totalPages > 1) {
        for (let i = totalPages; i > 1; i--) {
          pdf.deletePage(i);
        }
      }
    }).save().then(() => {
      element.classList.remove('mis-pdf-single-page');
    }).catch(() => {
      element.classList.remove('mis-pdf-single-page');
    });
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
    acc.kgTon += num(row.kgTon);
    acc.kgHeat += num(row.kgHeat);
    return acc;
  }, { opening: 0, outside: 0, inhouse: 0, received: 0, trans: 0, consumed: 0, closing: 0, kgTon: 0, kgHeat: 0 });

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

  // Calculate Billet Totals from BilletData based on assigned colors (Green, Yellow, Blue)
  let totNormal = 0, totTested = 0, totScrap = 0;
  billetData.sizes.forEach((s, sIdx) => {
    const groups = mergeConfig[sIdx] || [];
    const mergedIndices = new Set(groups.flatMap(g => g.indices));

    // Sum merged rows by group color
    groups.forEach(g => {
      const prodSum = (g.indices || []).reduce((acc, i) => acc + num(s.items[i]?.production), 0);
      const c = (g.color || '').toLowerCase();
      if (c === '#86efac') {
        totNormal += prodSum;
      } else if (c === '#fde047') {
        totTested += prodSum;
      } else if (c === '#bfdbfe') {
        totScrap += prodSum;
      } else {
        // Fallback by name if uncolored
        const n = (g.label || '').toLowerCase();
        if (n.includes('normal')) totNormal += prodSum;
        else if (n.includes('tested')) totTested += prodSum;
        else totScrap += prodSum;
      }
    });

    // Sum individual rows by item color
    s.items.forEach((item, i) => {
      if (!mergedIndices.has(i)) {
        const prod = num(item.production);
        const c = (colorConfig[sIdx]?.[i] || '').toLowerCase();
        if (c === '#86efac') {
          totNormal += prod;
        } else if (c === '#fde047') {
          totTested += prod;
        } else if (c === '#bfdbfe') {
          totScrap += prod;
        } else {
          // Fallback by name if uncolored
          const n = (item.name || '').toLowerCase();
          if (n.includes('normal')) totNormal += prod;
          else if (n.includes('tested')) totTested += prod;
          else totScrap += prod;
        }
      }
    });
  });

  const totalFinishMaterialFromBillets = totNormal + totTested + totScrap;
  const reportsDiff = num(finishProd) - totalFinishMaterialFromBillets;

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
          {editMode && (
            <>
              <button 
                onClick={autoMergeByColor} 
                style={{ 
                  whiteSpace: 'nowrap', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: '#6366f1', 
                  color: 'white', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: '600' 
                }}
                title="Automatically combine rows by their colors (Green, Yellow, Blue)"
              >
                ⚡ Auto Merge by Color
              </button>
              <button 
                onClick={resetAllMerges} 
                style={{ 
                  whiteSpace: 'nowrap', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: '#f8fafc', 
                  color: '#dc2626', 
                  border: '1px solid #fca5a5', 
                  padding: '8px 14px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontWeight: '500' 
                }}
                title="Reset all merged rows back to individual rows"
              >
                Unmerge All
              </button>
            </>
          )}
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
                <td colSpan="11" style={{ ...sectionHeaderStyle, borderTop: 'none' }}>RAW MATERIAL CONSUMPTION</td>
              </tr>
              <tr>
                <th rowSpan="2" style={{ ...thStyle, width: '20%' }}>MATERIAL</th>
                <th rowSpan="2" style={{ ...thStyle }}>OPENING</th>
                <th colSpan="3" style={{ ...thStyle }}>RECEIVED</th>
                <th rowSpan="2" style={{ ...thStyle }}>ISSUE</th>
                <th rowSpan="2" style={{ ...thStyle }}>TRANS.</th>
                <th rowSpan="2" style={{ ...thStyle }}>CONSUMPTION</th>
                <th rowSpan="2" style={{ ...thStyle }}>CLOSING</th>
                <th rowSpan="2" style={{ ...thStyle }}>KG/TON</th>
                <th rowSpan="2" style={{ ...thStyle }}>KG/HEAT</th>
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
                const rawKey = `raw-${i}`;
                const displayName = nameConfig[rawKey] || r.name;
                const isEditingThis = editingNameKey === rawKey;

                return (
                  <tr key={i}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        {isEditingThis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <input
                              autoFocus
                              type="text"
                              value={editingNameVal}
                              onChange={e => setEditingNameVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveName(rawKey);
                                if (e.key === 'Escape') handleCancelEditName();
                              }}
                              style={{ flex: 1, padding: '2px 6px', fontSize: '11px', border: '1px solid #3b82f6', borderRadius: '4px' }}
                            />
                            <button
                              onClick={() => handleSaveName(rawKey)}
                              style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={handleCancelEditName}
                              style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span>{displayName}</span>
                            {editMode && (
                              <button
                                onClick={() => handleStartEditName(rawKey, displayName)}
                                style={{ background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                title="Edit row name"
                              >
                                <EditSquareIcon size={14} color="#0f172a" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle }}>{fmt(r.opening)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.outside)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.inhouse)}</td>
                    <td style={{ ...tdStyle }}>{fmt(rec)}</td>
                    <td style={{ ...tdStyle }}>{fmt(0)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.trans)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.consumed)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.closing)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.kgTon)}</td>
                    <td style={{ ...tdStyle }}>{fmt(r.kgHeat)}</td>
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
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.kgTon)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(rawTot.kgHeat)}</td>
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
                const chargeKey = `charge-${i}`;
                const displayName = nameConfig[chargeKey] || r.name;
                const isEditingThis = editingNameKey === chargeKey;

                return (
                  <tr key={i}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 'bold', color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        {isEditingThis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <input
                              autoFocus
                              type="text"
                              value={editingNameVal}
                              onChange={e => setEditingNameVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveName(chargeKey);
                                if (e.key === 'Escape') handleCancelEditName();
                              }}
                              style={{ flex: 1, padding: '2px 6px', fontSize: '11px', border: '1px solid #3b82f6', borderRadius: '4px' }}
                            />
                            <button
                              onClick={() => handleSaveName(chargeKey)}
                              style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Save"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={handleCancelEditName}
                              style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span>{displayName}</span>
                            {editMode && (
                              <button
                                onClick={() => handleStartEditName(chargeKey, displayName)}
                                style={{ background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                title="Edit row name"
                              >
                                <EditSquareIcon size={14} color="#0f172a" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.opening)}</td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.outside)}</td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.inhouse)}</td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(rec)}</td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.consumed)}</td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.closing)}</td>
                    <td style={{ ...tdStyle, color: displayName.toLowerCase().includes('tested') ? '#dc2626' : '#000' }}>{fmt(r.metalPct, 2)}</td>
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
                  const nameKey = `group-${idx}-${gi}`;
                  const effectiveLabel = nameConfig[nameKey] || group.label;
                  renderList.push({
                    id: `group-${gi}`,
                    nameKey,
                    type: 'merged', position: firstIdx, groupIdx: gi,
                    label: effectiveLabel, color: group.color || '#ffffff',
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
                    let bg = colorConfig[idx]?.[i] || '#ffffff';
                    const nameKey = `billet-${idx}-${i}`;
                    const defaultLabel = i === 0 ? `BILLETS ${s.size} (${item.name})` : item.name;
                    const effectiveLabel = nameConfig[nameKey] || defaultLabel;
                    renderList.push({
                      id: `item-${i}`,
                      nameKey,
                      type: 'individual', position: i, itemIdx: i,
                      label: effectiveLabel, color: bg,
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
                    {renderList.map((row, ri) => {
                      const isEditingThis = editingNameKey === row.nameKey;

                      return (
                        <tr 
                          key={row.id} 
                          draggable={editMode} 
                          onDragStart={(e) => handleDragStart(e, idx, ri)} 
                          onDragOver={handleDragOver} 
                          onDrop={(e) => handleDrop(e, idx, ri, renderList)} 
                          style={editMode ? { cursor: 'grab' } : {}}
                        >
                          <td style={{ ...tdStyle, background: row.color, fontWeight: 'bold', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              {isEditingThis ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editingNameVal}
                                    onChange={e => setEditingNameVal(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveName(row.nameKey);
                                      if (e.key === 'Escape') handleCancelEditName();
                                    }}
                                    style={{ flex: 1, padding: '2px 6px', fontSize: '11px', border: '1px solid #3b82f6', borderRadius: '4px' }}
                                  />
                                  <button
                                    onClick={() => handleSaveName(row.nameKey)}
                                    style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title="Save"
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    onClick={handleCancelEditName}
                                    style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', padding: '2px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    title="Cancel"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{row.label}</span>
                                    {editMode && (
                                      <button
                                        onClick={() => handleStartEditName(row.nameKey, row.label)}
                                        style={{ background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                        title="Edit row name"
                                      >
                                        <EditSquareIcon size={14} color="#0f172a" />
                                      </button>
                                    )}
                                  </div>
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
                                </>
                              )}
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
                      );
                    })}
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
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totalFinishMaterialFromBillets)}</td>
                <td style={{ ...tdStyle }}></td>
              </tr>
            </tbody>
          </table>

          {/* Bottom Split Footer */}
          <table className="mis-footer-split-table" style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #000' }}>
            <tbody>
              <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                <td style={{ ...tdStyle }}>TOTAL</td>
                <td style={{ ...tdStyle }}>QTY</td>
                <td colSpan="2" className="mis-light-blue" style={{ ...tdStyle, background: '#bfdbfe' }}>SMS PRODUCTION</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>PRODUCTION (LIQUID)</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totalProdLiquid)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL PRODUCTION (LIQUID)</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(totalProdLiquid)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold', background: '#86efac' }}>TOTAL NORMAL BILLET</td>
                <td style={{ ...tdStyle, fontWeight: 'bold', background: '#86efac' }}>{fmt(totNormal)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>STANDARD LOSS + LAUNDER LOSS</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(loss1)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold', background: '#fde047' }}>TOTAL TESTED BILLET</td>
                <td style={{ ...tdStyle, fontWeight: 'bold', background: '#fde047' }}>{fmt(totTested)}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>TOTAL FINISH MATERIAL (SOLID)</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(finishProd)}</td>
              </tr>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 'bold', background: '#bfdbfe' }}>TOTAL 4.3 meter, 5/4 meter, 2/3 Meter, Scraps/End Cut</td>
                <td style={{ ...tdStyle, fontWeight: 'bold', background: '#bfdbfe' }}>{fmt(totScrap)}</td>
                <td colSpan="2" style={{ border: 'none' }}></td>
              </tr>
              <tr>
                <td 
                  colSpan="2"
                  className="mis-light-blue"
                  style={{ 
                    ...tdStyle, 
                    fontWeight: 'bold',
                    background: '#bfdbfe',
                    color: '#000000',
                    textAlign: 'center'
                  }}
                >
                  REPORTS & SMS REPORT DIFFERENCE QTY
                </td>
                <td 
                  colSpan="2"
                  style={{ 
                    ...tdStyle, 
                    fontWeight: 'bold',
                    background: Math.abs(reportsDiff) > 0.0001 ? '#fee2e2' : '#ffffff', 
                    color: Math.abs(reportsDiff) > 0.0001 ? '#dc2626' : '#000000',
                    textAlign: 'center'
                  }}
                >
                  {fmt(reportsDiff)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#475569' }}>
                    Select Heading / Name for Combined Row:
                  </label>
                  {!isAddingNewPreset ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewPreset(true)}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      + Add New
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewPreset(false)}
                      style={{
                        background: '#f8fafc',
                        color: '#64748b',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {isAddingNewPreset ? (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input
                      autoFocus
                      type="text"
                      value={newPresetVal}
                      onChange={e => setNewPresetVal(e.target.value)}
                      placeholder="e.g. BILLETS 200 * 200 MM"
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #3b82f6',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewPreset();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewPreset}
                      disabled={!newPresetVal.trim()}
                      style={{
                        padding: '10px 16px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: newPresetVal.trim() ? 'pointer' : 'not-allowed',
                        opacity: newPresetVal.trim() ? 1 : 0.6
                      }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    value={combineModal.label}
                    onChange={e => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingNewPreset(true);
                      } else {
                        setCombineModal(prev => ({ ...prev, label: e.target.value }));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: '16px',
                      background: 'white',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {headingPresets.map(preset => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                    <option value="__add_new__" style={{ color: '#2563eb', fontWeight: 'bold' }}>
                      + Add New Heading...
                    </option>
                  </select>
                )}

                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '8px' }}>
                  Select Type Tag:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '( Normal )', value: 'Normal', bg: '#86efac', border: '#16a34a' },
                    { label: '( Tested )', value: 'Tested', bg: '#fde047', border: '#ca8a04' },
                    { label: '( Random )', value: 'Random', bg: '#bfdbfe', border: '#2563eb' },
                    { label: 'None', value: 'None', bg: '#f1f5f9', border: '#94a3b8' }
                  ].map(opt => {
                    const isSelected = combineModal.suffixType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCombineModal(prev => ({ ...prev, suffixType: opt.value }))}
                        style={{
                          flex: '1 1 45%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                          border: isSelected ? `2px solid ${opt.border}` : '1px solid #e2e8f0',
                          background: opt.bg,
                          color: '#0f172a',
                          boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        {isSelected && <span>✓</span>}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
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
