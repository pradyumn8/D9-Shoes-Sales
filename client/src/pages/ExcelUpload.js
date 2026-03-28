import React, { useState } from 'react';
import api from '../utils/api';

export default function ExcelUpload() {
  const [file, setFile] = useState(null);
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
      setError(err.response?.data?.error || 'Preview failed');
      if (err.response?.data?.foundHeaders) {
        setError(prev => prev + `. Found columns: ${err.response.data.foundHeaders.join(', ')}`);
      }
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

    try {
      const res = await api.post('/upload/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      if (err.response?.data?.foundHeaders) {
        setError(prev => prev + `\nFound columns: ${err.response.data.foundHeaders.join(', ')}`);
      }
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
              <strong>Upload Complete!</strong><br />
              <strong>{result.success}</strong> entries imported out of <strong>{result.total}</strong> rows
              {result.duplicates > 0 && <><br />Duplicates skipped: <strong>{result.duplicates}</strong></>}
              {result.newShoeTypes?.length > 0 && <><br />New shoe types created: {result.newShoeTypes.join(', ')}</>}
              {result.newModels?.length > 0 && <><br />New models created: {result.newModels.join(', ')}</>}
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }}>
                  <strong>Errors ({result.errors.length}):</strong>
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

          <div className="form-group">
            <div
              className="upload-zone"
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={e => { setFile(e.target.files[0]); setPreview(null); setResult(null); }}
              />
              <p style={{ fontSize: 36, marginBottom: 8 }}>{'\u{1F4C1}'}</p>
              <p>{file ? file.name : 'Click to select your Excel file'}</p>
              <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Supports .xlsx and .xls files</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePreview}
              disabled={!file || previewing}>
              {previewing ? 'Loading Preview...' : 'Preview Data'}
            </button>
            <button className="btn btn-success" style={{ flex: 1 }} onClick={handleUpload}
              disabled={!file || uploading}>
              {uploading ? 'Uploading...' : 'Upload & Import'}
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
          <h3 style={{ marginBottom: 16 }}>Expected Excel Format</h3>
          <div className="alert alert-info">
            <strong>Your Excel file should have these columns:</strong>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <table>
              <thead>
                <tr><th>#</th><th>Column</th><th>Required</th></tr>
              </thead>
              <tbody>
                {[
                  ['Sr No', 'No'],
                  ['Shoe Type', 'Yes'],
                  ['D9 Model', 'Yes'],
                  ['Size', 'Yes'],
                  ['Lot', 'No (default: 1st)'],
                  ['Qty', 'Yes'],
                  ['MRP [Including GST]', 'No'],
                  ['Discount Received', 'No'],
                  ['GST%', 'No'],
                  ['Cost Price', 'No'],
                  ['GST Amount', 'No'],
                  ['Total Cost Price', 'No'],
                  ['Amount', 'No'],
                  ['Billing Amount', 'No'],
                  ['Sale Price', 'No'],
                  ['Sold To', 'No'],
                  ['Buyer Name', 'No'],
                  ['Payment Status', 'No'],
                  ['Remark', 'No'],
                ].map(([col, req], i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><strong>{col}</strong></td>
                    <td><span className={`badge ${req === 'Yes' ? 'badge-red' : 'badge-green'}`}>{req}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="alert alert-warning" style={{ marginTop: 16 }}>
            <strong>Important:</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20, fontSize: 13 }}>
              <li>First row must be column headers</li>
              <li>Currency values ({'\u20B9'}) are automatically cleaned</li>
              <li>Percentage values (50%, 5%) are handled automatically</li>
              <li>Duplicate entries (same model+size+lot+qty+MRP) are skipped</li>
              <li>New Shoe Types and Models are auto-created</li>
            </ul>
          </div>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3>Preview: {preview.fileName} ({preview.totalRows} rows)</h3>
          </div>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Showing first {preview.preview.length} of {preview.totalRows} rows. Red rows have validation errors.
          </p>
          <div className="table-container">
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
                      <td>{row.d9Model || <span style={{ color: 'red' }}>MISSING</span>}</td>
                      <td>{row.size || <span style={{ color: 'red' }}>MISSING</span>}</td>
                      <td>{row.lot || '1st'}</td>
                      <td>{row.qty || <span style={{ color: 'red' }}>MISSING</span>}</td>
                      <td>{row.mrpIncGst || '-'}</td>
                      <td>{row.discountReceived || '-'}</td>
                      <td>{row.purchaseGstPercent || '-'}</td>
                      <td>{row.costPrice || '-'}</td>
                      <td>{row.soldTo || '-'}</td>
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
