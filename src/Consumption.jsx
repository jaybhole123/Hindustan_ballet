import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Printer, FileDown, Plus, X, Edit2, Trash2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const has = v => v !== null && v !== undefined && String(v).trim() !== '';
const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const sum = (a, k) => a.reduce((t, x) => t + x[k], 0);

function parseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  let date = '';
  rows.forEach(r => r.forEach(c => {
    if (typeof c === 'string' && /^\s*date/i.test(c)) date = c.replace(/^\s*date\s*[-:]?\s*/i, '').trim();
  }));

  // Section 1: header row "Material"
  const raw = [];
  const i1 = rows.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'material');
  if (i1 >= 0) {
    for (let i = i1 + 1; i < rows.length && has(rows[i][0]); i++) {
      const r = rows[i];
      raw.push({ name: String(r[0]).trim(), opening: num(r[1]), outside: 0, inhouse: 0, received: num(r[3]), trans: num(r[5]), consumed: num(r[6]), kgHeatFile: has(r[11]) ? num(r[11]) : null });
    }
  }

  // Section 2: header row "Ma"
  const charge = [];
  const i2 = rows.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'ma');
  if (i2 >= 0) {
    let started = false;
    for (let i = i2 + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!has(r[0])) { if (started) break; else continue; }
      started = true;
      charge.push({ name: String(r[0]).trim(), opening: num(r[1]), outside: num(r[3]), inhouse: num(r[5]), consumed: num(r[6]) });
    }
  }

  // Summary: label in column B, value in column F
  const S = { totalProd: 0, finishProd: 0, totalHeat: 0, mnYield: 0, totalCons: 0, loss1: 0, loss2: 0, loss1Label: '', loss2Label: '' };
  rows.forEach(r => {
    const l = String(r[1] || '').trim().toLowerCase();
    if (l.startsWith('total production')) S.totalProd = num(r[5]);
    else if (l.startsWith('finish production')) S.finishProd = num(r[5]);
    else if (l.startsWith('total heat')) S.totalHeat = num(r[5]);
    else if (l.startsWith('mn')) S.mnYield = num(r[5]);
    else if (l.startsWith('total cons')) S.totalCons = num(r[5]);
    const m = String(r[8] || '').trim();
    if (/standard|lounder/i.test(m)) { S.loss1Label = m; S.loss1 = num(r[11]); }
    if (/burning|slag/i.test(m)) { S.loss2Label = m; S.loss2 = num(r[11]); }
  });
  if (!S.totalCons) S.totalCons = charge.reduce((a, x) => a + x.consumed, 0);

  // Calculated fields
  raw.forEach(x => {
    x.closing = x.opening + x.received - x.trans - x.consumed;
    x.kgTon = S.totalProd ? x.consumed / S.totalProd * 1000 : 0;
    x.kgHeat = x.kgHeatFile !== null ? x.kgHeatFile : (S.totalHeat ? x.consumed / S.totalHeat * 1000 : 0);
  });
  charge.forEach(x => {
    x.closing = x.opening + x.outside + x.inhouse - x.consumed;
    x.metalPct = S.totalCons ? x.consumed / S.totalCons * 100 : 0;
  });
  S.avgYield = S.totalCons ? S.totalProd / S.totalCons * 100 : 0;
  S.stdLoss = S.totalProd - S.finishProd;
  return { date, raw, charge, summary: S };
}

