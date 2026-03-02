import { useState, useEffect } from "react";
import '../css/reviewer.css';
import { useNavigate } from 'react-router-dom';
import LogoutButton from '../components/logout'
import { API_BASE_URL } from '../config';

function ReviewerPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    system_type: "all"
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [downloadSuccess, setDownloadSuccess] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [showBilling, setShowBilling] = useState(false);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleUpgrade = (planName, amount) => {
    const username = localStorage.getItem("username") || "UnknownUser";
    const ref = `${planName}_UPGRADE_${username}`
    const checkoutUrl = `https://unb.allan7ycrx.org/api/v1/pay?amount=${amount}&phone_number=&ref=${ref}`

    window.location.href = checkoutUrl
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/acl_requests`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data.acl_requests || []);
      } else {
        throw new Error("Failed to fetch requests");
      }
    } catch (err) {
      setError(`Error loading requests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId, newStatus, comments = "") => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/acl_requests/${requestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          comments: comments,
          updated_by: "reviewer"
        })
      });

      if (response.ok) {
        fetchRequests();
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest(prev => ({ ...prev, status: newStatus }));
        }
        setShowDetails(false);
      } else {
        throw new Error("Failed to update request");
      }
    } catch (err) {
      setError(`Error updating request: ${err.message}`);
    }
  };

  const handleAddComment = async (requestId) => {
    if (!newComment.trim()) return;
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/acl_requests/${requestId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          comment: newComment,
          author: "reviewer",
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setNewComment("");
        fetchRequests();
        const updatedReq = await fetch(`${API_BASE_URL}/acl_requests`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await updatedReq.json();
        const freshData = data.acl_requests.find(r => r.id === requestId);
        if (freshData) setSelectedRequest(freshData);
      }
    } catch (err) {
      setError(`Error adding comment: ${err.message}`);
    }
  };

  const filteredRequests = requests.filter(request => {
    if (filters.status !== "all" && request.status !== filters.status) return false;
    if (filters.category !== "all" && request.category !== filters.category) return false;
    if (filters.system_type !== "all" && request.system_type !== filters.system_type) return false;
    return true;
  });

  const getUniqueValues = (key) => [...new Set(requests.map(req => req[key]).filter(Boolean))];

  useEffect(() => { fetchRequests(); }, []);

  const handleDownloadExcel = async () => {
    try {
      setDownloadError("");
      setDownloadSuccess("");
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/v1/generate-xlsx`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `acl_requests_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setDownloadSuccess('✅ Excel downloaded!');
        setTimeout(() => setDownloadSuccess(''), 3000);
      } else {
        setDownloadError("Download failed");
      }
    } catch (e) { setDownloadError(e.message); }
  };

  if (loading) return <div className={`loading-screen ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
    <div className="spinner"></div>Loading workspace...
  </div>;

  return (
    <div className={`reviewer-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      {/* HEADER */}
      <div className="top-bar">
        <div>
          <h1>Reviewer Dashboard</h1>
          <p className="subtitle">Manage and authorize network access requests</p>
        </div>
        <div className="actions">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/templates')}>📋 Templates</button>
          <button className="btn-success" onClick={handleDownloadExcel}>📥 Export CSV</button>
          <LogoutButton />
        </div>
      </div>

      {/* ALERTS */}
      {error && <div className="alert error">{error} <button onClick={() => setError("")}>×</button></div>}
      {downloadSuccess && <div className="alert success">{downloadSuccess}</div>}

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📊</div>
          <div>
            <h3>Total Requests</h3>
            <div className="number">{requests.length}</div>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div>
            <h3>Pending</h3>
            <div className="number">{requests.filter(r => r.status === 'Pending').length}</div>
          </div>
        </div>
        <div className="stat-card approved">
          <div className="stat-icon">✅</div>
          <div>
            <h3>Approved</h3>
            <div className="number">{requests.filter(r => ['Approved', 'Completed'].includes(r.status)).length}</div>
          </div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-icon">❌</div>
          <div>
            <h3>Rejected</h3>
            <div className="number">{requests.filter(r => r.status === 'Rejected').length}</div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Status</label>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Category</label>
          <select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
            <option value="all">All Categories</option>
            {getUniqueValues('category').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>System</label>
          <select value={filters.system_type} onChange={e => setFilters({ ...filters, system_type: e.target.value })}>
            <option value="all">All Systems</option>
            {getUniqueValues('system_type').map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn-icon" onClick={fetchRequests} title="Refresh Data">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>System</th>
              <th>Requester</th>
              <th>Traffic Route</th>
              <th>Service</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr><td colSpan="7" className="empty-cell">No requests match your filters.</td></tr>
            ) : (
              filteredRequests.map(req => (
                <tr key={req.id}>
                  <td><span className="id-badge">#{req.id}</span></td>
                  <td>
                    <div className="system-title">{req.system_type}</div>
                    <div className="system-sub">{req.category}</div>
                  </td>
                  <td><strong>{req.requester}</strong></td>
                  <td>
                    <div className="route-display">
                      <span>{req.source_ip}</span>
                      <span className="route-arrow">→</span>
                      <span>{req.destination_ip}</span>
                    </div>
                  </td>
                  <td><span className="code-pill">{req.service}</span></td>
                  <td><span className={`status-pill ${req.status?.toLowerCase()}`}>{req.status}</span></td>
                  
                  {/* FIX: The missing Review Button is now here! */}
                  <td className="text-right">
                    <button 
                      className="btn-review" 
                      onClick={() => { setSelectedRequest(req); setShowDetails(true); }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showDetails && selectedRequest && (
        <div className="modal-backdrop" onClick={() => setShowDetails(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Request <span className="text-highlight">#{selectedRequest.id}</span></h2>
                <p className="modal-subtitle">Submitted by {selectedRequest.requester} on {new Date(selectedRequest.created_at).toLocaleDateString()}</p>
              </div>
              <button className="close-btn" onClick={() => setShowDetails(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="detail-box">
                  <label>System Type</label>
                  <p>{selectedRequest.system_type}</p>
                </div>
                <div className="detail-box">
                  <label>Category</label>
                  <p>{selectedRequest.category}</p>
                </div>
                <div className="detail-box full">
                  <label>Traffic Pipeline</label>
                  <div className="flow-display">
                    <div className="flow-node">
                      <span className="flow-ip">{selectedRequest.source_ip}</span>
                      <span className="flow-host">{selectedRequest.source_host || 'Unknown Host'}</span>
                    </div>
                    <div className="flow-divider">
                      <div className="flow-line"></div>
                      <span className="flow-port">{selectedRequest.service}</span>
                      <div className="flow-line"></div>
                    </div>
                    <div className="flow-node">
                      <span className="flow-ip">{selectedRequest.destination_ip}</span>
                      <span className="flow-host">{selectedRequest.destination_host || 'Unknown Host'}</span>
                    </div>
                  </div>
                </div>
                <div className="detail-box full">
                  <label>Business Justification</label>
                  <div className="reason-box">{selectedRequest.reason}</div>
                </div>
              </div>

              <div className="comments-section">
                <h3>Discussion & Notes</h3>
                <div className="comments-list">
                  {selectedRequest.comments?.length > 0 ? selectedRequest.comments.map((c, i) => (
                    <div key={i} className={`comment-bubble ${c.author === 'reviewer' ? 'own-comment' : ''}`}>
                      <div className="comment-meta">
                        <strong>{c.author}</strong>
                        <span>{new Date(c.timestamp || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p>{c.comment}</p>
                    </div>
                  )) : <div className="empty-comments">No notes attached to this request.</div>}
                </div>
                <div className="comment-input">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Type an internal note or question..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment(selectedRequest.id)}
                  />
                  <button onClick={() => handleAddComment(selectedRequest.id)}>Send</button>
                </div>
              </div>
            </div>

            {/* FIX: The missing Approval Footer is now active! */}
            <div className="modal-footer">
              {selectedRequest.status === 'Pending' ? (
                <>
                  <button className="btn-reject-lg" onClick={() => updateRequestStatus(selectedRequest.id, 'Rejected', 'Rejected by reviewer')}>
                    Reject Request
                  </button>
                  <button className="btn-approve-lg" onClick={() => updateRequestStatus(selectedRequest.id, 'Approved', 'Approved by reviewer')}>
                    Authorize & Approve
                  </button>
                </>
              ) : (
                <div className="status-locked">
                  This request has already been <strong>{selectedRequest.status}</strong> and cannot be modified.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx="true">{`
      /* SAAS PREMIUM THEME VARIABLES */
      .light-mode {
        --bg-main: #f8fafc;
        --bg-card: #ffffff;
        --text-main: #0f172a;
        --text-light: #64748b;
        --border: #e2e8f0;
        --accent-bg: #f1f5f9;
        --input-bg: #ffffff;
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        --focus-ring: rgba(99, 102, 241, 0.2);
        --brand: #6366f1;
      }

      .dark-mode {
        --bg-main: #0b0f19;
        --bg-card: #111827;
        --text-main: #f3f4f6;
        --text-light: #9ca3af;
        --border: #1f2937;
        --accent-bg: #1f2937;
        --input-bg: #0b0f19;
        --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        --focus-ring: rgba(99, 102, 241, 0.4);
        --brand: #818cf8;
      }

      /* GLOBAL STYLES */
      .reviewer-container {
        padding: 2.5rem;
        background-color: var(--bg-main);
        min-height: 100vh;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: var(--text-main);
        transition: all 0.3s ease;
      }

      .text-highlight { color: var(--brand); }
      .text-right { text-align: right !important; }

      /* TOP BAR */
      .top-bar {
        display: flex; justify-content: space-between; align-items: flex-end;
        margin-bottom: 2.5rem;
      }
      h1 { font-size: 2rem; font-weight: 800; margin: 0 0 0.25rem 0; letter-spacing: -0.02em; }
      .subtitle { color: var(--text-light); margin: 0; font-size: 1rem; }

      .actions { display: flex; gap: 1rem; align-items: center; }

      .theme-toggle {
        background: transparent; color: var(--text-light);
        border: 1px solid var(--border);
        padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer;
        font-weight: 600; transition: all 0.2s;
      }
      .theme-toggle:hover { background: var(--accent-bg); color: var(--text-main); }

      .btn-secondary, .btn-success {
        padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none;
        transition: all 0.2s; font-size: 0.9rem;
      }
      .btn-secondary { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); box-shadow: var(--shadow); }
      .btn-secondary:hover { border-color: var(--text-light); }
      
      .btn-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
      .btn-success:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3); }

      /* ALERTS */
      .alert {
        padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 2rem; display: flex; justify-content: space-between;
        font-weight: 500; animation: slideIn 0.3s ease;
      }
      .alert.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
      .alert.success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
      @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

      /* STATS GRID */
      .stats-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;
      }
      .stat-card {
        background: var(--bg-card); padding: 1.5rem; border-radius: 12px;
        box-shadow: var(--shadow); border: 1px solid var(--border);
        display: flex; align-items: center; gap: 1.25rem;
        transition: transform 0.2s;
      }
      .stat-card:hover { transform: translateY(-2px); }
      .stat-icon {
        width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
      }
      .stat-card.total .stat-icon { background: rgba(99, 102, 241, 0.1); }
      .stat-card.pending .stat-icon { background: rgba(245, 158, 11, 0.1); }
      .stat-card.approved .stat-icon { background: rgba(16, 185, 129, 0.1); }
      .stat-card.rejected .stat-icon { background: rgba(239, 68, 68, 0.1); }
      
      .stat-card h3 { margin: 0; font-size: 0.85rem; color: var(--text-light); font-weight: 600; }
      .stat-card .number { font-size: 1.75rem; font-weight: 800; margin-top: 0.25rem; color: var(--text-main); }

      /* FILTERS */
      .filters-bar {
        background: var(--bg-card); padding: 1.25rem; border-radius: 12px; display: flex; gap: 1.5rem; align-items: flex-end;
        box-shadow: var(--shadow); margin-bottom: 1.5rem; border: 1px solid var(--border);
      }
      .filter-group { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
      .filter-group label { font-size: 0.75rem; font-weight: 700; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; }
      .filter-group select {
        padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px;
        background: var(--input-bg); color: var(--text-main); font-weight: 500;
        appearance: none; cursor: pointer; transition: border-color 0.2s;
      }
      .filter-group select:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--focus-ring); }
      .btn-icon { 
        padding: 0.75rem; background: var(--accent-bg); border: 1px solid var(--border); 
        border-radius: 8px; cursor: pointer; color: var(--text-main); transition: all 0.2s; 
      }
      .btn-icon:hover { background: var(--border); }

      /* TABLE */
      .table-wrapper {
        background: var(--bg-card); border-radius: 12px; box-shadow: var(--shadow);
        overflow: hidden; border: 1px solid var(--border);
      }
      .modern-table { width: 100%; border-collapse: collapse; }
      .modern-table th {
        background: var(--bg-main); padding: 1rem 1.5rem; text-align: left; font-size: 0.75rem; 
        text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 0.05em;
        border-bottom: 1px solid var(--border);
      }
      .modern-table td { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); font-size: 0.9rem; vertical-align: middle; }
      .modern-table tr:last-child td { border-bottom: none; }
      .modern-table tr:hover { background: var(--accent-bg); }

      .id-badge { color: var(--text-light); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
      .system-title { font-weight: 600; color: var(--text-main); }
      .system-sub { font-size: 0.8rem; color: var(--text-light); margin-top: 0.25rem; }
      
      .route-display { display: flex; align-items: center; gap: 0.75rem; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
      .route-arrow { color: var(--brand); font-weight: bold; }

      .code-pill { background: var(--bg-main); padding: 4px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; border: 1px solid var(--border); color: var(--brand); font-weight: 600; }

      .status-pill {
        padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;
      }
      .status-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
      .status-pill.pending { background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.2); }
      .status-pill.pending::before { background: #d97706; }
      .status-pill.approved, .status-pill.completed { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }
      .status-pill.approved::before { background: #059669; }
      .status-pill.rejected { background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.2); }
      .status-pill.rejected::before { background: #dc2626; }

      .btn-review {
        padding: 8px 16px; font-size: 0.85rem; background: transparent; border: 1px solid var(--border);
        border-radius: 6px; cursor: pointer; color: var(--text-main); font-weight: 600; transition: all 0.2s;
      }
      .btn-review:hover { background: var(--text-main); color: var(--bg-card); border-color: var(--text-main); }
      .empty-cell { text-align: center; color: var(--text-light); padding: 3rem !important; font-style: italic; }

      /* MODAL */
      .modal-backdrop {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
        z-index: 1000; display: flex; justify-content: center; align-items: center;
        padding: 1rem;
      }
      .modal-panel {
        background: var(--bg-card); width: 700px; max-width: 100%; max-height: 90vh;
        border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex; flex-direction: column; animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        color: var(--text-main); border: 1px solid var(--border);
      }
      @keyframes modalPop { 
        from { transform: scale(0.95) translateY(10px); opacity: 0; } 
        to { transform: scale(1) translateY(0); opacity: 1; } 
      }

      .modal-header { padding: 2rem 2rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; }
      .modal-header h2 { margin: 0; font-size: 1.5rem; }
      .modal-subtitle { color: var(--text-light); margin: 0.5rem 0 0 0; font-size: 0.9rem; }
      .close-btn { background: var(--accent-bg); border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; color: var(--text-light); transition: all 0.2s; }
      .close-btn:hover { background: #ef4444; color: white; }

      .modal-body { padding: 2rem; overflow-y: auto; }
      .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 3rem; }
      .detail-box label { display: block; font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; font-weight: 700; }
      .detail-box p { margin: 0; font-weight: 600; font-size: 1rem; }
      .full { grid-column: 1 / -1; }

      .flow-display {
        background: var(--bg-main); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border);
        display: flex; justify-content: space-between; align-items: center;
      }
      .flow-node { display: flex; flex-direction: column; gap: 0.25rem; }
      .flow-node:last-child { text-align: right; }
      .flow-ip { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--brand); font-size: 1.1rem; }
      .flow-host { font-size: 0.8rem; color: var(--text-light); }
      .flow-divider { display: flex; align-items: center; flex: 1; margin: 0 1.5rem; gap: 0.5rem; }
      .flow-line { height: 2px; background: var(--border); flex: 1; position: relative; }
      .flow-port { background: var(--bg-card); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border); font-size: 0.8rem; font-weight: 600; font-family: 'JetBrains Mono', monospace; }

      .reason-box { background: var(--accent-bg); padding: 1.25rem; border-radius: 8px; line-height: 1.6; color: var(--text-main); font-size: 0.95rem; border-left: 4px solid var(--brand); }

      .comments-section h3 { font-size: 1.1rem; margin: 0 0 1.5rem 0; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
      .comments-list { display: flex; flex-direction: column; gap: 1rem; max-height: 200px; overflow-y: auto; margin-bottom: 1.5rem; padding-right: 0.5rem; }
      .empty-comments { color: var(--text-light); font-style: italic; font-size: 0.9rem; text-align: center; padding: 2rem 0; }
      .comment-bubble { background: var(--accent-bg); padding: 1rem; border-radius: 12px 12px 12px 2px; width: 85%; }
      .comment-bubble.own-comment { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px 12px 2px 12px; align-self: flex-end; }
      .comment-meta { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem; }
      .comment-meta strong { color: var(--brand); }
      .comment-meta span { color: var(--text-light); }
      .comment-bubble p { margin: 0; font-size: 0.95rem; line-height: 1.5; }

      .comment-input { display: flex; gap: 0.75rem; }
      .comment-input input {
        flex: 1; padding: 0.8rem 1rem; border: 1px solid var(--border); border-radius: 8px;
        background: var(--bg-main); color: var(--text-main); transition: border-color 0.2s;
      }
      .comment-input input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--focus-ring); }
      .comment-input button { padding: 0.8rem 1.5rem; background: var(--text-main); color: var(--bg-card); border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
      .comment-input button:hover { opacity: 0.9; }

      .modal-footer {
        padding: 1.5rem 2rem; border-top: 1px solid var(--border); background: var(--bg-main);
        border-radius: 0 0 16px 16px; display: flex; gap: 1rem;
      }
      .btn-approve-lg { flex: 2; padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 1rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); transition: all 0.2s; }
      .btn-approve-lg:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3); }
      
      .btn-reject-lg { flex: 1; padding: 1rem; background: transparent; color: #ef4444; border: 2px solid #ef4444; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: all 0.2s; }
      .btn-reject-lg:hover { background: #ef4444; color: white; }

      .status-locked { flex: 1; text-align: center; padding: 1rem; background: var(--accent-bg); border-radius: 8px; color: var(--text-light); font-size: 0.9rem; }
      .status-locked strong { color: var(--text-main); }

      .loading-screen { display: flex; flex-direction: column; gap: 1rem; height: 100vh; justify-content: center; align-items: center; background: var(--bg-main); color: var(--text-main); font-weight: 600; }
      .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--brand); border-radius: 50%; animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
export default ReviewerPage;