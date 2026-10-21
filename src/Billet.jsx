import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Printer, FileDown, Save, Check, Edit2, Trash2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { extractAndVerify, formatIssue } from './imageExtract';
import DateFilter from './DateFilter';
import { normalizeDate, getTodayIso, getHistory, saveToHistory } from './dateHistory';

const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const has = v => v !== null && v !== undefined && String(v).trim() !== '';
const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const KEYS = ['opening', 'production', 'despatch', 'transfer', 'returnBillet', 'closing'];
const LABELS = ['Opening', 'Production', 'Despatch', 'Transfer', 'Return Billet', 'Closing'];
const sum = (a, k) => a.reduce((t, x) => t + (num(x[k])), 0);
const renderCell = (v, cls = '', label = '', key = undefined) => <td key={key} data-label={label} className={`${cls} ${v < 0 ? 'neg' : ''}`}>{fmt(v, 3)}</td>;

function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  let title = '', date = '';
  rows.forEach(r => r.forEach(c => {
    if (typeof c !== 'string') return;
    if (/billet.*report/i.test(c) && !title) title = c.trim();
    if (/^\s*date/i.test(c) && !date) date = c.replace(/^\s*date\s*[-:]?\s*/i, '').replace(/\s*\/\s*/g, '/').trim();
  }));

  const secs = [];
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i][0];
    if (!(typeof a === 'string' && /^\s*size/i.test(a))) continue;
    const sec = { size: a.replace(/^\s*size\s*/i, '').trim(), items: [], fileTotals: null };
    let j = i + 1;
    while (j < rows.length && String(rows[j][1] || '').trim().toLowerCase() !== 'items') {
      if (typeof rows[j][0] === 'string' && /^\s*size/i.test(rows[j][0])) break;
      j++;
    }
    if (j >= rows.length || String(rows[j][1] || '').trim().toLowerCase() !== 'items') continue;
    
    // Find column indexes dynamically from the header row
    const headerRow = rows[j] || [];
    let closingCol = -1;
    let remarksCol = -1;
    let returnCol = -1;

    headerRow.forEach((c, idx) => {
      if (typeof c !== 'string') return;
      const lower = c.trim().toLowerCase();
      if (/return/i.test(lower)) returnCol = idx;
      else if (/closing|stock|balance/i.test(lower)) closingCol = idx;
      else if (/remark/i.test(lower)) remarksCol = idx;
    });

    // Defaults if headers weren't named with words
    const hasReturnCol = returnCol !== -1;
    if (closingCol === -1) closingCol = hasReturnCol ? 7 : 6;
    if (remarksCol === -1) remarksCol = closingCol + 1;

    for (j = j + 1; j < rows.length; j++) {
      const r = rows[j];
      if (!has(r[1])) {
        if (has(r[2]) || has(r[closingCol])) {
          sec.fileTotals = {
            opening: num(r[2]),
            production: num(r[3]),
            despatch: num(r[4]),
            transfer: num(r[5]),
            returnBillet: hasReturnCol ? num(r[returnCol]) : 0,
            closing: num(r[closingCol])
          };
        }
        break;
      }

      sec.items.push({
        name: String(r[1]).trim(),
        opening: num(r[2]),
        production: num(r[3]),
        despatch: num(r[4]),
        transfer: num(r[5]),
        returnBillet: hasReturnCol ? num(r[returnCol]) : 0,
        remarks: has(r[remarksCol]) ? String(r[remarksCol]).trim() : '',
        fileClosing: has(r[closingCol]) ? num(r[closingCol]) : null
      });
    }
    secs.push(sec);
  }
  return buildReport(title, date, secs, 'Excel');
}

