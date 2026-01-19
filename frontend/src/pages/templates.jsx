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
    const [filters, setFilters] = useState({ system_type: '', category: '', requester: '' });
    const [dropdownOptions, setDropdownOptions] = useState({
        system_types: [],
        categories: [],
        services: [],
        source_ips: [],
        destination_ips: []
    });
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Theme State
    const [isDarkMode, setIsDarkMode] = useState(true);
    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    // Multi-rule template state
    const [templateName, setTemplateName] = useState('');
    const [rules, setRules] = useState([{
        system_type: '', category: '', source_ip: '', source_host: '',
        destination_ip: '', destination_host: '', service: '', description: '', action: 'allow'
    }]);

    useEffect(() => {
        const useStr = localStorage.getItem('user');
        if (useStr) {
            const user = JSON.parse(useStr);
            setuserRole(user.role || 'user');
        }
        fetchTemplates();
    }, []);

    const fetchDropdownOptions = async () => {
        setLoadingOptions(true);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/templates/dropdown-options`);
            const data = await response.json();
            if (response.ok) {
                setDropdownOptions(data);
            }
        } catch (err) {
            console.error('Failed to load dropdown options:', err);
        } finally {
            setLoadingOptions(false);
        }
    };

    // Fetch options when create modal opens
    useEffect(() => {
        if (showCreateModal) {
            fetchDropdownOptions();
        }
    }, [showCreateModal]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams(filters).toString();
            const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/templates/grouped?${query}`);
            const data = await response.json();
            if (response.ok) setTemplates(data.templates || []);
            else setError(data.error || 'Failed to fetch templates');
        } catch (err) { setError('Failed to load templates'); }
        finally { setLoading(false); }
    };

    // helpers for the form
    const addRule = () => setRules([...rules, { system_type: '', category: '', source_ip: '', source_host: '', destination_ip: '', destination_host: '', service: '', description: '', action: 'allow' }]);
    const removeRule = (index) => rules.length > 1 && setRules(rules.filter((_, i) => i !== index));
    const updateRule = (index, field, value) => {
        const newRules = [...rules];
        newRules[index][field] = value;
        setRules(newRules);
    };

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/templates/multi-rule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_name: templateName, rules: rules })
            });
            const data = await response.json();
            if (response.ok) {
                setSuccess(`✅ Template "${data.template_name}" created!`);
                setShowCreateModal(false);
                setTemplateName('');
                setRules([{ system_type: '', category: '', source_ip: '', destination_ip: '', service: '', description: '', action: 'allow' }]);
                fetchTemplates();
                setTimeout(() => setSuccess(''), 3000);
            } else setError(data.error);
        } catch (err) { setError(err.message); }
    };

    const deleteTemplate = async (templateName) => {
        if (!confirm(`Delete template "${templateName}"?`)) return;
        try {
            const t = templates.find(t => t.template_name === templateName);
            if(t) {
                await fetchWithAuth(`${API_BASE_URL}/api/v1/templates/${t.id}/permanent`, { method: 'DELETE' });
                fetchTemplates();
            }
        } catch(e) { setError('Delete failed'); }
    };

    const useTemplate = async (id) => {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/api/v1/templates/${id}/use`, { method: 'POST' });
            if(res.ok) {
                setSuccess("Request created from template!");
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch(e) { setError('Failed to use template'); }
    };

    const renderRuleInput = (idx, rule, field, label, placeholder) => {
        let options = [];
        let isDropdownField = false;

        switch (field) {
            case 'system_type':
                options = dropdownOptions.system_types;
                isDropdownField = true;
                break;
            case 'category':
                options = dropdownOptions.categories;
                isDropdownField = true;
                break;
            case 'service':
                options = dropdownOptions.services;
                isDropdownField = true;
                break;
            case 'source_ip':
                options = dropdownOptions.source_ips.map(ip => ip.display);
                isDropdownField = true;
                break;
            case 'destination_ip':
                options = dropdownOptions.destination_ips.map(ip => ip.display);
                isDropdownField = true;
                break;
        }

        if (isDropdownField && options.length > 0) {
            return (
                <div className="field">
                <label>{label}</label>
                <div className="combo-input">
                <input
                list={`${field}-${idx}`}
                required
                value={rule[field]}
                onChange={e => updateRule(idx, field, e.target.value)}
                placeholder={`Select or type ${placeholder}`}
                />
                <datalist id={`${field}-${idx}`}>
                {options.map((opt, i) => (
                    <option key={i} value={opt} />
                ))}
                </datalist>
                </div>
                <small style={{color: 'var(--text-light)', fontSize: '0.75rem'}}>
                Select from dropdown or type custom value
                </small>
                </div>
            );
        }

        // Fallback to regular input
        return (
            <div className="field">
            <label>{label}</label>
            <input
            required
            value={rule[field]}
            onChange={e => updateRule(idx, field, e.target.value)}
            placeholder={placeholder}
            />
            </div>
        );
    };

    return (
        <div className={`page-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
        {/* Header */}
        <div className="header">
        <div>
        <h1>Template Library</h1>
        <p>Pre-configured firewall rule sets</p>
        </div>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
        <button className="theme-toggle" onClick={toggleTheme}>
        {isDarkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
        {userRole === 'admin' && (
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Template
            </button>
        )}
        </div>
        </div>

        {/* Alerts */}
        {success && <div className="toast success">{success}</div>}
        {error && <div className="toast error">{error}</div>}

        {/* Grid */}
        <div className="grid">
        {loading ? <div className="loading">Loading...</div> : templates.map(t => (
            <div key={t.id} className="card">
            <div className="card-header">
            <h3>{t.template_name}</h3>
            <span className="badge">{t.rule_count || 1} Rules</span>
            </div>
            <div className="card-body">
            {t.rules && t.rules.slice(0,3).map((r, i) => (
                <div key={i} className="rule-row">
                <div className="dot"></div>
                <span>{r.system_type} • {r.service}</span>
                </div>
            ))}
            {t.rules?.length > 3 && <div className="more">+{t.rules.length - 3} more</div>}
            </div>
            <div className="card-footer">
            <span className="author">By {t.created_by}</span>
            <div className="actions">
            <button className="btn-text" onClick={() => {setSelectedTemplate(t); setShowModal(true)}}>View</button>
            <button className="btn-use-small" onClick={() => useTemplate(t.id)}>Use</button>
            {userRole === 'admin' &&
                <button className="btn-text danger" onClick={() => deleteTemplate(t.template_name)}>Delete</button>
            }
            </div>
            </div>
            </div>
        ))}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
            <div className="modal-overlay">
            <div className="modal-large">
            <div className="modal-top">
            <h2>Create Multi-Rule Template</h2>
            <button className="close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateTemplate} className="create-form">
            <div className="form-section">
            <label>Template Name</label>
            <input
            className="main-input"
            required
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="e.g. Windows Web Server Bundle"
            />
            <small style={{color: 'var(--text-light)', marginTop: '0.5rem', display: 'block'}}>
            Give your template a descriptive name
            </small>
            </div>

            {loadingOptions && (
                <div style={{padding: '1rem', textAlign: 'center', color: 'var(--text-light)'}}>
                Loading dropdown options...
                </div>
            )}

            <div className="rules-container">
            {rules.map((rule, idx) => (
                <div key={idx} className="rule-card">
                <div className="rule-header">
                <h4>Rule #{idx + 1}</h4>
                {rules.length > 1 && (
                    <button type="button" className="btn-remove" onClick={() => removeRule(idx)}>
                    Remove
                    </button>
                )}
                </div>
                <div className="rule-grid">
                {renderRuleInput(idx, rule, 'system_type', 'System Type', 'system type')}
                {renderRuleInput(idx, rule, 'category', 'Category', 'category')}
                {renderRuleInput(idx, rule, 'source_ip', 'Source IP', '10.0.0.1')}

                <div className="field">
                <label>Source Host (Optional)</label>
                <input
                value={rule.source_host}
                onChange={e => updateRule(idx, 'source_host', e.target.value)}
                placeholder="e.g. web-server-01"
                />
                </div>

                {renderRuleInput(idx, rule, 'destination_ip', 'Destination IP', '192.168.1.5')}

                <div className="field">
                <label>Destination Host (Optional)</label>
                <input
                value={rule.destination_host}
                onChange={e => updateRule(idx, 'destination_host', e.target.value)}
                placeholder="e.g. db-server-01"
                />
                </div>

                <div className="field full">
                <label>Service / Port</label>
                {renderRuleInput(idx, rule, 'service', 'Service', 'tcp/443, http')}
                </div>

                <div className="field full">
                <label>Description</label>
                <textarea
                value={rule.description}
                onChange={e => updateRule(idx, 'description', e.target.value)}
                placeholder="Describe the purpose of this rule..."
                rows={3}
                style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border)',
                                       borderRadius: '4px',
                                       background: 'var(--input-bg)',
                                       color: 'var(--text-main)',
                                       fontFamily: 'inherit',
                                       resize: 'vertical'
                }}
                />
                </div>

                <div className="field">
                <label>Action</label>
                <select
                value={rule.action}
                onChange={e => updateRule(idx, 'action', e.target.value)}
                style={{
                    padding: '8px',
                    border: '1px solid var(--border)',
                                       borderRadius: '4px',
                                       background: 'var(--input-bg)',
                                       color: 'var(--text-main)'
                }}
                >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
                </select>
                </div>
                </div>
                </div>
            ))}
            <button type="button" className="btn-add" onClick={addRule}>
            + Add Another Rule
            </button>
            </div>

            <div className="modal-actions">
            <button type="button" onClick={() => setShowCreateModal(false)}>
            Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loadingOptions}>
            {loadingOptions ? 'Loading...' : 'Create Template'}
            </button>
            </div>
            </form>
            </div>
            </div>
        )}
        {/* Detail Modal */}
        {showModal && selectedTemplate && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <h3>{selectedTemplate.template_name}</h3>
            <div className="detail-list">
            {selectedTemplate.rules?.map((r, i) => (
                <div key={i} className="detail-item">
                <div className="tag">{r.action}</div>
                <div>
                <strong>{r.system_type}</strong>: {r.source_ip} ➜ {r.destination_ip}
                <br/>
                <small className="mono">{r.service}</small>
                {r.description && <div className="desc">{r.description}</div>}
                </div>
                </div>
            ))}
            </div>
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
                --accent-bg: #f1f5f9;
                --input-bg: #ffffff;
                --badge-bg: #eff6ff;
                --badge-txt: #2563eb;
            }

            .dark-mode {
                --bg-main: #1a1d21;
                --bg-card: #2a2e33;
                --text-main: #e1e1e1;
                --text-light: #a0aab4;
                --border: #40464f;
                --accent-bg: #32383e;
                --input-bg: #1f2328;
                --badge-bg: #1e3a8a;
                --badge-txt: #bfdbfe;
            }

            .combo-input {
                position: relative;
            }

            .combo-input input {
                width: 100%;
                padding: 8px;
                border: 1px solid var(--border);
                border-radius: 4px;
                background: var(--input-bg);
                color: var(--text-main);
            }

            .combo-input input:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
            }

            textarea {
                font-family: inherit;
            }

            small {
                display: block;
                margin-top: 0.25rem;
            }
            .page-container { padding: 2rem; font-family: 'Inter', sans-serif; background: var(--bg-main); min-height: 100vh; color: var(--text-main); }

            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
            h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }

            .btn-primary { background: #007bff; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
            .btn-primary:hover { opacity: 0.9; }

            .theme-toggle { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); padding: 0.6rem 1rem; border-radius: 6px; cursor: pointer; }

            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }

            /* CARD STYLES */
            .card {
                background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem;
                display: flex; flex-direction: column; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); }
            .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
            .card-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main); }
            .badge { background: var(--badge-bg); color: var(--badge-txt); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }

            .card-body { flex: 1; margin-bottom: 1.5rem; }
            .rule-row { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; margin-bottom: 6px; color: var(--text-light); }
            .dot { width: 6px; height: 6px; background: #cbd5e1; border-radius: 50%; }
            .more { font-size: 0.8rem; color: var(--text-light); margin-top: 4px; padding-left: 14px; }

            .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 1rem; }
            .author { font-size: 0.8rem; color: var(--text-light); }
            .actions { display: flex; gap: 8px; }
            .btn-use-small { background: #28a745; color: white; border:none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
            .btn-text { background: none; border: none; cursor: pointer; color: var(--text-light); font-size: 0.85rem; }
            .btn-text:hover { color: #007bff; }
            .btn-text.danger:hover { color: #dc3545; }

            /* MODAL STYLES */
            .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 100; display: flex; justify-content: center; align-items: center; }
            .modal-large { background: var(--bg-card); width: 800px; max-width: 95%; height: 90vh; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid var(--border); }
            .modal-panel { background: var(--bg-card); padding: 2rem; border-radius: 8px; width: 500px; max-width: 90%; color: var(--text-main); border: 1px solid var(--border); }

            .modal-top { padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
            .modal-top h2 { color: var(--text-main); margin: 0; }
            .close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-light); }

            .create-form { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
            .form-section { padding: 1.5rem; background: var(--bg-card); }
            .main-input { width: 100%; padding: 0.8rem; font-size: 1rem; border: 1px solid var(--border); border-radius: 6px; margin-top: 0.5rem; background: var(--input-bg); color: var(--text-main); }

            .rules-container { flex: 1; overflow-y: auto; padding: 1.5rem; background: var(--accent-bg); display: flex; flex-direction: column; gap: 1rem; }
            .rule-card { background: var(--bg-card); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .rule-header { display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; color: var(--text-main); }
            .btn-remove { color: #dc3545; background: none; border: none; cursor: pointer; font-size: 0.85rem; }

            .rule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
            .field { display: flex; flex-direction: column; gap: 4px; }
            .field label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-light); }
            .field input { padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--input-bg); color: var(--text-main); }
            .field.full { grid-column: 1 / -1; }

            .btn-add { background: var(--bg-card); border: 1px dashed var(--text-light); padding: 1rem; border-radius: 8px; color: var(--text-light); cursor: pointer; font-weight: 600; }
            .btn-add:hover { border-color: #007bff; color: #007bff; background: var(--accent-bg); }

            .modal-actions { padding: 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 1rem; background: var(--bg-card); }

            .detail-list { display: flex; flex-direction: column; gap: 1rem; }
            .detail-item { display: flex; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
            .tag { background: var(--badge-bg); color: var(--badge-txt); padding: 4px 8px; border-radius: 4px; height: fit-content; font-size: 0.8rem; font-weight: bold; }
            .mono { font-family: monospace; color: var(--text-light); display: block; margin-top: 4px; }
            .desc { margin-top: 4px; font-size: 0.9rem; color: var(--text-light); font-style: italic; }

            .toast { position: fixed; bottom: 20px; right: 20px; padding: 1rem 1.5rem; border-radius: 6px; color: white; animation: slideIn 0.3s ease; }
            .toast.success { background: #28a745; }
            .toast.error { background: #dc3545; }
            @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
            </div>
    );
};
export default TemplatesPage;
