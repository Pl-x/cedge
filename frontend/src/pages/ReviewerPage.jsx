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

  // Workflow stages configuration
  const workflowStages = [
    { id: 'submitted', name: 'Submitted', description: 'Request has been submitted by user' },
    { id: 'under_review', name: 'Under Review', description: 'Request is being reviewed by team' },
    { id: 'security_approval', name: 'Security Review', description: 'Security team approval required' },
    { id: 'network_approval', name: 'Network Review', description: 'Network team approval required' },
    { id: 'final_approval', name: 'Final Approval', description: 'Final authorization required' },
    { id: 'implementation', name: 'Implementation', description: 'Ready for implementation' },
    { id: 'completed', name: 'Completed', description: 'Request has been completed' },
    { id: 'rejected', name: 'Rejected', description: 'Request has been rejected' }
  ];

  // Fetch all requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/acl_requests`,{
        headers:{
        "Authorization": `Bearer ${token}`
        }
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

  // Update request workflow stage
  const updateRequestStage = async (requestId, newStage, comments = "") => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/acl_requests/${requestId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          stage: newStage,
          status: newStage === 'rejected' ? 'Rejected' : 
                  newStage === 'completed' ? 'Completed' : 'In Progress',
          comments: comments,
          updated_by: "reviewer"
        })
      });

      if (response.ok) {
        fetchRequests();
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest({...selectedRequest, stage: newStage});
        }
        setError(""); // Clear any previous errors
      } else {
        throw new Error("Failed to update request");
      }
    } catch (err) {
      setError(`Error updating request: ${err.message}`);
    }
  };

  // Add comment to request
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
        // Refresh selected request
        if (selectedRequest && selectedRequest.id === requestId) {
          const updatedResponse = await fetch(`${API_BASE_URL}/acl_requests`);
          if (updatedResponse.ok) {
            const data = await updatedResponse.json();
            const updatedRequest = data.acl_requests.find(req => req.id === requestId);
            if (updatedRequest) setSelectedRequest(updatedRequest);
          }
        }
        setError(""); // Clear any previous errors
      } else {
        throw new Error("Failed to add comment");
      }
    } catch (err) {
      setError(`Error adding comment: ${err.message}`);
    }
  };

  // Filter requests based on selected filters
  const filteredRequests = requests.filter(request => {
    if (filters.status !== "all" && request.status !== filters.status) return false;
    if (filters.category !== "all" && request.category !== filters.category) return false;
    if (filters.system_type !== "all" && request.system_type !== filters.system_type) return false;
    return true;
  });

  // Get current stage index
  const getCurrentStageIndex = (request) => {
    const currentStage = request.stage || 'submitted';
    return workflowStages.findIndex(stage => stage.id === currentStage);
  };

  // Get next available stages
  const getNextStages = (request) => {
    const currentIndex = getCurrentStageIndex(request);
    return workflowStages.slice(currentIndex + 1);
  };

  // Get unique values for filters
  const getUniqueValues = (key) => {
    return [...new Set(requests.map(req => req[key]).filter(Boolean))];
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Download Excel file
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
        setDownloadSuccess('✅ Excel file downloaded successfully!');
        setTimeout(() => setDownloadSuccess(''), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setDownloadError(`Failed to download Excel: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setDownloadError(`Failed to download Excel: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="loading">Loading requests...</div>;
  }

  return (
    <div className="reviewer-container">
      <div className="reviewer-header">
      <div className='header-title'>
        <h1>🔧 ACL Request Workflow Management</h1>
        <p>Manage and track ACL requests through approval workflow</p>
      </div>
      <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <button
      className="btn-action"
      onClick={handleDownloadExcel}
      style={{
        backgroundColor: '#28a745',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}
      title="Download Excel report of all requests"
      >
      📥 Download Excel
      </button>
      <button
      className="btn-action"
      onClick={() => navigate('/templates')}
      style={{
        backgroundColor: '#007bff',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }}
      >
      📋 Manage Templates
      </button>
        <LogoutButton />
      </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")} className="btn-close-error">×</button>
        </div>
      )}

      {downloadSuccess && (
        <div className="success-message" style={{ backgroundColor: '#d4edda', color: '#155724', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
          {downloadSuccess}
        </div>
      )}

      {downloadError && (
        <div className="error-message" style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
          {downloadError}
          <button onClick={() => setDownloadError("")} className="btn-close-error">×</button>
        </div>
      )}

      {/* Statistics Dashboard */}
      <div className="stats-dashboard">
        <div className="stat-card">
          <div className="stat-number">{requests.length}</div>
          <div className="stat-label">Total Requests</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{requests.filter(r => !r.stage || r.stage === 'submitted').length}</div>
          <div className="stat-label">New</div>
        </div>
        <div className="stat-card in-progress">
          <div className="stat-number">{requests.filter(r => 
            ['under_review', 'security_approval', 'network_approval', 'final_approval', 'implementation'].includes(r.stage)
          ).length}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-number">{requests.filter(r => r.stage === 'completed').length}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-number">{requests.filter(r => r.stage === 'rejected').length}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filter-controls">
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Category:</label>
            <select 
              value={filters.category} 
              onChange={(e) => setFilters({...filters, category: e.target.value})}
            >
              <option value="all">All Categories</option>
              {getUniqueValues('category').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>System Type:</label>
            <select 
              value={filters.system_type} 
              onChange={(e) => setFilters({...filters, system_type: e.target.value})}
            >
              <option value="all">All System Types</option>
              {getUniqueValues('system_type').map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button onClick={fetchRequests} className="btn-refresh">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="requests-list-container">
        <h3>Workflow Queue ({filteredRequests.length})</h3>
        
        {filteredRequests.length === 0 ? (
          <div className="empty-state">
            <p>No requests found matching your filters.</p>
          </div>
        ) : (
          <div className="requests-grid">
            {filteredRequests.map((request) => (
              <div key={request.id} className="workflow-card">
                <div className="card-header">
                  <div className="request-info">
                    <h4>REQ{request.id} - {request.category}</h4>
                    <span className="requester">Requested by: {request.requester}</span>
                    <span className="request-date">
                      Submitted: {new Date(request.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="request-actions">
                    <span className={`stage-badge stage-${request.stage || 'submitted'}`}>
                      {workflowStages.find(s => s.id === (request.stage || 'submitted'))?.name || 'Submitted'}
                    </span>
                    <button 
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetails(true);
                      }}
                      className="btn-view-details"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                <div className="workflow-progress">
                  <div className="progress-bar">
                    {workflowStages.map((stage, index) => {
                      const currentIndex = getCurrentStageIndex(request);
                      const isCompleted = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      const isFuture = index > currentIndex;
                      
                      return (
                        <div key={stage.id} className="progress-step">
                          <div className={`step-indicator ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isFuture ? 'future' : ''}`}>
                            {isCompleted ? '✓' : index + 1}
                          </div>
                          <div className="step-label">{stage.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card-preview">
                  <div className="preview-details">
                    <span><strong>System Type:</strong> {request.system_type}</span>
                    <span><strong>Source IP:</strong> {request.source_ip}</span>
                    <span><strong>Service:</strong> {request.service}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {showDetails && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Request Details - REQ{selectedRequest.id}</h2>
              <button 
                onClick={() => {
                  setShowDetails(false);
                  setSelectedRequest(null);
                  setNewComment("");
                }}
                className="btn-close"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Workflow Progress */}
              <div className="workflow-details">
                <h3>Workflow Progress</h3>
                <div className="detailed-progress">
                  {workflowStages.map((stage, index) => {
                    const currentIndex = getCurrentStageIndex(selectedRequest);
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    
                    return (
                      <div key={stage.id} className={`progress-stage ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                        <div className="stage-header">
                          <div className="stage-indicator">
                            {isCompleted ? '✓' : index + 1}
                          </div>
                          <div className="stage-info">
                            <strong>{stage.name}</strong>
                            <span>{stage.description}</span>
                          </div>
                          <div className="stage-status">
                            {isCompleted && <span className="status-completed">Completed</span>}
                            {isCurrent && <span className="status-current">In Progress</span>}
                            {!isCompleted && !isCurrent && <span className="status-pending">Pending</span>}
                          </div>
                        </div>
                        
                        {isCurrent && (
                          <div className="stage-actions">
                            <h4>Actions:</h4>
                            <div className="action-buttons">
                              {getNextStages(selectedRequest).map(nextStage => (
                                <button
                                  key={nextStage.id}
                                  onClick={() => updateRequestStage(selectedRequest.id, nextStage.id)}
                                  className={`btn-action btn-${nextStage.id}`}
                                >
                                  Move to {nextStage.name}
                                </button>
                              ))}
                              <button
                                onClick={() => updateRequestStage(selectedRequest.id, 'rejected', 'Rejected by reviewer')}
                                className="btn-action btn-reject"
                              >
                                Reject Request
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Request Details */}
              <div className="request-details-section">
                <h3>Request Information</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <strong>System Type:</strong> {selectedRequest.system_type}
                  </div>
                  <div className="detail-item">
                    <strong>Category:</strong> {selectedRequest.category}
                  </div>
                  <div className="detail-item">
                    <strong>Source IP:</strong> {selectedRequest.source_ip}
                  </div>
                  <div className="detail-item">
                    <strong>Source Host:</strong> {selectedRequest.source_host || 'N/A'}
                  </div>
                  <div className="detail-item">
                    <strong>Destination IP:</strong> {selectedRequest.destination_ip || 'N/A'}
                  </div>
                  <div className="detail-item">
                    <strong>Destination Host:</strong> {selectedRequest.destination_host || 'N/A'}
                  </div>
                  <div className="detail-item">
                    <strong>Service:</strong> {selectedRequest.service}
                  </div>
                  <div className="detail-item full-width">
                    <strong>Reason:</strong> {selectedRequest.reason}
                  </div>
                  <div className="detail-item">
                    <strong>Action:</strong> {selectedRequest.action || 'N/A'}
                  </div>
                  <div className="detail-item">
                    <strong>Requester:</strong> {selectedRequest.requester}
                  </div>
                  <div className="detail-item">
                    <strong>Status:</strong> {selectedRequest.status}
                  </div>
                  <div className="detail-item">
                    <strong>Submitted:</strong> {new Date(selectedRequest.created_at).toLocaleString()}
                  </div>
                  {selectedRequest.updated_at && (
                    <div className="detail-item">
                      <strong>Last Updated:</strong> {new Date(selectedRequest.updated_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="comments-section">
                <h3>Comments & Notes</h3>
                <div className="comments-list">
                  {selectedRequest.comments && selectedRequest.comments.length > 0 ? (
                    selectedRequest.comments.map((comment, index) => (
                      <div key={index} className="comment-item">
                        <div className="comment-header">
                          <strong>{comment.author || 'System'}</strong>
                          <span>{new Date(comment.timestamp || comment.created_at).toLocaleString()}</span>
                        </div>
                        <div className="comment-text">{comment.comment || comment.content}</div>
                      </div>
                    ))
                  ) : (
                    <p>No comments yet.</p>
                  )}
                </div>
                <div className="add-comment">
                  <textarea 
                    placeholder="Add a comment or note..."
                    rows="3"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button 
                    onClick={() => handleAddComment(selectedRequest.id)}
                    className="btn-add-comment"
                    disabled={!newComment.trim()}
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowDetails(false);
                  setSelectedRequest(null);
                  setNewComment("");
                }}
                className="btn-close-modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewerPage;