// Calculates closing, totals and warnings; shared by Excel and image extraction
function buildReport(title, date, secs, source) {
  const sizes = [], warns = [];
  secs.forEach(sec => {
    sec.items.forEach(it => {
      // Return Billet is added back to stock: Closing = Opening + Production + Return Billet - Despatch - Transfer
      const ret = num(it.returnBillet);
      it.closing = Math.round((it.opening + it.production + ret - it.despatch - it.transfer) * 1000) / 1000;
      if (Math.abs(it.closing) < 0.00001) it.closing = 0;
      if (it.fileClosing !== null && Math.abs(it.fileClosing - it.closing) > 0.001)
        warns.push(`${sec.size}: ${it.name} ka closing ${source} me ${fmt(it.fileClosing, 3)} hai, jabki calculated ${fmt(it.closing, 3)} hai.`);
      if (it.closing < -0.0009) warns.push(`${sec.size}: ${it.name} ka closing negative hai (${fmt(it.closing, 3)}).`);
    });
    sec.totals = {};
    KEYS.forEach(k => sec.totals[k] = sum(sec.items, k));
    sizes.push(sec);
  });
  const grand = {};
  KEYS.forEach(k => grand[k] = sizes.reduce((t, s) => t + s.totals[k], 0));
  return { title, date, sizes, grand, warns };
}

