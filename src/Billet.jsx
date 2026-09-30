import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Printer, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const has = v => v !== null && v !== undefined && String(v).trim() !== '';
const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const KEYS = ['opening', 'production', 'despatch', 'transfer', 'closing'];
const LABELS = ['Opening', 'Production', 'Despatch', 'Transfer', 'Closing'];
const sum = (a, k) => a.reduce((t, x) => t + x[k], 0);
const renderCell = (v, cls = '', label = '') => <td data-label={label} className={`${cls} ${v < 0 ? 'neg' : ''}`}>{fmt(v, 3)}</td>;

function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  let title = '', date = '';
  rows.forEach(r => r.forEach(c => {
    if (typeof c !== 'string') return;
    if (/billet.*report/i.test(c) && !title) title = c.trim();
    if (/^\s*date/i.test(c) && !date) date = c.replace(/^\s*date\s*[-:]?\s*/i, '').replace(/\s*\/\s*/g, '/').trim();
  }));

  const sizes = [], warns = [];
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
    for (j = j + 1; j < rows.length; j++) {
      const r = rows[j];
      if (!has(r[1])) {
        if (has(r[2]) || has(r[6])) sec.fileTotals = { opening: num(r[2]), production: num(r[3]), despatch: num(r[4]), transfer: num(r[5]), closing: num(r[6]) };
        break;
      }
      const it = { name: String(r[1]).trim(), opening: num(r[2]), production: num(r[3]), despatch: num(r[4]), transfer: num(r[5]), remarks: has(r[7]) ? String(r[7]).trim() : '' };
      it.closing = it.opening + it.production - it.despatch - it.transfer;
      it.fileClosing = has(r[6]) ? num(r[6]) : null;
      if (it.fileClosing !== null && Math.abs(it.fileClosing - it.closing) > 0.0005)
        warns.push(`${sec.size}: ${it.name} ka closing Excel me ${fmt(it.fileClosing, 3)} hai, jabki calculated ${fmt(it.closing, 3)} hai.`);
      if (it.closing < 0) warns.push(`${sec.size}: ${it.name} ka closing negative hai (${fmt(it.closing, 3)}).`);
      sec.items.push(it);
    }
    sec.totals = {};
    KEYS.forEach(k => sec.totals[k] = sum(sec.items, k));
    sizes.push(sec);
  }
  const grand = {};
  KEYS.forEach(k => grand[k] = sizes.reduce((t, s) => t + s.totals[k], 0));
  return { title, date, sizes, grand, warns };
}

export default function Billet() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('billetData');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return null; }
    }
    return null;
  });
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAddForm, setShowAddForm] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [addFormData, setAddFormData] = useState({ name: '', opening: 0, production: 0, despatch: 0, transfer: 0, remarks: '' });

  useEffect(() => {
    if (data) localStorage.setItem('billetData', JSON.stringify(data));
  }, [data]);

  const loadSheet = (wb, name) => {
    setSelectedSheet(name);
    const parsedData = parseSheet(wb.Sheets[name]);
    if (!parsedData.sizes.length) {
      alert('The expected data format was not found in this sheet.');
      return;
    }
    setData(parsedData);
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
        remarks: addFormData.remarks
      };
      newItem.closing = newItem.opening + newItem.production - newItem.despatch - newItem.transfer;
      
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
    setAddFormData({ name: '', opening: 0, production: 0, despatch: 0, transfer: 0, remarks: '' });
  };

  const openAdd = (sizeIdx) => {
    setShowAddForm(sizeIdx);
    setEditIndex(null);
    setAddFormData({ name: '', opening: 0, production: 0, despatch: 0, transfer: 0, remarks: '' });
  };

  const openEdit = (sizeIdx, itemIdx) => {
    setShowAddForm(sizeIdx);
    setEditIndex(itemIdx);
    const item = data.sizes[sizeIdx].items[itemIdx];
    setAddFormData({
      name: item.name, opening: item.opening, production: item.production, 
      despatch: item.despatch, transfer: item.transfer, remarks: item.remarks
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
    const L = [['Date', data.date], ['Size', 'Item', 'Opening', 'Production', 'Despatch', 'Transfer', 'Closing', 'Remarks']];
    data.sizes.forEach(s => {
      s.items.forEach(x => L.push([s.size, x.name, x.opening, x.production, x.despatch, x.transfer, x.closing, x.remarks]));
      L.push([s.size, 'TOTAL', s.totals.opening, s.totals.production, s.totals.despatch, s.totals.transfer, s.totals.closing, '']);
    });
    L.push(['ALL', 'GRAND TOTAL', data.grand.opening, data.grand.production, data.grand.despatch, data.grand.transfer, data.grand.closing, '']);
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

  return (
    <div style={{ paddingBottom: '40px' }}>
      <h1 className="page-title">Billet Report Extractor</h1>
      <p className="page-subtitle">Upload Excel (.xlsx) file — size-wise data will be automatically extracted.</p>

      <label 
        className={`drop ${isDragOver ? 'over' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
      >
        <input type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={e => handleFile(e.target.files[0])} />
        <div><b>Drop Excel file here</b> or click to select</div>
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
          </div>

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
                  <tr><th style={{textAlign: 'left'}}>Size</th><th>Opening</th><th>Production</th><th>Despatch</th><th>Transfer</th><th>Closing</th></tr>
                </thead>
                <tbody>
                  {data.sizes.map((s, i) => (
                    <tr key={i}>
                      <td data-label="Size" style={{textAlign: 'left'}}>{s.size}</td>
                      {KEYS.map((k, idx) => renderCell(s.totals[k], '', LABELS[idx]))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Total" style={{textAlign: 'left'}}>Grand Total</td>
                    {KEYS.map((k, idx) => renderCell(data.grand[k], '', LABELS[idx]))}
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
                    <tr><th style={{textAlign: 'left'}}>Item</th><th>Opening</th><th>Production</th><th>Despatch</th><th>Transfer</th><th>Closing</th><th style={{textAlign: 'left'}}>Remarks</th><th style={{textAlign: 'center', width: '100px'}}>Action</th></tr>
                  </thead>
                  <tbody>
                    {s.items.map((x, j) => (
                      <tr key={j} className={x.closing < 0 ? 'neg-row' : ''}>
                        <td data-label="Item" style={{textAlign: 'left'}}>{x.name}</td>
                        {KEYS.map((k, idx) => renderCell(x[k], '', LABELS[idx]))}
                        <td data-label="Remarks" style={{textAlign: 'left'}}>{x.remarks}</td>
                        <td data-label="Action" style={{textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px', paddingTop: '10px'}}>
                          <button onClick={() => openEdit(i, j)} style={{ background: '#eef2ff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px' }} title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(i, j)} style={{ background: '#fef2f2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px' }} title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td data-label="Total" style={{textAlign: 'left'}}>Total</td>
                      {KEYS.map((k, idx) => renderCell(s.totals[k], '', LABELS[idx]))}
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
