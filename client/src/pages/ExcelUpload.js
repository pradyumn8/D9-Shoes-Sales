import React, { useState } from 'react';
import api from '../utils/api';

export default function ExcelUpload() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('append');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err) {
      const errData = err.response?.data;
      let msg = errData?.error || 'Preview failed';
      if (errData?.detectedHeaders) {
        msg += `\n\nDetected columns: ${errData.detectedHeaders.join(', ')}`;
      }
      if (errData?.hint) {
        msg += `\n\nHint: ${errData.hint}`;
      }
      setError(msg);
    }
    setPreviewing(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    try {
      const res = await api.post('/upload/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setPreview(null);
      setFile(null);
      // Reset file input
      const input = document.getElementById('file-input');
      if (input) input.value = '';
    } catch (err) {
      const errData = err.response?.data;
      let msg = errData?.error || 'Upload failed';
      if (errData?.detectedHeaders) {
        msg += `\n\nDetected columns: ${errData.detectedHeaders.join(', ')}`;
      }
      if (errData?.hint) {
        msg += `\n\nHint: ${errData.hint}`;
      }
      setError(msg);
    }
    setUploading(false);
  };

  const downloadTemplate = () => {
    window.open('/api/upload/template', '_blank');
  };

  const downloadExcel = () => {
    window.open('/api/upload/download', '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <h1>Excel Upload</h1>
        <p>Bulk import inventory from your Excel sheets</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Upload Excel File</h3>

          {error && <div className="alert alert-danger" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

          {result && (
            <div className={`alert ${result.errors?.length > 0 ? 'alert-warning' : 'alert-success'}`}>
              <strong>Upload Complete! ({result.mode} mode)</strong><br />
              {result.success > 0 && <><strong>{result.success}</strong> new entries added<br /></>}
              {result.updated > 0 && <><strong>{result.updated}</strong> entries updated<br /></>}
              {result.duplicates > 0 && <><strong>{result.duplicates}</strong> duplicates skipped<br /></>}
              {result.total && <>Total rows processed: <strong>{result.total}</strong><br /></>}
              {result.headerRowFound && <>Header row detected at: Row <strong>{result.headerRowFound}</strong><br /></>}
              {result.newShoeTypes?.length > 0 && <>New shoe types: {result.newShoeTypes.join(', ')}<br /></>}
              {result.newModels?.length > 0 && <>New models: {result.newModels.join(', ')}<br /></>}
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 250, overflow: 'auto' }}>
                  <strong>Errors / Warnings ({result.errors.length}):</strong>
                  <table style={{ fontSize: 12, marginTop: 8 }}>
                    <thead>
                      <tr><th>Row</th><th>Field</th><th>Error</th></tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i}>
                          <td>{err.row}</td>
                          <td>{err.field}</td>
                          <td>{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Upload Mode Selection */}
          <div className="form-group">
            <label>Upload Mode</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                border: `2px solid ${mode === 'append' ? '#2ecc71' : '#ddd'}`,
                borderRadius: 10, cursor: 'pointer', flex: 1,
                background: mode === 'append' ? '#f0fff4' : '#fff',
              }}>
                <input type="radio" name="mode" value="append" checked={mode === 'append'}
                  onChange={() => setMode('append')} />
                <div>
                  <strong>Append New Data</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>Add new entries, skip duplicates</div>
                </div>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                border: `2px solid ${mode === 'update' ? '#4472c4' : '#ddd'}`,
                borderRadius: 10, cursor: 'pointer', flex: 1,
                background: mode === 'update' ? '#f0f4ff' : '#fff',
              }}>
                <input type="radio" name="mode" value="update" checked={mode === 'update'}
                  onChange={() => setMode('update')} />
                <div>
                  <strong>Update Existing</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>Update by Sr No, add new entries</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <div
              className="upload-zone"
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={e => { setFile(e.target.files[0]); setPreview(null); setResult(null); setError(''); }}
              />
              <p style={{ fontSize: 36, marginBottom: 8 }}>{'\u{1F4C1}'}</p>
              <p style={{ fontWeight: 600 }}>{file ? file.name : 'Click to select your Excel file'}</p>
              <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                Supports .xlsx and .xls files with title rows (auto-detected)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={handlePreview}
              disabled={!file || previewing}>
              {previewing ? 'Loading...' : 'Preview Data'}
            </button>
            <button className={`btn ${mode === 'update' ? 'btn-primary' : 'btn-success'}`}
              style={{ flex: 1, padding: '10px' }} onClick={handleUpload}
              disabled={!file || uploading}>
              {uploading ? 'Uploading...' : mode === 'update' ? 'Upload & Update' : 'Upload & Append'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={downloadTemplate}>
              Download Template
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={downloadExcel}>
              Download Current Data
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>How It Works</h3>

          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            <strong>Smart Header Detection:</strong> The system automatically finds your column headers even if your Excel has a title row (like "SALES REGISTER") at the top.
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 8 }}>Append Mode (Default)</h4>
            <ul style={{ paddingLeft: 20, fontSize: 13, lineHeight: 2 }}>
              <li>Adds all rows as <strong>new entries</strong></li>
              <li>Skips rows that look like duplicates (same Model + Size + Lot + Qty + MRP)</li>
              <li>Auto-creates new Shoe Types and Models</li>
              <li>Best for: <strong>Importing new stock</strong></li>
            </ul>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 8 }}>Update Mode</h4>
            <ul style={{ paddingLeft: 20, fontSize: 13, lineHeight: 2 }}>
              <li>Matches rows by <strong>Sr No</strong> and updates existing entries</li>
              <li>Rows with new Sr Nos are added as new entries</li>
              <li>Best for: <strong>Updating sale info, payment status, prices</strong></li>
            </ul>
          </div>

          <h4 style={{ marginBottom: 8 }}>Supported Column Names</h4>
          <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[
              'Sr No', 'Shoe Type', 'D9 Model', 'Size', 'Lot', 'Qty',
              'MRP [Including GST]', 'Discount Received', 'GST%', 'Cost Price',
              'GST Amount', 'Total Cost Price', 'Amount', 'Billing Amount',
              'Sale Price', 'Total Billing Amount',
              'Sold To', 'Paid', 'Buyer Name', 'Billing Name',
              'Invoicing Done', 'Payment Status', 'Remark',
            ].map(col => (
              <span key={col} className="badge badge-blue" style={{ margin: 2 }}>{col}</span>
            ))}
          </div>

          <div className="alert alert-warning" style={{ marginTop: 16 }}>
            <strong>Tips:</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20, fontSize: 13 }}>
              <li>Title rows like "SALES REGISTER" are auto-skipped</li>
              <li>Merged cells in the header area are handled</li>
              <li>{'\u20B9'} currency symbols and % signs are cleaned automatically</li>
              <li>Formula results are read correctly</li>
              <li>Column name matching is flexible (e.g., "Model" matches "D9 Model")</li>
            </ul>
          </div>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3>
              Preview: {preview.fileName}
              <span style={{ fontSize: 13, fontWeight: 400, color: '#666', marginLeft: 12 }}>
                {preview.totalRows} data rows found | Headers at row {preview.headerRowFound}
              </span>
            </h3>
          </div>

          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <strong>Detected columns:</strong>{' '}
            {preview.headers?.map(h => (
              <span key={h} className="badge badge-blue" style={{ margin: 2 }}>{h}</span>
            ))}
          </div>

          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Showing first {Math.min(preview.preview.length, 20)} of {preview.totalRows} rows.
            Red rows have validation errors.
          </p>

          <div className="table-container" style={{ overflow: 'auto' }}>
            <table style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Shoe Type</th>
                  <th>D9 Model</th>
                  <th>Size</th>
                  <th>Lot</th>
                  <th>Qty</th>
                  <th>MRP</th>
                  <th>Discount</th>
                  <th>GST%</th>
                  <th>Cost Price</th>
                  <th>Sold To</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, idx) => {
                  const hasErrors = row._errors && row._errors.length > 0;
                  return (
                    <tr key={idx} style={{ background: hasErrors ? '#fff5f5' : 'inherit' }}>
                      <td>{row._excelRow || (idx + 2)}</td>
                      <td>{row.shoeType || <span style={{ color: 'red' }}>MISSING</span>}</td>
                      <td><strong>{row.d9Model || <span style={{ color: 'red' }}>MISSING</span>}</strong></td>
                      <td>{row.size || <span style={{ color: 'red' }}>MISSING</span>}</td>
                      <td>{row.lot || '1st'}</td>
                      <td>{row.qty || <span style={{ color: 'red' }}>MISSING</span>}</td>
                      <td>{row.mrpIncGst || '-'}</td>
                      <td>{row.discountReceived || '-'}</td>
                      <td>{row.purchaseGstPercent || '-'}</td>
                      <td>{row.costPrice || '-'}</td>
                      <td>{row.soldTo || '-'}</td>
                      <td>{row.paymentStatus || '-'}</td>
                      <td>
                        {hasErrors ? (
                          <span className="badge badge-red" title={row._errors.map(e => e.error).join(', ')}>
                            {row._errors.length} error(s)
                          </span>
                        ) : (
                          <span className="badge badge-green">Valid</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
