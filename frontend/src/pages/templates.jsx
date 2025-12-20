import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/auth';
import { API_BASE_URL } from '../config';

const TemplatesPage = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [userRole, setuserRole] = useState('');
    const [filters, setFilters] = useState({
        system_type: '',
        category: '',
        requester: ''
    });

    // Form state for creating a template
    const initialFormState = {
        template_name: '',
        system_type: '',
        category: '',
        source_ip: '',
        source_host: '',
        destination_ip: '',
        destination_host: '',
        service: '',
        description: '',
        action: 'allow'
    };
    const [newTemplate, setNewTemplate] = useState(initialFormState);
    useEffect(() => {
        const useStr = localStorage.getItem('user')
        if (useStr){
            const user = JSON.parse(useStr)
            setuserRole(user.role || 'user')
        }
        const delayDebounceFn = setTimeout(() => {
            fetchTemplates();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [filters]);

    const fetchTemplates = async () => {
        setLoading(true);
        setError('');
        
        try {
            // Build query string from filters
            const queryParams = new URLSearchParams();
            if (filters.system_type) queryParams.append('system_type', filters.system_type);
            if (filters.category) queryParams.append('category', filters.category);
            if (filters.requester) queryParams.append('requester', filters.requester);
            
            const url = `${API_BASE_URL}/api/v1/templates${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await fetchWithAuth(url);
            const data = await response.json();
            
            if (response.ok) {
                setTemplates(data.templates || []);
            } else {
                setError(data.error || 'Failed to fetch templates');
            }
        } catch (err) {
            console.error('Error fetching templates:', err);
            setError('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const useTemplate = async (templateId) => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/templates/${templateId}/use`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setSuccess(`ACL request created from template: ${data.request.template_name}`);
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to use template');
            }
        } catch (err) {
            console.error('Error using template:', err);
            setError('Failed to create request from template');
        }
    };

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/user/template`, {
                method: 'POST',
                body: JSON.stringify(newTemplate)
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Template "${data.template?.template_name}" created successfully!`);
                setShowCreateModal(false);
                setNewTemplate(initialFormState); // Reset form
                fetchTemplates(); // Refresh list
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to create template');
            }
        } catch (err) {
            console.error('Error creating template:', err);
            setError('Failed to create template. Check console for details.');
        }
    };
    const deleteTemplate = async (templateId) => {
        if (!window.confirm('Are you sure you want to delete this template?')) {
            return;
        }
        
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/templates/${templateId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setSuccess('Template deleted successfully');
                fetchTemplates();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to delete template');
            }
        } catch (err) {
            console.error('Error deleting template:', err);
            setError('Failed to delete template');
        }
    };

    const viewTemplateDetails = (template) => {
        setSelectedTemplate(template);
        setShowModal(true);
    };

    return (
        <div className="templates-page">
            <div className="page-header">
            <div className="header-content">
            <div>
            <h1>📋 ACL Request Templates</h1>
            <p>Use pre-configured templates to quickly create ACL requests</p>
            </div>
            {userRole === 'admin' && (
            <button
            className="btn-create"
            onClick={() => setShowCreateModal(true)}
            >
            + Create New Template
            </button>
            )}
            </div>
            </div>

            {success && (
                <div className="alert alert-success">
                    {success}
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="filters-section">
                <h3>Filter Templates</h3>
                <div className="filters-grid">
                    <input
                        type="text"
                        placeholder="System Type"
                        value={filters.system_type}
                        onChange={(e) => setFilters({...filters, system_type: e.target.value})}
                    />
                    <input
                        type="text"
                        placeholder="Category"
                        value={filters.category}
                        onChange={(e) => setFilters({...filters, category: e.target.value})}
                    />
                    <input
                        type="text"
                        placeholder="Requester"
                        value={filters.requester}
                        onChange={(e) => setFilters({...filters, requester: e.target.value})}
                    />
                    <button onClick={() => setFilters({system_type: '', category: '', requester: ''})}>
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Templates Grid */}
            <div className="templates-grid">
            {loading ? (
                <div className="loading" style={{ gridColumn: '1 / -1' }}>
                Loading templates...
                </div>
            ) : templates.length === 0 ? (
                    <div className="no-templates">
                        <p>No templates found</p>
                        <p>Contact support to create templates</p>
                    </div>
                ) : (
                    templates.map(template => (
                        <div key={template.id} className="template-card">
                            <div className="template-header">
                                <h3>{template.template_name}</h3>
                                <span className={`action-badge ${template.action}`}>
                                    {template.action}
                                </span>
                            </div>
                            
                            <div className="template-body">
                                <div className="template-field">
                                    <strong>System:</strong> {template.system_type}
                                </div>
                                <div className="template-field">
                                    <strong>Category:</strong> {template.category}
                                </div>
                                <div className="template-field">
                                    <strong>Source:</strong> {template.source_ip}
                                    {template.source_host && ` (${template.source_host})`}
                                </div>
                                <div className="template-field">
                                    <strong>Destination:</strong> {template.destination_ip}
                                    {template.destination_host && ` (${template.destination_host})`}
                                </div>
                                <div className="template-field">
                                    <strong>Service:</strong> {template.service}
                                </div>
                                {template.description && (
                                    <div className="template-field">
                                        <strong>Description:</strong> {template.description.substring(0, 100)}
                                        {template.description.length > 100 && '...'}
                                    </div>
                                )}
                            </div>
                            
                            <div className="template-footer">
                                <small>Created by: {template.created_by}</small>
                                <div className="template-actions">
                                    <button 
                                        className="btn-use" 
                                        onClick={() => useTemplate(template.id)}
                                    >
                                        Use Template
                                    </button>
                                    <button 
                                        className="btn-view" 
                                        onClick={() => viewTemplateDetails(template)}
                                    >
                                        View Details
                                    </button>
                                    <button 
                                        className="btn-delete" 
                                        onClick={() => deleteTemplate(template.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                <h2>Create New Template</h2>
                <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
                </div>
                <form onSubmit={handleCreateTemplate}>
                <div className="modal-body form-grid">
                <div className="form-group full-width">
                <label>Template Name *</label>
                <input
                type="text"
                required
                value={newTemplate.template_name}
                onChange={(e) => setNewTemplate({...newTemplate, template_name: e.target.value})}
                placeholder="e.g., Web Server Standard Access"
                />
                </div>

                <div className="form-group">
                <label>System Type *</label>
                <input
                type="text"
                required
                value={newTemplate.system_type}
                onChange={(e) => setNewTemplate({...newTemplate, system_type: e.target.value})}
                placeholder="e.g., Linux, Windows"
                />
                </div>

                <div className="form-group">
                <label>Category *</label>
                <input
                type="text"
                required
                value={newTemplate.category}
                onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                placeholder="e.g., Production, Dev"
                />
                </div>

                <div className="form-group">
                <label>Source IP *</label>
                <input
                type="text"
                required
                value={newTemplate.source_ip}
                onChange={(e) => setNewTemplate({...newTemplate, source_ip: e.target.value})}
                placeholder="e.g., 192.168.1.1 or Any"
                />
                </div>

                <div className="form-group">
                <label>Source Host</label>
                <input
                type="text"
                value={newTemplate.source_host}
                onChange={(e) => setNewTemplate({...newTemplate, source_host: e.target.value})}
                />
                </div>

                <div className="form-group">
                <label>Destination IP *</label>
                <input
                type="text"
                required
                value={newTemplate.destination_ip}
                onChange={(e) => setNewTemplate({...newTemplate, destination_ip: e.target.value})}
                placeholder="e.g., 10.0.0.5"
                />
                </div>

                <div className="form-group">
                <label>Destination Host</label>
                <input
                type="text"
                value={newTemplate.destination_host}
                onChange={(e) => setNewTemplate({...newTemplate, destination_host: e.target.value})}
                />
                </div>

                <div className="form-group">
                <label>Service *</label>
                <input
                type="text"
                required
                value={newTemplate.service}
                onChange={(e) => setNewTemplate({...newTemplate, service: e.target.value})}
                placeholder="e.g., tcp/80, 443, ssh"
                />
                </div>

                <div className="form-group">
                <label>Action</label>
                <select
                value={newTemplate.action}
                onChange={(e) => setNewTemplate({...newTemplate, action: e.target.value})}
                >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
                </select>
                </div>

                <div className="form-group full-width">
                <label>Description</label>
                <textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                placeholder="Describe what this template is for..."
                rows="3"
                />
                </div>
                </div>
                <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-create">Create Template</button>
                </div>
                </form>
                </div>
                </div>
            )}
            {/* Template Details Modal */}
            {showModal && selectedTemplate && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedTemplate.template_name}</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>
                                ×
                            </button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="detail-row">
                                <strong>Template ID:</strong>
                                <span>{selectedTemplate.id}</span>
                            </div>
                            <div className="detail-row">
                                <strong>System Type:</strong>
                                <span>{selectedTemplate.system_type}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Category:</strong>
                                <span>{selectedTemplate.category}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Source IP:</strong>
                                <span>{selectedTemplate.source_ip}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Source Host:</strong>
                                <span>{selectedTemplate.source_host || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Destination IP:</strong>
                                <span>{selectedTemplate.destination_ip}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Destination Host:</strong>
                                <span>{selectedTemplate.destination_host || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Service:</strong>
                                <span>{selectedTemplate.service}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Action:</strong>
                                <span className={`action-badge ${selectedTemplate.action}`}>
                                    {selectedTemplate.action}
                                </span>
                            </div>
                            <div className="detail-row">
                                <strong>Description:</strong>
                                <span>{selectedTemplate.description || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Created By:</strong>
                                <span>{selectedTemplate.created_by}</span>
                            </div>
                            <div className="detail-row">
                                <strong>Created At:</strong>
                                <span>{new Date(selectedTemplate.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        <div className="modal-footer">
                            <button 
                                className="btn-primary" 
                                onClick={() => {
                                    useTemplate(selectedTemplate.id);
                                    setShowModal(false);
                                }}
                            >
                                Use This Template
                            </button>
                            <button 
                                className="btn-secondary" 
                                onClick={() => setShowModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx='true'>{`
                .templates-page {
                    padding: 20px;
                }

                .page-header {
                    margin-bottom: 30px;
                }

                .page-header h1 {
                    margin: 0 0 10px 0;
                }

                .page-header p {
                    color: #666;
                    margin: 0;
                }

                .alert {
                    padding: 15px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }

                .alert-success {
                    background-color: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }

                .alert-error {
                    background-color: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }

                .filters-section {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .filters-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }

                .filters-grid input {
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }

                .templates-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }

                .template-card {
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .template-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }

                .template-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #f0f0f0;
                }

                .template-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #333;
                }

                .action-badge {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .action-badge.allow {
                    background-color: #d4edda;
                    color: #155724;
                }

                .action-badge.deny {
                    background-color: #f8d7da;
                    color: #721c24;
                }

                .template-body {
                    margin-bottom: 15px;
                }

                .template-field {
                    margin-bottom: 8px;
                    font-size: 14px;
                    color: #555;
                }

                .template-field strong {
                    color: #333;
                }

                .template-footer {
                    border-top: 1px solid #f0f0f0;
                    padding-top: 15px;
                }

                .template-footer small {
                    display: block;
                    color: #999;
                    margin-bottom: 10px;
                }

                .template-actions {
                    display: flex;
                    gap: 10px;
                }

                .btn-use, .btn-view, .btn-delete {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .btn-use {
                    background-color: #28a745;
                    color: white;
                }

                .btn-use:hover {
                    background-color: #218838;
                }

                .btn-view {
                    background-color: #007bff;
                    color: white;
                }

                .btn-view:hover {
                    background-color: #0056b3;
                }

                .btn-delete {
                    background-color: #dc3545;
                    color: white;
                }

                .btn-delete:hover {
                    background-color: #c82333;
                }

                .no-templates {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 60px 20px;
                    background: white;
                    border-radius: 8px;
                }

                .no-templates p {
                    color: #666;
                    margin: 10px 0;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content {
                    background: white;
                    color: #333;
                    border-radius: 8px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                }

                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .modal-header h2 {
                    margin: 0;
                }

                .close-btn {
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    color: #999;
                }

                .close-btn:hover {
                    color: #333;
                }

                .modal-body {
                    padding: 20px;
                }

                .detail-row {
                    display: grid;
                    grid-template-columns: 150px 1fr;
                    padding: 10px 0;
                    border-bottom: 1px solid #f0f0f0;
                }

                .detail-row strong {
                    color: #666;
                }

                .modal-footer {
                    padding: 20px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }

                .btn-primary, .btn-secondary {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                }

                .btn-primary {
                    background-color: #007bff;
                    color: white;
                }

                .btn-primary:hover {
                    background-color: #0056b3;
                }

                .btn-secondary {
                    background-color: #6c757d;
                    color: white;
                }

                .btn-secondary:hover {
                    background-color: #545b62;
                }

                .loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                .header-content { display: flex; justify-content: space-between; width: 100%; align-items: center; }

                .btn-create {
                    background-color: #28a745;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 14px;
                }
                .btn-create:hover { background-color: #218838; }

                /* Form Styles */
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }
                .full-width { grid-column: 1 / -1; }
                .form-group { display: flex; flex-direction: column; }
                .form-group label { font-weight: 600; font-size: 12px; margin-bottom: 5px; color: #333; }
                .form-group input, .form-group select, .form-group textarea {
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
};

export default TemplatesPage;