function Consumption() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('consumptionData');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (data) {
      localStorage.setItem('consumptionData', JSON.stringify(data));
    }
  }, [data]);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSumMenu, setShowSumMenu] = useState(false);
  const [sumCols, setSumCols] = useState({
    totalProd: true, finishProd: true, stdLoss: true, loss2: true, avgYield: true, totalHeat: true, mnYield: true, totalCons: true
  });
  
  const [showRawModal, setShowRawModal] = useState(false);
  const [editRawIndex, setEditRawIndex] = useState(null);
  const [rawForm, setRawForm] = useState({ name: '', opening: 0, outside: 0, inhouse: 0, received: 0, trans: 0, consumed: 0, closing: 0, kgTon: 0, kgHeat: 0, remark: '' });

  const handleAddRawSubmit = (e) => {
    e.preventDefault();
    const newRow = {
      name: rawForm.name,
      opening: num(rawForm.opening),
      outside: num(rawForm.outside),
      inhouse: num(rawForm.inhouse),
      received: num(rawForm.received),
      trans: num(rawForm.trans),
      consumed: num(rawForm.consumed),
      closing: num(rawForm.closing),
      kgTon: num(rawForm.kgTon),
      kgHeat: num(rawForm.kgHeat),
      remark: rawForm.remark || ''
    };
    if (editRawIndex !== null) {
      setData(prev => {
        const newRaw = [...prev.raw];
        newRaw[editRawIndex] = newRow;
        return { ...prev, raw: newRaw };
      });
    } else {
      setData(prev => ({ ...prev, raw: [...prev.raw, newRow] }));
    }
    setShowRawModal(false);
    setEditRawIndex(null);
    setRawForm({ name: '', opening: 0, outside: 0, inhouse: 0, received: 0, trans: 0, consumed: 0, closing: 0, kgTon: 0, kgHeat: 0, remark: '' });
  };

  const handleEditRaw = (index) => {
    setEditRawIndex(index);
    const row = data.raw[index];
    setRawForm({ ...row, remark: row.remark || '' });
    setShowRawModal(true);
  };

  const handleDeleteRaw = (index) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      setData(prev => {
        const newRaw = [...prev.raw];
        newRaw.splice(index, 1);
        return { ...prev, raw: newRaw };
      });
    }
  };
  
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editChargeIndex, setEditChargeIndex] = useState(null);
  const [chargeForm, setChargeForm] = useState({ name: '', opening: 0, outside: 0, inhouse: 0, consumed: 0, closing: 0, metalPct: 0, remark: '' });

  const handleAddChargeSubmit = (e) => {
    e.preventDefault();
    const newRow = {
      name: chargeForm.name,
      opening: num(chargeForm.opening),
      outside: num(chargeForm.outside),
      inhouse: num(chargeForm.inhouse),
      consumed: num(chargeForm.consumed),
      closing: num(chargeForm.closing),
      metalPct: num(chargeForm.metalPct),
      remark: chargeForm.remark || ''
    };
    if (editChargeIndex !== null) {
      setData(prev => {
        const newCharge = [...prev.charge];
        newCharge[editChargeIndex] = newRow;
        return { ...prev, charge: newCharge };
      });
    } else {
      setData(prev => ({ ...prev, charge: [...prev.charge, newRow] }));
    }
    setShowChargeModal(false);
    setEditChargeIndex(null);
    setChargeForm({ name: '', opening: 0, outside: 0, inhouse: 0, consumed: 0, closing: 0, metalPct: 0, remark: '' });
  };

  const handleEditCharge = (index) => {
    setEditChargeIndex(index);
    setChargeForm({ ...data.charge[index] });
    setShowChargeModal(true);
  };

  const handleDeleteCharge = (index) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      setData(prev => {
        const newCharge = [...prev.charge];
        newCharge.splice(index, 1);
        return { ...prev, charge: newCharge };
      });
    }
  };

  const processWorkbook = (wb) => {
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    if (wb.SheetNames.length > 0) {
      let targetSheet = wb.SheetNames[0];
      const match = wb.SheetNames.find(n => n.toLowerCase().includes('consumption'));
      if (match) targetSheet = match;
      loadSheet(wb, targetSheet);
    }
  };

  const loadSheet = (wb, name) => {
    setSelectedSheet(name);
    const parsedData = parseSheet(wb.Sheets[name]);
    if (!parsedData.raw.length && !parsedData.charge.length) {
      alert('The expected data format was not found in this sheet.');
      return;
    }
    setData(parsedData);
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      processWorkbook(wb);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const saveFile = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; 
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const getBaseName = () => 'consumption_' + (data?.date || 'report').replace(/[^\w.-]+/g, '_');

  const downloadJson = () => {
    saveFile(getBaseName() + '.json', JSON.stringify(data, null, 2), 'application/json');
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => alert('JSON copied to clipboard'));
  };

  const downloadCsv = () => {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const L = [];
    L.push(['RAW MATERIAL'], ['Material', 'Opening', 'Received Outside', 'Received In House', 'Received', 'Trans', 'Consumed', 'Closing', 'Kg/Ton', 'Kg/Heat']);
    data.raw.forEach(x => {
      const rec = (num(x.outside) + num(x.inhouse)) || num(x.received);
      L.push([x.name, x.opening, x.outside, x.inhouse, rec, x.trans, x.consumed, x.closing, x.kgTon, x.kgHeat]);
    });
    L.push([], ['CHARGE MATERIAL'], ['Material', 'Opening', 'Received Outside', 'Received In House', 'Total Received', 'Consumed', 'Closing', 'Metal %']);
    data.charge.forEach(x => L.push([x.name, x.opening, x.outside, x.inhouse, x.outside + x.inhouse, x.consumed, x.closing, x.metalPct]));
    const S = data.summary;
    L.push([], ['SUMMARY'], ['Date', data.date], ['Total Production', S.totalProd], ['Finish Production', S.finishProd], ['Total Heat', S.totalHeat], ['Total Consumption', S.totalCons], ['Average Yield %', S.avgYield], ['Mn Yield %', S.mnYield], ['Standard+Lounder Loss', S.stdLoss], ['Burning Loss + Slag', S.loss2]);
    saveFile(getBaseName() + '.csv', '\ufeff' + L.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
  };

  const downloadPDF = () => {
    // Hide the bar before generating PDF to keep it clean
    const bar = document.querySelector('.bar');
    if (bar) bar.style.display = 'none';

    const element = document.getElementById('out');
    const opt = {
      margin:       0.2,
      filename:     getBaseName() + '.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
      // Restore bar
      if (bar) bar.style.display = 'flex';
    });
  };

  const renderCell = (v, d = 3, label = '') => {
    const val = num(v);
    return <td data-label={label} className={val < 0 ? 'neg' : ''}>{fmt(val, d)}</td>;
  };

  const warns = data ? [...data.raw, ...data.charge].filter(x => x.closing < 0).map(x => `Closing stock for ${x.name} is negative (${fmt(x.closing, 3)}) — please check opening/received/consumed.`) : [];

  return (
    <div className="wrap">
      <h1 className="page-title">Consumption Report Extractor</h1>
      <div className="page-subtitle">Upload Excel (.xlsx) file — data will be automatically extracted into tables, summaries, and download options.</div>

      <label 
        className={`drop ${isDragOver ? 'over' : ''}`} 
        onDragOver={handleDragOver} 
        onDragLeave={handleDragLeave} 
        onDrop={handleDrop}
      >
        <input type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={(e) => handleFile(e.target.files[0])} />
        <div><b>Drop Excel file here</b> or click to select</div>
      </label>

      {data && (
        <div id="out">
          <div className="bar">
            {sheetNames.length > 1 && (
              <select value={selectedSheet} onChange={(e) => loadSheet(workbook, e.target.value)}>
                {sheetNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
            <button onClick={downloadPDF} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Printer size={16} /> Download PDF
            </button>
            <button onClick={downloadCsv} style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: 'var(--ink)'}}>
              <FileDown size={16} /> Download Excel
            </button>
          </div>
          
          {warns.length > 0 && (
            <div className="warn">
              {warns.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}

          <div className="kpis">
            <div className="kpi"><span>Date</span><b>{data.date || '-'}</b></div>
            <div className="kpi"><span>Total Production (MT)</span><b>{fmt(data.summary.totalProd)}</b></div>
            <div className="kpi"><span>Finish Production (MT)</span><b>{fmt(data.summary.finishProd)}</b></div>
            <div className="kpi"><span>Total Heat</span><b>{fmt(data.summary.totalHeat, 0)}</b></div>
            <div className="kpi"><span>Total Consumption</span><b>{fmt(data.summary.totalCons)}</b></div>
            <div className="kpi"><span>Average Yield</span><b>{fmt(data.summary.avgYield)} %</b></div>
            <div className="kpi"><span>Mn Yield</span><b>{fmt(data.summary.mnYield)} %</b></div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Raw Material (Alloys / Coal)</h2>
              <button 
                onClick={() => setShowRawModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--acc)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                <Plus size={16} /> Add 
              </button>
            </div>
            
            {showRawModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div className="modal-header">
                    <h3>{editRawIndex !== null ? 'Edit Raw Material' : 'Add Raw Material'}</h3>
                    <button type="button" className="modal-close-btn" onClick={() => { setShowRawModal(false); setEditRawIndex(null); setRawForm({ name: '', opening: 0, outside: 0, inhouse: 0, received: 0, trans: 0, consumed: 0, closing: 0, kgTon: 0, kgHeat: 0, remark: '' }); }}><X size={18} /></button>
                  </div>
                  <form className="modal-form" onSubmit={handleAddRawSubmit}>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label>Material Name</label>
                      <input required type="text" value={rawForm.name} onChange={e => setRawForm({...rawForm, name: e.target.value})} placeholder="e.g. Si.Mn" style={{ padding: '12px', fontSize: '15px' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      <div className="form-group"><label>Opening</label><input type="number" step="any" value={rawForm.opening} onChange={e => setRawForm({...rawForm, opening: e.target.value})} /></div>
                      <div className="form-group"><label>Received (Outside)</label><input type="number" step="any" value={rawForm.outside} onChange={e => setRawForm({...rawForm, outside: e.target.value})} /></div>
                      <div className="form-group"><label>Received (In House)</label><input type="number" step="any" value={rawForm.inhouse} onChange={e => setRawForm({...rawForm, inhouse: e.target.value})} /></div>
                      <div className="form-group"><label>Received</label><input type="number" step="any" value={rawForm.received} onChange={e => setRawForm({...rawForm, received: e.target.value})} /></div>
                      <div className="form-group"><label>Trans</label><input type="number" step="any" value={rawForm.trans} onChange={e => setRawForm({...rawForm, trans: e.target.value})} /></div>
                      <div className="form-group"><label>Consumed</label><input type="number" step="any" value={rawForm.consumed} onChange={e => setRawForm({...rawForm, consumed: e.target.value})} /></div>
                      <div className="form-group"><label>Closing</label><input type="number" step="any" value={rawForm.closing} onChange={e => setRawForm({...rawForm, closing: e.target.value})} /></div>
                      <div className="form-group"><label>Kg/Ton</label><input type="number" step="any" value={rawForm.kgTon} onChange={e => setRawForm({...rawForm, kgTon: e.target.value})} /></div>
                      <div className="form-group"><label>Kg/Heat</label><input type="number" step="any" value={rawForm.kgHeat} onChange={e => setRawForm({...rawForm, kgHeat: e.target.value})} /></div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Remark</label>
                        <input type="text" value={rawForm.remark} onChange={e => setRawForm({...rawForm, remark: e.target.value})} placeholder="Any notes..." />
                      </div>
                    </div>
                    <div className="modal-actions" style={{ marginTop: '32px' }}>
                      <button type="button" onClick={() => { setShowRawModal(false); setEditRawIndex(null); setRawForm({ name: '', opening: 0, outside: 0, inhouse: 0, received: 0, trans: 0, consumed: 0, closing: 0, kgTon: 0, kgHeat: 0, remark: '' }); }} style={{ background: '#f8fafc', color: 'var(--ink)', border: '1px solid var(--line)', padding: '10px 20px', fontWeight: '500' }}>Cancel</button>
                      <button type="submit" style={{ background: 'var(--acc)', color: 'white', border: 'none', padding: '10px 24px', fontWeight: '500', boxShadow: '0 4px 10px rgba(37,99,235,0.2)' }}>{editRawIndex !== null ? 'Update Material' : 'Save Material'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="scroll">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Opening</th>
                    <th>Received (Outside)</th>
                    <th>Received (In House)</th>
                    <th>Received</th>
                    <th>Trans</th>
                    <th>Consumed</th>
                    <th>Closing</th>
                    <th>Kg/Ton</th>
                    <th>Kg/Heat</th>
                    <th style={{textAlign: 'left'}}>Remark</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.raw.map((x, i) => (
                    <tr key={i}>
                      <td data-label="Material" style={{textAlign: 'left'}}>{x.name}</td>
                      {renderCell(x.opening, 3, 'Opening')}
                      {renderCell(x.outside, 3, 'Received (Outside)')}
                      {renderCell(x.inhouse, 3, 'Received (In House)')}
                      {renderCell((num(x.outside) + num(x.inhouse)) || x.received, 3, 'Received')}
                      {renderCell(x.trans, 3, 'Trans')}
                      {renderCell(x.consumed, 3, 'Consumed')}
                      {renderCell(x.closing, 3, 'Closing')}
                      {renderCell(x.kgTon, 3, 'Kg/Ton')}
                      {renderCell(x.kgHeat, 3, 'Kg/Heat')}
                      <td data-label="Remark" style={{textAlign: 'left'}}>{x.remark || ''}</td>
                      <td data-label="Action">
                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                          <button onClick={() => handleEditRaw(i)} style={{padding: '6px', background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: '6px'}} title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteRaw(i)} style={{padding: '6px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '6px'}} title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Total" style={{textAlign: 'left'}}>Total</td>
                    {renderCell(sum(data.raw, 'opening'), 3, 'Opening')}
                    {renderCell(sum(data.raw, 'outside'), 3, 'Received (Outside)')}
                    {renderCell(sum(data.raw, 'inhouse'), 3, 'Received (In House)')}
                    {renderCell(data.raw.reduce((acc, x) => acc + ((num(x.outside) + num(x.inhouse)) || num(x.received)), 0), 3, 'Received')}
                    {renderCell(sum(data.raw, 'trans'), 3, 'Trans')}
                    {renderCell(sum(data.raw, 'consumed'), 3, 'Consumed')}
                    {renderCell(sum(data.raw, 'closing'), 3, 'Closing')}
                    <td data-label=""></td>
                    <td data-label=""></td>
                    <td data-label=""></td>
                    <td data-label=""></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Charge Material (Scrap / Pellets)</h2>
              <button 
                onClick={() => setShowChargeModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--acc)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}
              >
                <Plus size={16} /> Add 
              </button>
            </div>
            
            {showChargeModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div className="modal-header">
                    <h3>{editChargeIndex !== null ? 'Edit Charge Material' : 'Add Charge Material'}</h3>
                    <button type="button" className="modal-close-btn" onClick={() => { setShowChargeModal(false); setEditChargeIndex(null); setChargeForm({ name: '', opening: 0, outside: 0, inhouse: 0, consumed: 0, closing: 0, metalPct: 0, remark: '' }); }}><X size={18} /></button>
                  </div>
                  <form className="modal-form" onSubmit={handleAddChargeSubmit}>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label>Material Name</label>
                      <input required type="text" value={chargeForm.name} onChange={e => setChargeForm({...chargeForm, name: e.target.value})} placeholder="e.g. Pellets" style={{ padding: '12px', fontSize: '15px' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      <div className="form-group"><label>Opening</label><input type="number" step="any" value={chargeForm.opening} onChange={e => setChargeForm({...chargeForm, opening: e.target.value})} /></div>
                      <div className="form-group"><label>Received (Outside)</label><input type="number" step="any" value={chargeForm.outside} onChange={e => setChargeForm({...chargeForm, outside: e.target.value})} /></div>
                      <div className="form-group"><label>Received (In House)</label><input type="number" step="any" value={chargeForm.inhouse} onChange={e => setChargeForm({...chargeForm, inhouse: e.target.value})} /></div>
                      <div className="form-group"><label>Consumed</label><input type="number" step="any" value={chargeForm.consumed} onChange={e => setChargeForm({...chargeForm, consumed: e.target.value})} /></div>
                      <div className="form-group"><label>Closing</label><input type="number" step="any" value={chargeForm.closing} onChange={e => setChargeForm({...chargeForm, closing: e.target.value})} /></div>
                      <div className="form-group"><label>Metal %</label><input type="number" step="any" value={chargeForm.metalPct} onChange={e => setChargeForm({...chargeForm, metalPct: e.target.value})} /></div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Remark</label>
                        <input type="text" value={chargeForm.remark} onChange={e => setChargeForm({...chargeForm, remark: e.target.value})} placeholder="Any notes..." />
                      </div>
                    </div>
                    <div className="modal-actions" style={{ marginTop: '32px' }}>
                      <button type="button" onClick={() => { setShowChargeModal(false); setEditChargeIndex(null); setChargeForm({ name: '', opening: 0, outside: 0, inhouse: 0, consumed: 0, closing: 0, metalPct: 0, remark: '' }); }} style={{ background: '#f8fafc', color: 'var(--ink)', border: '1px solid var(--line)', padding: '10px 20px', fontWeight: '500' }}>Cancel</button>
                      <button type="submit" style={{ background: 'var(--acc)', color: 'white', border: 'none', padding: '10px 24px', fontWeight: '500', boxShadow: '0 4px 10px rgba(37,99,235,0.2)' }}>{editChargeIndex !== null ? 'Update Material' : 'Save Material'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            <div className="scroll">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Opening</th>
                    <th>Received (Outside)</th>
                    <th>Received (In House)</th>
                    <th>Total Received</th>
                    <th>Consumed</th>
                    <th>Closing</th>
                    <th>Metal %</th>
                    <th style={{textAlign: 'left'}}>Remark</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charge.map((x, i) => (
                    <tr key={i} className={x.closing < 0 ? 'neg-row' : ''}>
                      <td data-label="Material">{x.name}</td>
                      {renderCell(x.opening, 3, 'Opening')}
                      {renderCell(x.outside, 3, 'Received (Outside)')}
                      {renderCell(x.inhouse, 3, 'Received (In House)')}
                      {renderCell(x.outside + x.inhouse, 3, 'Total Received')}
                      {renderCell(x.consumed, 3, 'Consumed')}
                      {renderCell(x.closing, 3, 'Closing')}
                      {renderCell(x.metalPct, 3, 'Metal %')}
                      <td data-label="Remark" style={{textAlign: 'left'}}>{x.remark || ''}</td>
                      <td data-label="Action">
                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                          <button onClick={() => handleEditCharge(i)} style={{padding: '6px', background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: '6px'}} title="Edit"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteCharge(i)} style={{padding: '6px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '6px'}} title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Total">Total</td>
                    {renderCell(sum(data.charge, 'opening'), 3, 'Opening')}
                    {renderCell(sum(data.charge, 'outside'), 3, 'Received (Outside)')}
                    {renderCell(sum(data.charge, 'inhouse'), 3, 'Received (In House)')}
                    {renderCell(sum(data.charge, 'outside') + sum(data.charge, 'inhouse'), 3, 'Total Received')}
                    {renderCell(sum(data.charge, 'consumed'), 3, 'Consumed')}
                    {renderCell(sum(data.charge, 'closing'), 3, 'Closing')}
                    {renderCell(sum(data.charge, 'metalPct'), 3, 'Metal %')}
                    <td data-label=""></td>
                    <td data-label=""></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Production Summary</h2>
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowSumMenu(!showSumMenu)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 'bold', transform: 'rotate(90deg)' }}>⋮⋮</span> Columns
                </button>
                {showSumMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#fff', border: '1px solid var(--line)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '220px', padding: '8px' }}>
                    <div 
                      style={{ padding: '6px 8px', fontSize: '13px', color: 'var(--acc)', cursor: 'pointer', borderBottom: '1px solid var(--line)', marginBottom: '4px' }} 
                      onClick={() => setSumCols({ totalProd: false, finishProd: false, stdLoss: false, loss2: false, avgYield: false, totalHeat: false, mnYield: false, totalCons: false })}
                    >
                      Deselect All
                    </div>
                    {[
                      { key: 'totalProd', label: 'Total Production (MT)' },
                      { key: 'finishProd', label: 'Finish Production (MT)' },
                      { key: 'stdLoss', label: data.summary.loss1Label || 'Standard + Lounder Loss' },
                      { key: 'loss2', label: data.summary.loss2Label || 'Burning Loss + Slag' },
                      { key: 'avgYield', label: 'Average Yield (%)' },
                      { key: 'totalHeat', label: 'Total Heat' },
                      { key: 'mnYield', label: 'Mn Yield (%)' },
                      { key: 'totalCons', label: 'Total Consumption' }
                    ].map(c => (
                      <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '13px', color: 'var(--ink)' }}>
                        <input 
                          type="checkbox" 
                          checked={sumCols[c.key]} 
                          onChange={(e) => setSumCols({ ...sumCols, [c.key]: e.target.checked })} 
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="scroll">
              <table className="responsive-table">
                <tbody>
                  {sumCols.totalProd && <tr><td>Total Production (MT)</td>{renderCell(data.summary.totalProd)}</tr>}
                  {sumCols.finishProd && <tr><td>Finish Production (MT)</td>{renderCell(data.summary.finishProd)}</tr>}
                  {sumCols.stdLoss && <tr><td>{data.summary.loss1Label || 'Standard + Lounder Loss'}</td>{renderCell(data.summary.stdLoss)}</tr>}
                  {sumCols.loss2 && <tr><td>{data.summary.loss2Label || 'Burning Loss + Slag'}</td>{renderCell(data.summary.loss2)}</tr>}
                  {sumCols.avgYield && <tr><td>Average Yield (%)</td>{renderCell(data.summary.avgYield)}</tr>}
                  {sumCols.totalHeat && <tr><td>Total Heat</td>{renderCell(data.summary.totalHeat)}</tr>}
                  {sumCols.mnYield && <tr><td>Mn Yield (%)</td>{renderCell(data.summary.mnYield)}</tr>}
                  {sumCols.totalCons && <tr><td>Total Consumption</td>{renderCell(data.summary.totalCons)}</tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Consumption;