export default function Billet() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const saved = localStorage.getItem('billetData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date) return normalizeDate(parsed.date);
      } catch (e) {}
    }
    return getTodayIso();
  });

  const [data, setData] = useState(() => {
    const hist = getHistory('billetHistory');
    const today = getTodayIso();
    if (hist[today]) return hist[today];
    const saved = localStorage.getItem('billetData');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return null; }
    }
    return null;
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleDateChange = (newIsoDate) => {
    setSelectedDate(newIsoDate);
    const hist = getHistory('billetHistory');
    if (hist[newIsoDate]) {
      setData(hist[newIsoDate]);
    } else {
      const saved = localStorage.getItem('billetData');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (normalizeDate(parsed.date) === newIsoDate) {
            setData(parsed);
            return;
          }
        } catch (e) {}
      }
      setData(null);
    }
  };

  const handleSaveData = () => {
    if (!data) return;
    const dateKey = normalizeDate(data.date) || selectedDate;
    saveToHistory('billetHistory', dateKey, data);
    localStorage.setItem('billetData', JSON.stringify(data));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImgOver, setIsImgOver] = useState(false);
  const [imgStatus, setImgStatus] = useState('');
  const [showAddForm, setShowAddForm] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [addFormData, setAddFormData] = useState({ name: '', opening: 0, production: 0, despatch: 0, transfer: 0, remarks: '' });

  const loadSheet = (wb, name) => {
    setSelectedSheet(name);
    const parsedData = parseSheet(wb.Sheets[name]);
    if (!parsedData.sizes.length) {
      alert('The expected data format was not found in this sheet.');
      return;
    }
    setData(parsedData);
    if (parsedData.date) {
      const d = normalizeDate(parsedData.date);
      if (d) setSelectedDate(d);
    }
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (showAddForm === null) return;
    
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, sizes: [...prev.sizes] };
      const sizeSec = { ...next.sizes[showAddForm], items: [...next.sizes[showAddForm].items] };
      
      const newItem = {
        name: addFormData.name,
        opening: num(addFormData.opening),
        production: num(addFormData.production),
        despatch: num(addFormData.despatch),
        transfer: num(addFormData.transfer),
        returnBillet: num(addFormData.returnBillet),
        remarks: addFormData.remarks
      };
      newItem.closing = Math.round((newItem.opening + newItem.production + newItem.returnBillet - newItem.despatch - newItem.transfer) * 1000) / 1000;
      
      if (editIndex !== null) {
        sizeSec.items[editIndex] = newItem;
      } else {
        sizeSec.items.push(newItem);
      }
      
      sizeSec.totals = {};
      KEYS.forEach(k => sizeSec.totals[k] = sum(sizeSec.items, k));
      
      next.sizes[showAddForm] = sizeSec;
      
      const grand = {};
      KEYS.forEach(k => grand[k] = next.sizes.reduce((t, s) => t + s.totals[k], 0));
      next.grand = grand;
      
      return next;
    });
    
    setShowAddForm(null);
    setEditIndex(null);
    setAddFormData({ name: '', opening: 0, production: 0, despatch: 0, transfer: 0, returnBillet: 0, remarks: '' });
  };

  const openAdd = (sizeIdx) => {
    setShowAddForm(sizeIdx);
    setEditIndex(null);
    setAddFormData({ name: '', opening: 0, production: 0, despatch: 0, transfer: 0, returnBillet: 0, remarks: '' });
  };

  const openEdit = (sizeIdx, itemIdx) => {
    setShowAddForm(sizeIdx);
    setEditIndex(itemIdx);
    const item = data.sizes[sizeIdx].items[itemIdx];
    setAddFormData({
      name: item.name, opening: item.opening, production: item.production, 
      despatch: item.despatch, transfer: item.transfer, returnBillet: num(item.returnBillet), remarks: item.remarks
    });
  };

  const handleDelete = (sizeIdx, itemIdx) => {
    if (!window.confirm('Are you sure you want to delete this row?')) return;
    setData(prev => {
      if (!prev) return prev;
      const next = { ...prev, sizes: [...prev.sizes] };
      const sizeSec = { ...next.sizes[sizeIdx], items: [...next.sizes[sizeIdx].items] };
      
      sizeSec.items.splice(itemIdx, 1);
      
      sizeSec.totals = {};
      KEYS.forEach(k => sizeSec.totals[k] = sum(sizeSec.items, k));
      next.sizes[sizeIdx] = sizeSec;
      
      const grand = {};
      KEYS.forEach(k => grand[k] = next.sizes.reduce((t, s) => t + s.totals[k], 0));
      next.grand = grand;
      
      return next;
    });
  };

  const handleImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file (png, jpg, webp).'); return; }
    try {
      const { data: ex, issues, verifyError } = await extractAndVerify('billet', file, setImgStatus);
      const secs = (ex.sizes || []).map(s => ({
        size: String(s.size || '').replace(/^\s*size\s*/i, '').trim(),
        fileTotals: s.fileTotals || null,
        items: (s.items || []).map(it => ({
          name: String(it.name || '').trim(), opening: num(it.opening), production: num(it.production), despatch: num(it.despatch), transfer: num(it.transfer), returnBillet: num(it.returnBillet),
          remarks: has(it.remarks) ? String(it.remarks).trim() : '', fileClosing: has(it.fileClosing) ? num(it.fileClosing) : null
        }))
      })).filter(s => s.items.length);
      if (!secs.length) { alert('Image me expected data nahi mila.'); return; }
      const report = buildReport(ex.title || '', ex.date || '', secs, 'image');
      report.verifyNotes = issues.map(i => `Verifier correction — ${formatIssue(i)}`);
      if (verifyError) report.verifyNotes.push(`Verification fail hui, data unverified hai: ${verifyError}`);
      report.verified = !verifyError && !issues.length;
      setData(report);
      if (report.date) {
        const d = normalizeDate(report.date);
        if (d) setSelectedDate(d);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setImgStatus('');
    }
  };

  const handleFile = (file) => {
    const rd = new FileReader();
    rd.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      if (wb.SheetNames.length > 0) {
        let targetSheet = wb.SheetNames[0];
        const match = wb.SheetNames.find(n => n.toLowerCase().includes('billet'));
        if (match) targetSheet = match;
        loadSheet(wb, targetSheet);
      }
    };
    rd.readAsArrayBuffer(file);
  };

  const downloadCsv = () => {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const L = [['Date', data.date], ['Size', 'Item', 'Opening', 'Production', 'Despatch', 'Transfer', 'Return Billet', 'Closing', 'Remarks']];
    data.sizes.forEach(s => {
      s.items.forEach(x => L.push([s.size, x.name, x.opening, x.production, x.despatch, x.transfer, x.returnBillet || 0, x.closing, x.remarks]));
      L.push([s.size, 'TOTAL', s.totals.opening, s.totals.production, s.totals.despatch, s.totals.transfer, s.totals.returnBillet || 0, s.totals.closing, '']);
    });
    const csvContent = '\ufeff' + L.map(r => r.map(q).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billet_report_${data.date.replace(/[^\w.-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const element = document.getElementById('billet-out');
    const opt = {
      margin: 0.5,
      filename: `billet_report_${data.date.replace(/[^\w.-]+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const availableDates = Object.keys(getHistory('billetHistory'));

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 4px' }}>Billet Report</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Upload Excel or Image file — size-wise data will be automatically extracted.</p>
        </div>
        <DateFilter 
          selectedDate={selectedDate} 
          onDateChange={handleDateChange} 
          availableDates={availableDates} 
        />
      </div>

      <label 
        className={`drop ${isDragOver ? 'over' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
      >
        <input type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={e => handleFile(e.target.files[0])} />
        <div><b>Drop Excel file here</b> or click to select</div>
      </label>

      <label
        className={`drop ${isImgOver ? 'over' : ''}`}
        style={{ marginTop: '12px' }}
        onDragOver={e => { e.preventDefault(); setIsImgOver(true); }}
        onDragLeave={() => setIsImgOver(false)}
        onDrop={e => { e.preventDefault(); setIsImgOver(false); handleImage(e.dataTransfer.files[0]); }}
      >
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!!imgStatus} onChange={e => { handleImage(e.target.files[0]); e.target.value = ''; }} />
        <div>{imgStatus ? <b>{imgStatus}</b> : <><b>Drop Image here</b> or click to select (AI extraction + verification)</>}</div>
      </label>

      {data && (
        <div id="billet-out" style={{ marginTop: '24px' }}>
          <div className="bar">
            {sheetNames.length > 1 && (
              <select value={selectedSheet} onChange={e => loadSheet(workbook, e.target.value)}>
                {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <button onClick={downloadPDF} style={{display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--acc)', color: 'white'}}>
              <Printer size={16} /> Download PDF
            </button>
            <button onClick={downloadCsv} style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: 'var(--ink)'}}>
              <FileDown size={16} /> Download Excel
            </button>
            <button 
              onClick={handleSaveData} 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                background: isSaved ? '#10b981' : '#2563eb', 
                color: '#fff', 
                fontWeight: '600',
                transition: 'background 0.2s'
              }}
            >
              {isSaved ? <Check size={16} /> : <Save size={16} />} 
              {isSaved ? 'Saved Locally!' : 'Save Report'}
            </button>
          </div>

          {data.verified && <div className="warn" style={{ marginTop: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '8px' }}>✔ Image data verified — second pass me koi mismatch nahi mila.</div>}
          {data.verifyNotes?.length > 0 && (
            <div className="warn" style={{ marginTop: '16px', background: '#fff4e5', border: '1px solid #ffcc80', padding: '12px', borderRadius: '8px' }}>
              {data.verifyNotes.map((w, i) => <div key={i}>🔍 {w}</div>)}
            </div>
          )}

          {data.warns && data.warns.length > 0 && (
            <div className="warn" style={{ marginTop: '16px', background: '#fff4e5', border: '1px solid #ffcc80', padding: '12px', borderRadius: '8px' }}>
              {data.warns.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          <div className="erp-kpis" style={{ marginTop: '16px' }}>
            <div className="erp-kpi-card"><span>Date</span><b>{data.date || '-'}</b></div>
            <div className="erp-kpi-card"><span>Total Production</span><b>{fmt(data.grand.production)} MT</b></div>
            <div className="erp-kpi-card"><span>Total Despatch</span><b>{fmt(data.grand.despatch)} MT</b></div>
            <div className="erp-kpi-card"><span>Total Closing</span><b>{fmt(data.grand.closing)} MT</b></div>
          </div>

          <div className="card">
            <h2>Size-wise Summary</h2>
            <div className="scroll">
              <table className="responsive-table">
                <thead>
                  <tr><th style={{textAlign: 'left'}}>Size</th><th>Opening</th><th>Production</th><th>Despatch</th><th>Transfer</th><th>Return Billet</th><th>Closing</th></tr>
                </thead>
                <tbody>
                  {data.sizes.map((s, i) => (
                    <tr key={i}>
                      <td data-label="Size" style={{textAlign: 'left'}}>{s.size}</td>
                      {KEYS.map((k, idx) => renderCell(s.totals[k], '', LABELS[idx], k))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Total" style={{textAlign: 'left'}}>Grand Total</td>
                    {KEYS.map((k, idx) => renderCell(data.grand[k], '', LABELS[idx], k))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {data.sizes.map((s, i) => (
            <div className="card" key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0 }}>Size {s.size}</h2>
                <button onClick={() => openAdd(i)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Add</button>
              </div>
              <div className="scroll">
                <table className="responsive-table">
                  <thead>
                    <tr><th style={{textAlign: 'left'}}>Item</th><th>Opening</th><th>Production</th><th>Despatch</th><th>Transfer</th><th>Return Billet</th><th>Closing</th><th style={{textAlign: 'left'}}>Remarks</th><th style={{textAlign: 'center', width: '100px'}}>Action</th></tr>
                  </thead>
                  <tbody>
                    {s.items.map((x, j) => (
                      <tr key={j} className={x.closing < 0 ? 'neg-row' : ''}>
                        <td data-label="Item" style={{textAlign: 'left'}}>{x.name}</td>
                        {KEYS.map((k, idx) => renderCell(x[k], '', LABELS[idx], k))}
                        <td data-label="Remarks" style={{textAlign: 'left'}}>{x.remarks}</td>
                        <td data-label="Action" style={{textAlign: 'center'}}>
                          <div style={{display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center'}}>
                            <button 
                              type="button"
                              onClick={() => openEdit(i, j)} 
                              style={{ padding: '6px', background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDelete(i, j)} 
                              style={{ padding: '6px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td data-label="Total" style={{textAlign: 'left'}}>Total</td>
                      {KEYS.map((k, idx) => renderCell(s.totals[k], '', LABELS[idx], k))}
                      <td data-label=""></td>
                      <td data-label=""></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', width: '600px', maxWidth: '95%', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '20px' }}>{editIndex !== null ? 'Edit Item in Size' : 'Add Item to Size'} {data.sizes[showAddForm]?.size}</h3>
              <button onClick={() => setShowAddForm(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Item Name *</label>
                <input required value={addFormData.name} onChange={e => setAddFormData({...addFormData, name: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} placeholder="e.g. 5/4 mtr Billets" />
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Opening</label>
                  <input type="number" step="any" value={addFormData.opening} onChange={e => setAddFormData({...addFormData, opening: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Production</label>
                  <input type="number" step="any" value={addFormData.production} onChange={e => setAddFormData({...addFormData, production: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Despatch</label>
                  <input type="number" step="any" value={addFormData.despatch} onChange={e => setAddFormData({...addFormData, despatch: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Transfer</label>
                  <input type="number" step="any" value={addFormData.transfer} onChange={e => setAddFormData({...addFormData, transfer: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Return Billet</label>
                  <input type="number" step="any" value={addFormData.returnBillet || ''} onChange={e => setAddFormData({...addFormData, returnBillet: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} placeholder="0" />
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Remarks</label>
                <input value={addFormData.remarks} onChange={e => setAddFormData({...addFormData, remarks: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', background: '#f8fafc', boxSizing: 'border-box' }} placeholder="Optional notes" />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddForm(null)} style={{ padding: '10px 20px', cursor: 'pointer', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: '600', fontSize: '15px' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>{editIndex !== null ? 'Save Changes' : '+ Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
