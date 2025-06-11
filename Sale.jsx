// Sale.jsx (Phiên bản đầy đủ: dùng nhập tay để chỉnh độ rộng cột, không dùng kéo chuột)
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

const CASHIERS = ['An', 'Trang', 'Ngân', 'Tuấn'];
const APP_CATEGORIES = ['TS', 'SH', 'SW', 'JU', 'JA', 'DR', 'PA', 'SK', 'CO'];

const FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'bill', label: 'Bill No.' },
  { key: 'upc', label: 'UPC' },
  { key: 'skus', label: 'SKU' },
  { key: 'qty', label: 'Quantity' },
  { key: 'amount', label: 'Amount' },
  { key: 'customer', label: 'Customer' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'promotion', label: 'Promotion' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'type', label: 'Type' },
  { key: 'gender', label: 'Gender' },
  { key: 'division', label: 'Division' },
  { key: 'category', label: 'Category' },
  { key: 'year', label: 'Year' },
  { key: 'season', label: 'Season' },
  { key: 'size', label: 'Size' }
];

export default function SaleInput() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState([]);
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterValue, setNewFilterValue] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('sale_column_widths');
    return saved ? JSON.parse(saved) : {};
  });
  const tableRef = useRef(null);

  const formatDate = (val) => {
    if (!val) return '';
    if (typeof val === 'number') return XLSX.SSF.format('yyyy-mm-dd', val);
    return String(val).split(' ')[0];
  };

  const parseUPC = (upc) => {
    const skus = upc.slice(0, 11);
    const prefix = upc.slice(0, 2);
    const category = upc.slice(2, 4);
    const year = '202' + upc.charAt(4);
    const season = upc.charAt(5);
    const size = upc.slice(11, 14);
    const type = ['HU', 'HW'].includes(prefix) ? 'GOLF' : 'CASUAL';
    const gender = ['HU', 'HZ', 'HJ'].includes(prefix) ? 'Male' : 'Female';
    const division = APP_CATEGORIES.includes(category) ? 'APP' : 'ACC';
    return { skus, type, gender, category, year, season, size, division };
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 6 });
      const headers = raw[0] || [];
      const find = (kw) => headers.findIndex(h => h?.toLowerCase().includes(kw.toLowerCase()) && !h.toLowerCase().includes('tổng nhận diện'));
      const idx = {
  date: find('ngày'),
  bill: find('số hđ'),
  upc: find('mã'),
  qty: find('lượng'),
  amount: find('tổng'),
  customer: headers.findIndex(h => h?.toLowerCase() === 'khách hàng'),
  mobile: find('thoại'),
};;

      const parsed = raw.slice(1)
        .filter(row => row.some(cell => typeof cell === 'string' && !cell.toLowerCase().includes('tổng')))
        .map(row => {
          const upc = row[idx.upc]?.toString() || '';
          const extra = upc.length === 14 ? parseUPC(upc) : {};
          return {
            date: formatDate(row[idx.date]),
            bill: row[idx.bill]?.toString() || '',
            upc,
            qty: row[idx.qty] || '',
            amount: row[idx.amount] || '',
            customer: row[idx.customer] || '',
            mobile: row[idx.mobile] || '',
            promotion: '',
            cashier: '',
            ...extra
          };
        });
      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleColumnResize = (key, newWidth) => {
    const updated = { ...columnWidths, [key]: newWidth };
    setColumnWidths(updated);
    localStorage.setItem('sale_column_widths', JSON.stringify(updated));
  };

  const handleExport = () => {
    let exportData = filteredRows;
    if (fromDate || toDate) {
      exportData = exportData.filter(r => {
        const d = r.date;
        return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      });
    }
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'sales_export.xlsx');
  };

  const addFilter = () => {
    if (!newFilterField || !newFilterValue) return;
    setFilters([...filters, { field: newFilterField, value: newFilterValue }]);
    setNewFilterField('');
    setNewFilterValue('');
  };

  const removeFilter = (index) => {
    const updated = [...filters];
    updated.splice(index, 1);
    setFilters(updated);
  };

  const filteredRows = rows.filter(row => filters.every(({ field, value }) => row[field] === value));

  const updateCell = (i, key, val) => {
    const updated = [...rows];
    updated[i][key] = val;
    setRows(updated);
  };

  const handleSave = async () => {
    if (!rows.length) return;
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows)
      });
      const json = await res.json();
      alert(json.status === 'success' ? '✅ Data saved!' : '❌ Failed: ' + (json.message || 'Unknown error'));
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const todayRows = rows.filter(r => r.upc?.length === 14 && r.date === new Date().toISOString().split('T')[0]);
  const totalAmountToday = todayRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalItemsToday = todayRows.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
  const totalTransToday = new Set(todayRows.map(r => r.bill + r.date)).size;

  return (
    <div>
      <div className="flex justify-between items-start mb-4 gap-6">
        <div className="flex flex-col gap-3 text-sm border rounded px-4 py-3 bg-gray-50 shadow" style={{ minWidth: '600px' }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Search:</span>
            <select value={newFilterField} onChange={e => setNewFilterField(e.target.value)} className="border px-2 py-1 rounded">
              <option value="">--Field--</option>
              {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <input value={newFilterValue} onChange={e => setNewFilterValue(e.target.value)} placeholder="Exact value" className="border px-2 py-1 rounded" />
            <button onClick={addFilter} className="bg-blue-500 text-white px-3 py-1 rounded">+ Add Filter</button>
            {filters.map((f, i) => (
              <span key={i} className="bg-blue-100 px-2 py-1 rounded">
                {f.field}: {f.value} <button onClick={() => removeFilter(i)} className="text-red-500">❌</button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="font-medium">Import:</label>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="border px-2 py-1 rounded" />
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-1 rounded">💾 Save</button>
          </div>

          <div className="flex items-center gap-3">
            <label className="font-medium">Export From:</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border px-2 py-1 rounded" />
            <label className="font-medium">To:</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border px-2 py-1 rounded" />
            <button onClick={handleExport} className="bg-green-600 text-white px-4 py-1 rounded">📤 Export</button>
          </div>
        </div>

        <div className="text-sm border rounded shadow p-3 bg-white">
          <button
            onClick={() => {
              const text = `Date: ${new Date().toLocaleDateString('vi-VN')}\nTotal Sale: ${totalAmountToday}\nItems: ${totalItemsToday}\nTrans: ${totalTransToday}`;
              navigator.clipboard.writeText(text).then(() => alert('📋 Copied!'));
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded mb-2 shadow"
          >📋 Copy Summary</button>
          <table className="min-w-[180px] text-left">
            <tbody>
              <tr><td className="font-medium pr-2">Date:</td><td>{new Date().toLocaleDateString('vi-VN')}</td></tr>
              <tr><td className="font-medium pr-2">Total Sale:</td><td>{totalAmountToday}</td></tr>
              <tr><td className="font-medium pr-2">Items:</td><td>{totalItemsToday}</td></tr>
              <tr><td className="font-medium pr-2">Trans:</td><td>{totalTransToday}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto overflow-y-auto max-h-[500px] border rounded">
        <table className="text-xs w-full table-fixed">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              {FIELDS.map(f => (
                <th
                  key={f.key}
                  className="border text-center whitespace-nowrap bg-gray-100"
                  style={{ width: columnWidths[f.key] || '120px', minWidth: '60px' }}
                  onDoubleClick={() => {
                    const newWidth = prompt(`Set width for "${f.label}" (in px):`, columnWidths[f.key] || '120');
                    if (newWidth && !isNaN(parseInt(newWidth))) handleColumnResize(f.key, `${parseInt(newWidth)}px`);
                  }}
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                {FIELDS.map(f => (
                  <td
                    key={f.key}
                    className="border px-1 py-0.5 text-center align-middle"
                    style={{ width: columnWidths[f.key] || '120px' }}
                  >
                    {f.key === 'cashier' ? (
                      <select
                        value={row[f.key]}
                        onChange={e => updateCell(i, f.key, e.target.value)}
                        className="w-full border rounded px-1 text-center"
                      >
                        <option value="">--Select--</option>
                        {CASHIERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={row[f.key] || ''}
                        onChange={e => updateCell(i, f.key, e.target.value)}
                        className="w-full border rounded px-1 py-0.5 text-center"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
