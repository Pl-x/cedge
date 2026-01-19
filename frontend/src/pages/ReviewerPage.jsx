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

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/acl_requests`,{
        headers:{ "Authorization": `Bearer ${token}` }
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
          setSelectedRequest(prev => ({...prev, status: newStatus}));
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
          headers:{ "Authorization": `Bearer ${token}` }
        });
        const data = await updatedReq.json();
        const freshData = data.acl_requests.find(r => r.id === requestId);
        if(freshData) setSelectedRequest(freshData);
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

  if (loading) return <div className={`loading-screen ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>Loading...</div>;

  return (
    <div className={`reviewer-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
    {/* HEADER */}
    <div className="top-bar">
    <div>
    <h1>Reviewer Dashboard</h1>
    <p className="subtitle">Manage network access requests</p>
    </div>
    <div className="actions">
    <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
    {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
    <button className="btn-success" onClick={handleDownloadExcel}>📥 Excel</button>
    <button className="btn-primary" onClick={() => navigate('/templates')}>📋 Templates</button>
    <LogoutButton />
    </div>
    </div>

    {/* ALERTS */}
    {error && <div className="alert error">{error} <button onClick={() => setError("")}>×</button></div>}
    {downloadSuccess && <div className="alert success">{downloadSuccess}</div>}

    {/* STATS */}
    <div className="stats-grid">
    <div className="stat-card total">
    <h3>Total</h3>
    <div className="number">{requests.length}</div>
    </div>
    <div className="stat-card pending">
    <h3>Pending</h3>
    <div className="number">{requests.filter(r => r.status === 'Pending').length}</div>
    </div>
    <div className="stat-card approved">
    <h3>Approved</h3>
    <div className="number">{requests.filter(r => ['Approved','Completed'].includes(r.status)).length}</div>
    </div>
    <div className="stat-card rejected">
    <h3>Rejected</h3>
    <div className="number">{requests.filter(r => r.status === 'Rejected').length}</div>
    </div>
    </div>

    {/* FILTERS */}
    <div className="filters-bar">
    <div className="filter-group">
    <label>Status</label>
    <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
    <option value="all">All Statuses</option>
    <option value="Pending">Pending</option>
    <option value="Approved">Approved</option>
    <option value="Rejected">Rejected</option>
    </select>
    </div>
    <div className="filter-group">
    <label>Category</label>
    <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
    <option value="all">All Categories</option>
    {getUniqueValues('category').map(c => <option key={c} value={c}>{c}</option>)}
    </select>
    </div>
    <div className="filter-group">
    <label>System</label>
    <select value={filters.system_type} onChange={e => setFilters({...filters, system_type: e.target.value})}>
    <option value="all">All Systems</option>
    {getUniqueValues('system_type').map(s => <option key={s} value={s}>{s}</option>)}
    </select>
    </div>
    <button className="btn-icon" onClick={fetchRequests} title="Refresh">🔄</button>
    </div>

    {/* DATA TABLE */}
    <div className="table-wrapper">
    <table className="modern-table">
    <thead>
    <tr>
    <th>ID</th>
    <th>System</th>
    <th>Category</th>
    <th>Requester</th>
    <th>Source</th>
    <th>Destination</th>
    <th>Service</th>
    <th>Status</th>
    <th>Action</th>
    </tr>
    </thead>
    <tbody>
    {filteredRequests.length === 0 ? (
      <tr><td colSpan="9" className="empty-cell">No requests found</td></tr>
    ) : (
      filteredRequests.map(req => (
        <tr key={req.id}>
        <td><span className="id-badge">#{req.id}</span></td>
        <td>{req.system_type}</td>
        <td>{req.category}</td>
        <td><strong>{req.requester}</strong></td>
        <td>{req.source_ip}</td>
        <td>{req.destination_ip}</td>
        <td><span className="code-pill">{req.service}</span></td>
        <td><span className={`status-pill ${req.status?.toLowerCase()}`}>{req.status}</span></td>
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
      <h2>Request #{selectedRequest.id} Details</h2>
      <button className="close-btn" onClick={() => setShowDetails(false)}>×</button>
      </div>

      <div className="modal-body">
      <div className="details-grid">
      <div className="detail-box">
      <label>Requester</label>
      <p>{selectedRequest.requester}</p>
      </div>
      <div className="detail-box">
      <label>Submitted</label>
      <p>{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
      </div>
      <div className="detail-box">
      <label>System Type</label>
      <p>{selectedRequest.system_type}</p>
      </div>
      <div className="detail-box">
      <label>Category</label>
      <p>{selectedRequest.category}</p>
      </div>
      <div className="detail-box full">
      <label>Traffic Flow</label>
      <div className="flow-display">
      <span>{selectedRequest.source_ip} <small>({selectedRequest.source_host || 'No Host'})</small></span>
      <span className="arrow">➜</span>
      <span>{selectedRequest.destination_ip} <small>({selectedRequest.destination_host || 'No Host'})</small></span>
      </div>
      </div>
      <div className="detail-box full">
      <label>Service / Port</label>
      <p className="mono">{selectedRequest.service}</p>
      </div>
      <div className="detail-box full">
      <label>Reason</label>
      <p className="description-text">{selectedRequest.reason}</p>
      </div>
      </div>

      <div className="comments-section">
      <h3>Comments</h3>
      <div className="comments-list">
      {selectedRequest.comments?.length > 0 ? selectedRequest.comments.map((c, i) => (
        <div key={i} className="comment">
        <strong>{c.author}:</strong> {c.comment}
        </div>
      )) : <p className="no-comments">No comments yet.</p>}
      </div>
      <div className="comment-input">
      <input
      value={newComment}
      onChange={e => setNewComment(e.target.value)}
      placeholder="Add internal note..."
      />
      <button onClick={() => handleAddComment(selectedRequest.id)}>Post</button>
      </div>
      </div>
      </div>

      {/* <div className="modal-footer">
      <button className="btn-reject-lg" onClick={() => updateRequestStatus(selectedRequest.id, 'Rejected', 'Rejected by reviewer')}>
      ✕ Reject
      </button>
      <button className="btn-approve-lg" onClick={() => updateRequestStatus(selectedRequest.id, 'Approved', 'Approved by reviewer')}>
      ✓ Approve
      </button>
      </div> */}
      </div>
      </div>
    )}

    <style jsx="true">{`
      /* THEME VARIABLES */
      .light-mode {
        --bg-main: #f4f6f9;
        --bg-card: #ffffff;
        --text-main: #333333;
        --text-light: #64748b;
        --border: #e2e8f0;
        --accent-bg: #f8fafc;
        --input-bg: #ffffff;
        --shadow: rgba(0,0,0,0.05);
      }

      .dark-mode {
        --bg-main: #1a1d21;
        --bg-card: #2a2e33;
        --text-main: #e1e1e1;
        --text-light: #a0aab4;
        --border: #40464f;
        --accent-bg: #32383e;
        --input-bg: #1f2328;
        --shadow: rgba(0,0,0,0.3);
      }

      /* GLOBAL STYLES */
      .reviewer-container {
        padding: 2rem;
        background-color: var(--bg-main);
        min-height: 100vh;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: var(--text-main);
        transition: background-color 0.3s, color 0.3s;
      }

      /* TOP BAR */
      .top-bar {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 2rem;
      }
      h1 { font-size: 1.8rem; font-weight: 700; margin: 0; }
      .subtitle { color: var(--text-light); margin: 0; font-size: 0.9rem; }

      .actions { display: flex; gap: 0.75rem; align-items: center; }

      .theme-toggle {
        background: var(--bg-card); color: var(--text-main);
        border: 1px solid var(--border);
        padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer;
      }

      .btn-primary, .btn-success {
        padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; color: white;
        transition: filter 0.2s;
      }
      .btn-primary { background-color: #007bff; }
      .btn-success { background-color: #28a745; }
      .btn-primary:hover, .btn-success:hover { filter: brightness(1.1); }

      /* ALERTS */
      .alert {
        padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; display: flex; justify-content: space-between;
      }
      .alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
      .alert.success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

      /* STATS GRID */
      .stats-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;
      }
      .stat-card {
        background: var(--bg-card); padding: 1.5rem; border-radius: 8px;
        box-shadow: 0 1px 3px var(--shadow);
        border-top: 4px solid transparent;
        color: var(--text-main);
      }
      .stat-card.total { border-color: #007bff; }
      .stat-card.pending { border-color: #ffc107; }
      .stat-card.approved { border-color: #28a745; }
      .stat-card.rejected { border-color: #dc3545; }
      .stat-card h3 { margin: 0; font-size: 0.85rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; }
      .stat-card .number { font-size: 2rem; font-weight: 800; margin-top: 0.5rem; }

      /* FILTERS */
      .filters-bar {
        background: var(--bg-card); padding: 1rem; border-radius: 8px; display: flex; gap: 1rem; align-items: flex-end;
        box-shadow: 0 1px 2px var(--shadow); margin-bottom: 1.5rem;
        border: 1px solid var(--border);
      }
      .filter-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
      .filter-group label { font-size: 0.75rem; font-weight: 600; color: var(--text-light); }
      .filter-group select {
        padding: 0.6rem; border: 1px solid var(--border); border-radius: 6px;
        background: var(--input-bg); color: var(--text-main);
      }
      .btn-icon { padding: 0.6rem; background: var(--accent-bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }

      /* TABLE */
      .table-wrapper {
        background: var(--bg-card); border-radius: 8px; box-shadow: 0 4px 6px -1px var(--shadow);
        overflow: hidden; border: 1px solid var(--border);
      }
      .modern-table { width: 100%; border-collapse: collapse; }
      .modern-table th {
        background: var(--accent-bg); padding: 1rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; color: var(--text-light);
        border-bottom: 1px solid var(--border);
      }
      .modern-table td { padding: 1rem; border-bottom: 1px solid var(--border); font-size: 0.9rem; color: var(--text-main); }
      .modern-table tr:hover { background: var(--accent-bg); }

      .id-badge { color: var(--text-light); font-family: monospace; }
      .code-pill { background: var(--accent-bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; border: 1px solid var(--border); }

      .status-pill {
        padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-block;
      }
      .status-pill.pending { background: #fff3cd; color: #856404; }
      .status-pill.approved, .status-pill.completed { background: #d4edda; color: #155724; }
      .status-pill.rejected { background: #f8d7da; color: #721c24; }

      .btn-sm {
        padding: 4px 10px; font-size: 0.8rem; background: transparent; border: 1px solid var(--border);
        border-radius: 4px; cursor: pointer; color: #007bff; font-weight: 500;
      }
      .btn-sm:hover { background: #007bff; color: white; border-color: #007bff; }

      /* MODAL */
      .modal-backdrop {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        z-index: 1000; display: flex; justify-content: center; align-items: center;
      }
      .modal-panel {
        background: var(--bg-card); width: 600px; max-width: 90%; max-height: 90vh;
        border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        display: flex; flex-direction: column; animation: slideUp 0.2s ease-out;
        color: var(--text-main);
        border: 1px solid var(--border);
      }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

      .modal-header { padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
      .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-light); }

      .modal-body { padding: 1.5rem; overflow-y: auto; }
      .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
      .detail-box label { display: block; font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; margin-bottom: 0.25rem; font-weight: 600; }
      .detail-box p { margin: 0; font-weight: 500; }
      .full { grid-column: 1 / -1; }

      .flow-display {
        background: var(--accent-bg); padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 1rem; border: 1px solid var(--border);
      }
      .flow-display .arrow { color: var(--text-light); }
      .mono { font-family: monospace; }
      .description-text { line-height: 1.5; color: var(--text-main); }

      .comments-section h3 { font-size: 1rem; margin-bottom: 1rem; }
      .comments-list { background: var(--accent-bg); padding: 1rem; border-radius: 8px; max-height: 150px; overflow-y: auto; margin-bottom: 1rem; }
      .comment { margin-bottom: 0.5rem; font-size: 0.9rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
      .comment:last-child { border: none; }

      .comment-input { display: flex; gap: 0.5rem; }
      .comment-input input {
        flex: 1; padding: 0.6rem; border: 1px solid var(--border); border-radius: 6px;
        background: var(--input-bg); color: var(--text-main);
      }
      .comment-input button { padding: 0.6rem 1rem; background: var(--text-main); color: var(--bg-card); border: none; border-radius: 6px; cursor: pointer; }

      .modal-footer {
        padding: 1.5rem; border-top: 1px solid var(--border); display: flex; gap: 1rem; background: var(--accent-bg); border-radius: 0 0 12px 12px;
      }
      .btn-approve-lg { flex: 1; padding: 0.8rem; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 1rem; }
      .btn-reject-lg { flex: 1; padding: 0.8rem; background: transparent; color: #dc3545; border: 2px solid #dc3545; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 1rem; }
      .btn-reject-lg:hover { background: #dc3545; color: white; }

      .loading-screen { display: flex; height: 100vh; justify-content: center; align-items: center; background: var(--bg-main); color: var(--text-main); }
      `}</style>
      </div>
  );
}
export default ReviewerPage;
