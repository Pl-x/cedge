import { useState, useEffect } from "react";
import '../App.css';
import '../css/reviewer.css';
import { Link } from "react-router-dom";
import { validateDescription, validateIP, validateService } from "../utils/aclvalidation";
import LogoutButton from '../components/logout';
import { API_BASE_URL } from '../config';

function RequesterPage() {
  const initialRequest = {
    system_type: "",
    category: "",
    sourceIP: "",
    sourceIPId: "",
    sourceHost: "",
    destinationIP: "",
    destinationIPId: "",
    destinationHost: "",
    service: "",
    description: "",
    action: ""
  };

  const [requests, setRequests] = useState([{ ...initialRequest }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [validationErrors, setValidationErrors] = useState([{}]);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [touchedFields, setTouchedFields] = useState([{}]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpContent, setHelpContent] = useState(null);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const [validationProgress, setValidationProgress] = useState('');
  const [showBilling, setShowBilling] = useState(false);
  
  // NEW: Theme State for consistency with ReviewerPage
  const [isDarkMode, setIsDarkMode] = useState(true);
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/grouped`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      setError('error loading templates')
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTemplate = (template) => {
    if (template.rules && template.rules.length > 0) {
      // Replace current requests with template rules
      const newRequests = template.rules.map(rule => ({
        system_type: "Template",
        category: rule.category,
        sourceIP: rule.source_ip,
        sourceHost: rule.source_host,
        destinationIP: rule.destination_ip,
        destinationHost: rule.destination_host,
        service: rule.service,
        description: rule.description,
        action: rule.action,
        _templateName: template.template_name,
        _originalSytemType: rule.system_type
      }));
      setRequests(newRequests);
      setShowTemplates(false);
      setSubmitSuccess(
        `Template "${template.template_name}" loaded!` +
        `SystemType set to "Template"" for tracking`
      );
      setTimeout(() => setSubmitSuccess(''), 3000);
    }
  };

  // Fetch templates when modal opens
  useEffect(() => {
    if (showTemplates) {
      fetchTemplates();
    }
  }, [showTemplates]);

  // Fetch help content when modal opens
  const fetchHelp = async () => {
    setLoadingHelp(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/v1/help`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHelpContent(data);
      }
    } catch (err) {
      setError('Error fetching help');
    } finally {
      setLoadingHelp(false);
    }
  };

  useEffect(() => {
    if (showHelp) {
      fetchHelp();
    }
  }, [showHelp]);

  const handleUpgrade = (planName, amount) => {
    let username = "UnknownUser"
    const userStr = localStorage.getItem("user");
    if (userStr){
      try {
        const userObj = JSON.parse(userStr)
        username = userObj.username || userObj.name || 'Uknown User'
      } catch (error) {
        console.error("AN error occured")
      }
    }
    const ref = `${planName}_UPGRADE_${username}`
    const checkoutUrl = `https://unb.allan7ycrx.org/api/v1/pay?amount=${amount}&phone_number=&ref=${ref}&return_url=${encodeURIComponent(window.location.href)}`

    window.location.href = checkoutUrl
  };

  // Download Excel file
  const handleDownloadExcel = async () => {
    try {
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
        setSubmitSuccess('✅ Excel file downloaded successfully!');
        setTimeout(() => setSubmitSuccess(''), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSubmitError(`Failed to download Excel: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      setSubmitError(`Failed to download Excel: ${err.message}`);
    }
  };

  const handleDownloadSubmissionExcel = async (submittedRequests) => {
    try {
      const token = localStorage.getItem('token');

      // Send the submitted request data to generate Excel
      const response = await fetch(`${API_BASE_URL}/api/v1/generate-xlsx/submission`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: submittedRequests
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Filename will be generated by backend with timestamp
        const contentDisposition = response.headers.get('content-disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] :
          `acl_submission_${submittedRequests.length}requests_${new Date().toISOString().split('T')[0]}.xlsx`;

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        console.log('✅ Submission Excel downloaded successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to download submission Excel: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`Failed to download submission Excel: ${err.message}`);
    }
  };

  const [options, setOptions] = useState({
    system_types: [],
    categories: [],
    source_ips: [],
    destination_ips: [],
    services: []
  });
  const [autoPopulatedFields, setAutoPopulatedFields] = useState(
    requests.map(() => ({
      sourceIP: false,
      sourceHost: false,
      destinationIP: false,
      destinationHost: false,
      service: false,
      description: false
    }))
  );

  // fetch function
  const fetchOptions = async (forceSync = false) => {
    setLoading(true);
    setError("");
    try {
      const url = forceSync
        ? `${API_BASE_URL}/api/mysql-options?sync=true`
        : `${API_BASE_URL}/api/mysql-options`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const systemTypesWithOthers = [...(data.system_types || []), "Others"];

      setOptions({
        system_types: systemTypesWithOthers,
        categories: data.categories || [],
        source_ips: data.source_ips || [],
        destination_ips: data.destination_ips || [],
        services: data.services || []
      });

    } catch (err) {
      setError("❌ Error loading form options");
      setError(`Failed to load form options: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown options from backend
  useEffect(() => {
    fetchOptions();
  }, []);

  // Check if current system_type is "Others"
  const isOthersCategory = (index) => {
    return requests[index].system_type === "Others";
  };
  const isTemplateCategory = (index) => {
    return requests[index].system_type === "Template";
  };

  const autoPopulateFromBackend = async (index, field, value) => {
    const currentRequest = requests[index];
    const system_type = currentRequest.system_type;
    const category = currentRequest.category;

    if (!system_type || !category || system_type === "Others") return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auto-populate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_type: system_type,
          category: category,
          sourceIP: field === 'sourceIP' ? value : "", //currentRequest.sourceIP,
          destinationIP: field === 'destinationIP' ? value : "", //currentRequest.destinationIP,
        }),
      });

      if (!response.ok) return;

      const populatedData = await response.json();
      if (Object.keys(populatedData).length === 0) return;

      const newRequests = [...requests];
      newRequests[index] = {
        ...newRequests[index],
        sourceIP: populatedData.source_ip || newRequests[index].sourceIP,
        sourceHost: populatedData.source_host || newRequests[index].sourceHost,
        destinationIP: populatedData.destination_ip || newRequests[index].destinationIP,
        destinationHost: populatedData.destination_host || newRequests[index].destinationHost,
        service: populatedData.service || newRequests[index].service,
        description: populatedData.description || newRequests[index].description
      };
      setRequests(newRequests);
    } catch (error) {
      console.error("❌ Error in backend autopopulation:", error);
    }
  };
  
  // Get filtered categories for current system_type
  const getFilteredCategories = (index) => {
    const system_type = requests[index].system_type;

    if (!system_type || system_type === "Others") return [];

    // Filter categories that belong to the selected system_type
    const filtered = options.categories.filter(cat =>
      cat.system_type === system_type
    );

    return filtered;
  };

  // Get filtered Source IP options based on system_type and category
  const getFilteredSourceIPs = (index) => {
    const request = requests[index];
    const system_type = request.system_type;
    const category = request.category;

    if (!system_type || !category || system_type === "Others") return [];


    const filteredIPs = options.source_ips.filter(ip =>
      ip.system_type === system_type &&
      ip.category === category
    );


    // Enhance IPs with ALL corresponding data from the same row
    const enhancedIPs = filteredIPs.map(sourceIP => {
      // Find the corresponding destination using the ID
      const correspondingDest = options.destination_ips.find(destIP =>
        destIP.id === sourceIP.id
      );

      return {
        ...sourceIP,
        correspondingDest: correspondingDest?.value || "No matching destination",
        correspondingDestHost: correspondingDest?.host || "",
        hasCorrespondingDest: !!correspondingDest
      };
    });

    return enhancedIPs;
  };

  // Get filtered Destination IP options based on system_type and category 
  const getFilteredDestinationIPs = (index) => {
    const request = requests[index];
    const system_type = request.system_type;
    const category = request.category;

    if (!system_type || !category || system_type === "Others") return [];
    const filteredIPs = options.destination_ips.filter(ip =>
      ip.system_type === system_type &&
      ip.category === category
    );


    // Enhance IPs with ALL corresponding data from the same row
    const enhancedIPs = filteredIPs.map(destinationIP => {
      // Find the corresponding source using the ID
      const correspondingSource = options.source_ips.find(sourceIP =>
        sourceIP.id === destinationIP.id
      );

      return {
        ...destinationIP,
        correspondingSource: correspondingSource?.value || "No matching source",
        correspondingSourceHost: correspondingSource?.host || "",
        hasCorrespondingSource: !!correspondingSource
      };
    });

    return enhancedIPs;
  };

  const getComboboxOptions = (field, index) => {
    if (isOthersCategory(index)) return [];

    switch (field) {
      case 'sourceIP':
        return getFilteredSourceIPs(index).map(ip => ip.value);
      case 'destinationIP':
        return getFilteredDestinationIPs(index).map(ip => ip.value);
      case 'service':
        return options.services || [];
      case 'sourceHost':
        return [...new Set(getFilteredSourceIPs(index).map(ip => ip.host).filter(Boolean))];
      case 'destinationHost':
        return [...new Set(getFilteredDestinationIPs(index).map(ip => ip.host).filter(Boolean))];
      default:
        return [];
    }
  };

  const handleFieldBlur = (index, field) => {
    // Skip validation for "Others" category on certain fields
    if (isOthersCategory(index)) {
      // Mark as touched
      const newTouched = [...touchedFields];
      newTouched[index] = { ...newTouched[index], [field]: true };
      setTouchedFields(newTouched);
      return;
    }

    // Mark field as touched
    const newTouched = [...touchedFields];
    newTouched[index] = { ...newTouched[index], [field]: true };
    setTouchedFields(newTouched);
  };

  const updateRequest = (index, field, value) => {
    const newRequests = [...requests];
    const newAutoPopulatedFields = [...autoPopulatedFields];
    const oldValue = newRequests[index][field]

    newRequests[index][field] = value;

    if (validationErrors[index]?.[field]) {
      const newErrors = [...validationErrors];
      delete newErrors[index][field];
      setValidationErrors(newErrors);
    }

    if (field === 'system_type' && oldValue !== value) {
      const newErrors = [...validationErrors];
      newErrors[index] = {};
      setValidationErrors(newErrors);
    }

    if (field === 'category' && !isOthersCategory(index) && oldValue !== value) {
      const newErrors = [...validationErrors];
      newErrors[index] = {};
      setValidationErrors(newErrors);
    }

    if ((field === 'sourceIP' || field === 'destinationIP') && !isOthersCategory(index)) {
      const ipType = field === 'sourceIP' ? 'source' : 'destination';
      const ipArray = ipType === 'source' ? getFilteredSourceIPs(index) : getFilteredDestinationIPs(index);

      const matchedOption = ipArray.find(ip => ip.value === value);

      if (matchedOption) {
        if (ipType === 'source') {
          newRequests[index].sourceIP = matchedOption.value || "";
          newRequests[index].sourceIPId = matchedOption.id || "";
          newRequests[index].sourceHost = matchedOption.host || "";
          newRequests[index].destinationIP = matchedOption.correspondingDest || "";
          newRequests[index].destinationHost = matchedOption.correspondingDestHost || "";
          newRequests[index].service = matchedOption.service || "";
          newRequests[index].description = matchedOption.description || "";
        } else {
          newRequests[index].destinationIP = matchedOption.value || "";
          newRequests[index].destinationIPId = matchedOption.id || "";
          newRequests[index].destinationHost = matchedOption.host || "";
          newRequests[index].sourceIP = matchedOption.correspondingSource || "";
          newRequests[index].sourceHost = matchedOption.correspondingSourceHost || "";
          newRequests[index].service = matchedOption.service || "";
          newRequests[index].description = matchedOption.description || "";
        }

        newAutoPopulatedFields[index] = {
          sourceIP: ipType === 'destination',
          sourceHost: true,
          destinationIP: ipType === 'source',
          destinationHost: true,
          service: true,
          description: true
        };

        const newErrors = [...validationErrors];
        newErrors[index] = {};
        setValidationErrors(newErrors);
      } else {
        if (ipType === 'source') {
          newRequests[index].sourceIPId = "";
          newRequests[index].sourceHost = "";
        } else {
          newRequests[index].destinationIPId = "";
          newRequests[index].destinationHost = "";
        }

        newAutoPopulatedFields[index] = {
          ...newAutoPopulatedFields[index],
          sourceHost: false,
          destinationHost: false,
          service: false,
          description: false
        };

        if (value && value.trim()) {
          autoPopulateFromBackend(index, field, value);
        }
      }
    }

    if ((field === 'sourceIPId' || field === 'destinationIPId') && value && !isOthersCategory(index)) {
      const ipType = field === 'sourceIPId' ? 'source' : 'destination';

      const sourceArray = ipType === 'source' ? options.source_ips : options.destination_ips;
      const selectedData = sourceArray.find(ip => ip.id == value);

      if (selectedData) {
        const targetArray = ipType === 'source' ? options.destination_ips : options.source_ips;
        const correspondingData = targetArray.find(ip => ip.id == value);

        if (ipType === 'source') {
          newRequests[index].sourceIP = selectedData.value || "";
          newRequests[index].sourceIPId = selectedData.id || "";
          newRequests[index].sourceHost = selectedData.host || "";

          if (correspondingData) {
            newRequests[index].destinationIP = correspondingData.value || "";
            newRequests[index].destinationIPId = correspondingData.id || "";
            newRequests[index].destinationHost = correspondingData.host || "";
          }
        } else {
          newRequests[index].destinationIP = selectedData.value || "";
          newRequests[index].destinationIPId = selectedData.id || "";
          newRequests[index].destinationHost = selectedData.host || "";

          if (correspondingData) {
            newRequests[index].sourceIP = correspondingData.value || "";
            newRequests[index].sourceIPId = correspondingData.id || "";
            newRequests[index].sourceHost = correspondingData.host || "";
          }
        }

        newRequests[index].service = selectedData.service || "";
        newRequests[index].description = selectedData.description || "";

        newAutoPopulatedFields[index] = {
          sourceIP: ipType === 'destination' && !!correspondingData,
          sourceHost: true,
          destinationIP: ipType === 'source' && !!correspondingData,
          destinationHost: true,
          service: true,
          description: true
        };

        const newErrors = [...validationErrors];
        newErrors[index] = {};
        setValidationErrors(newErrors);
      }
    }

    if (['sourceIP', 'sourceHost', 'destinationIP', 'destinationHost', 'service', 'description'].includes(field)) {
      newAutoPopulatedFields[index] = {
        ...newAutoPopulatedFields[index],
        [field]: false
      };
    }

    setRequests(newRequests);
    setAutoPopulatedFields(newAutoPopulatedFields);
  };

  const addRequest = () => {
    setRequests([...requests, { ...initialRequest }]);
    setAutoPopulatedFields([...autoPopulatedFields, {
      sourceIP: false,
      sourceHost: false,
      destinationIP: false,
      destinationHost: false,
      service: false,
      description: false
    }]);
    setValidationErrors([...validationErrors, {}]);
    setTouchedFields([...touchedFields, {}]);
  };

  const removeRequest = (index) => {
    if (requests.length > 1) {
      const newRequests = requests.filter((_, i) => i !== index);
      const newAutoPopulatedFields = autoPopulatedFields.filter((_, i) => i !== index);
      const newValidationErrors = validationErrors.filter((_, i) => i !== index);
      const newTouchedFields = touchedFields.filter((_, i) => i !== index);

      setRequests(newRequests);
      setAutoPopulatedFields(newAutoPopulatedFields);
      setValidationErrors(newValidationErrors);
      setTouchedFields(newTouchedFields);
    }
  };

  const validateRequestsBackend = async () => {
    setIsValidating(true);
    setValidationProgress('Checking request data...');
    setValidationErrors([]); 

    try {
      const token = localStorage.getItem('token');
      setTimeout(() => setValidationProgress('Validating IP addresses...'), 300);
      setTimeout(() => setValidationProgress('Validating services...'), 600);
      setTimeout(() => setValidationProgress('Validating descriptions...'), 900);

      const response = await fetch(`${API_BASE_URL}/api/v1/validate-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requests })
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setValidationProgress('❌ Validation failed - errors found');
        const errorsByIndex = {};
        if (data.validation_results && Array.isArray(data.validation_results)) {
          data.validation_results.forEach(result => {
            if (!result.valid && result.errors) {
              errorsByIndex[result.row_index] = result.errors;
            }
          });
        }

        const errorsArray = requests.map((_, idx) => errorsByIndex[idx] || {});
        setValidationErrors(errorsArray);
        setShowValidationModal(true);
        setTimeout(() => setValidationProgress(''), 2000);
        return false;
      }

      setValidationProgress('✅ All validations passed!');
      setTimeout(() => setValidationProgress(''), 1500);
      return true;

    } catch (err) {
      setValidationProgress('');
      setSubmitError(`Validation failed: ${err.message}`);
      return false;
    } finally {
      setTimeout(() => setIsValidating(false), 1500);
    }
  };


const handleBulkSubmit = async (e) => {
  e.preventDefault();
  setSubmitError("");
  setSubmitSuccess("");
  setValidationProgress('Starting validation...');

  try {
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];

      if (!req.system_type) {
        throw new Error(`Please select System Type in Request #${i + 1}`);
      }

      if (req.system_type === "Others") {
        if (!req.sourceIP || !req.destinationIP || !req.service) {
          throw new Error(`Please fill Source IP, Destination IP, and Service for "Others" system type in Request #${i + 1}`);
        }
      } else {
        if (!req.category || !req.sourceIP || !req.destinationIP || !req.service) {
          throw new Error(`Please fill all required fields in Request #${i + 1}`);
        }
      }

      if (!req.action) {
        throw new Error(`Please select Action in Request #${i + 1}`);
      }
    }

    const isValid = await validateRequestsBackend();

    if (!isValid) {
      setSubmitError('❌ Validation failed. Please fix the errors highlighted below');
      return;
    }

    setLoading(true);
    setValidationProgress('Submitting requests...');

    const token = localStorage.getItem('token');
    const submittedRequests = [];

    const submissionPromises = requests.map((request) =>
      fetch(`${API_BASE_URL}/create_acl_request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          system_type: request.system_type,
          category: request.category,
          sourceIP: request.sourceIP,
          sourceHost: request.sourceHost,
          destinationIP: request.destinationIP,
          destinationHost: request.destinationHost,
          service: request.service,
          description: request.description || "ACL Request",
          action: request.action,
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Unknown error from server');
        }
        return data;
      })
    );

    const results = await Promise.all(submissionPromises);

    results.forEach((responseData, i) => {
      submittedRequests.push({
        id: responseData.request_id || 'N/A',
        requester: localStorage.getItem('username') || 'User',
        system_type: requests[i].system_type,
        category: requests[i].category,
        sourceIP: requests[i].sourceIP,
        sourceHost: requests[i].sourceHost,
        destinationIP: requests[i].destinationIP,
        destinationHost: requests[i].destinationHost,
        service: requests[i].service,
        description: requests[i].description,
        action: requests[i].action,
        status: 'Pending'
      });
    });

    setRequests([{ ...initialRequest }]);
    setAutoPopulatedFields([{
      sourceIP: false,
      sourceHost: false,
      destinationIP: false,
      destinationHost: false,
      service: false,
      description: false
    }]);
    setValidationErrors([{}]);
    setTouchedFields([{}]);
    setValidationProgress('');

    setSubmitSuccess(`✅ Successfully submitted ${requests.length} ACL request(s)! Validation complete. You can download an Excel report below.`);

    await handleDownloadSubmissionExcel(submittedRequests);

    setTimeout(() => setSubmitSuccess(""), 8000);

  } catch (err) {
    setValidationProgress('');
    setSubmitError(`Failed to submit requests: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

if (loading && requests.length === 1 && !requests[0].system_type) {
  return (
    <div className={`loading-screen ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <div className="spinner"></div>Loading options...
    </div>
  );
}

return (
  <div className={`requester-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
    
    {/* PREMIUM TOP BAR */}
    <div className="top-bar">
        <div>
          <h1>📋 ACL Request Automation</h1>
          <p className="subtitle">Create and manage bulk network access rules</p>
        </div>
        <div className="actions">
          {/* THEME TOGGLE */}
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          {/* UPGRADE BUTTON */}
          <button
            type="button"
            onClick={() => setShowBilling(true)}
            className="btn-upgrade"
          >
            <span className="lightning">⚡</span> Upgrade Plan
          </button>

          {/* HELP BUTTON */}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="btn-secondary"
            title="Help & Instructions"
          >
            ❓ Help
          </button>
          
          <LogoutButton />
        </div>
    </div>

    {/* ALERTS */}
    {submitSuccess && <div className="alert success">{submitSuccess} <button onClick={() => setSubmitSuccess("")}>×</button></div>}
    {submitError && <div className="alert error">{submitError} <button onClick={() => setSubmitError("")}>×</button></div>}
    {error && <div className={`alert ${error.includes('✅') ? 'success' : 'error'}`}>{error} <button onClick={() => setError("")}>×</button></div>}

    {validationProgress && (
      <div className="validation-progress-container">
        <div className="validation-progress">
          <div className="spinner-small"></div>
          <span>{validationProgress}</span>
        </div>
      </div>
    )}

    {/* DATA TABLE FORM */}
    <form onSubmit={handleBulkSubmit}>
      <div className="table-wrapper">
        <table className="modern-table">
          <thead>
            <tr>
              <th className="required-field">System Type</th>
              <th className="required-field">Category</th>
              <th className="required-field">Source IP</th>
              <th>Source Host</th>
              <th className="required-field">Destination IP</th>
              <th>Destination Host</th>
              <th className="required-field">Service</th>
              <th style={{ minWidth: '200px' }}>Description</th>
              <th className="required-field" style={{ minWidth: '120px' }}>Action</th>
              <th className="text-right">Remove</th>
            </tr>
          </thead>
          <tbody>
          {requests.map((request, index) => {
            const rowErrors = validationErrors[index] || {};
            const hasErrors = Object.keys(rowErrors).length > 0;

            return (
              <tr key={index} className={hasErrors ? 'error-row' : ''}>

              {/* COLUMN 1: System Type */}
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <select
                    className={`modern-select ${rowErrors.system_type ? 'input-error' : ''}`}
                    value={request.system_type}
                    onChange={(e) => updateRequest(index, 'system_type', e.target.value)}
                    required
                  >
                    <option value="">Select System Type</option>
                    {options.system_types.map((st, idx) => (
                      <option key={idx} value={st}>{st}</option>
                    ))}
                  </select>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    {isTemplateCategory(index) && (
                      <span className="status-pill approved">📋 Template</span>
                    )}
                    {isOthersCategory(index) && (
                      <span className="status-pill pending">✏️ Manual</span>
                    )}
                  </div>
                </div>
                {rowErrors.system_type && <div className="field-error">{rowErrors.system_type}</div>}
              </td>

              {/* COLUMN 2: Category */}
              <td>
              {isOthersCategory(index) || isTemplateCategory(index) ? (
                <input
                  type="text"
                  className="modern-input"
                  value={request.category}
                  onChange={(e) => updateRequest(index, 'category', e.target.value)}
                  placeholder={isTemplateCategory(index) ? "From template" : "Enter category"}
                  disabled={isTemplateCategory(index)}
                  style={{ opacity: isTemplateCategory(index) ? 0.7 : 1 }}
                />
              ) : (
                <select
                  className={`modern-select ${rowErrors.category ? 'input-error' : ''}`}
                  value={request.category}
                  onChange={(e) => updateRequest(index, 'category', e.target.value)}
                  disabled={!request.system_type}
                  required
                >
                  <option value="">Select Category</option>
                  {getFilteredCategories(index).map((cat, idx) => (
                    <option key={idx} value={cat.value}>{cat.display}</option>
                  ))}
                </select>
              )}
              {rowErrors.category && <div className="field-error">{rowErrors.category}</div>}
              </td>

              {/* COLUMN 3: Source IP */}
              <td>
                <input
                  className={`modern-input ${rowErrors.sourceIP ? 'input-error' : ''}`}
                  list={`sourceIP-options-${index}`}
                  value={request.sourceIP}
                  onChange={(e) => updateRequest(index, 'sourceIP', e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  required
                />
                <datalist id={`sourceIP-options-${index}`}>
                  {getFilteredSourceIPs(index).map((ip, idx) => <option key={idx} value={ip.value} />)}
                </datalist>
                {rowErrors.sourceIP && <div className="field-error">{rowErrors.sourceIP}</div>}
              </td>

              {/* COLUMN 4: Source Host */}
              <td>
                <input
                  type="text"
                  className="modern-input"
                  value={request.sourceHost}
                  onChange={(e) => updateRequest(index, 'sourceHost', e.target.value)}
                  placeholder="Optional"
                />
              </td>

              {/* COLUMN 5: Destination IP */}
              <td>
                <input
                  className={`modern-input ${rowErrors.destinationIP ? 'input-error' : ''}`}
                  list={`destinationIP-options-${index}`}
                  value={request.destinationIP}
                  onChange={(e) => updateRequest(index, 'destinationIP', e.target.value)}
                  placeholder="e.g. 10.0.0.5"
                  required
                />
                <datalist id={`destinationIP-options-${index}`}>
                  {getFilteredDestinationIPs(index).map((ip, idx) => <option key={idx} value={ip.value} />)}
                </datalist>
                {rowErrors.destinationIP && <div className="field-error">{rowErrors.destinationIP}</div>}
              </td>

              {/* COLUMN 6: Destination Host */}
              <td>
                <input
                  type="text"
                  className="modern-input"
                  value={request.destinationHost}
                  onChange={(e) => updateRequest(index, 'destinationHost', e.target.value)}
                  placeholder="Optional"
                />
              </td>

              {/* COLUMN 7: Service */}
              <td>
                <input
                  type="text"
                  className={`modern-input ${rowErrors.service ? 'input-error' : ''}`}
                  value={request.service}
                  onChange={(e) => updateRequest(index, 'service', e.target.value)}
                  placeholder="e.g. tcp/443"
                  required
                />
                {rowErrors.service && <div className="field-error">{rowErrors.service}</div>}
              </td>

              {/* COLUMN 8: Description */}
              <td>
                <textarea
                  className={`modern-input ${rowErrors.description ? 'input-error' : ''}`}
                  value={request.description}
                  onChange={(e) => updateRequest(index, 'description', e.target.value)}
                  placeholder="Business justification..."
                  style={{ minWidth: '180px', minHeight: '40px', resize: 'vertical' }}
                />
                {rowErrors.description && <div className="field-error">{rowErrors.description}</div>}
              </td>

              {/* COLUMN 9: Action */}
              <td>
                <select
                  className={`modern-select ${rowErrors.action ? 'input-error' : ''}`}
                  value={request.action}
                  onChange={(e) => updateRequest(index, 'action', e.target.value)}
                  required
                >
                  <option value="">Select</option>
                  <option value="allow">Allow</option>
                  <option value="deny">Deny</option>
                </select>
                {rowErrors.action && <div className="field-error">{rowErrors.action}</div>}
              </td>

              {/* COLUMN 10: Remove Button */}
              <td className="text-right">
                {requests.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRequest(index)}
                    className="btn-icon danger"
                    title="Remove row"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                  </button>
                )}
              </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      {/* FORM ACTIONS FOOTER */}
      <div className="form-footer-actions">
        <div className="left-actions">
          <button type="button" onClick={addRequest} className="btn-secondary">
            + Add Another Request
          </button>
          <button type="button" onClick={() => setShowTemplates(true)} className="btn-secondary">
            📋 Use Template
          </button>
        </div>

        <div className="right-actions">
          <span className="count-badge">Total Requests: {requests.length}</span>
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="btn-secondary outline"
            title="Download Excel report"
          >
            📥 Export CSV
          </button>
          <button
            type="submit"
            disabled={loading || isValidating}
            className="btn-success lg"
          >
            {loading ? "Submitting..." : `Submit ${requests.length} Request(s)`}
          </button>
        </div>
      </div>
    </form>

    {/* MODALS */}

    {/* 1. Template Selection Modal */}
    {showTemplates && (
      <div className="modal-backdrop" onClick={() => setShowTemplates(false)}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
          <div className="modal-header">
            <h2>📋 Select Template</h2>
            <button className="close-btn" onClick={() => setShowTemplates(false)}>×</button>
          </div>
          <div className="modal-body">
            {loadingTemplates ? (
              <div className="loading-state"><div className="spinner-small"></div> Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="empty-state">No templates available. Admins can create them in the Template Library.</div>
            ) : (
              <div className="templates-list">
                {templates.map(template => (
                  <div key={template.template_name} className="template-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 className="template-title">{template.template_name}</h4>
                        <span className="status-pill pending">{template.rule_count} rules</span>
                      </div>
                      <button onClick={() => loadTemplate(template)} className="btn-success sm">
                        Use Template
                      </button>
                    </div>
                    <div className="template-rules-preview">
                      {template.rules.map((rule, idx) => (
                        <div key={idx} className="rule-preview-item">
                          <span className="dot"></span>
                          {rule.system_type} - {rule.category} <span className="code-pill">{rule.service}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* 2. Validation Errors Modal */}
    {showValidationModal && validationErrors.some(e => Object.keys(e).length > 0) && (
      <div className="modal-backdrop" onClick={() => setShowValidationModal(false)}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>⚠️ Validation Errors</h2>
            <button className="close-btn" onClick={() => setShowValidationModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <p style={{ marginBottom: '1.5rem' }}>Please fix the following errors before submitting:</p>
            <div className="error-list-container">
              {validationErrors.map((errors, idx) => {
                if (Object.keys(errors).length === 0) return null;
                return (
                  <div key={idx} className="validation-error-item">
                    <h4>Request #{idx + 1}:</h4>
                    <ul>
                      {Object.entries(errors).map(([field, error]) => (
                        <li key={field}><strong>{field.toUpperCase()}:</strong> {error}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-footer">
            <button onClick={() => setShowValidationModal(false)} className="btn-secondary">
              Close & Fix Errors
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 3. Billing & Upgrade Modal */}
    {showBilling && (
      <div className="modal-backdrop" onClick={() => setShowBilling(false)}>
        <div className="modal-panel billing-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
          <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
            <div style={{ textAlign: 'center', width: '100%', marginTop: '1rem' }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚀 Upgrade Your Workspace</h2>
              <p className="modal-subtitle">You are currently on the <strong>Free Plan</strong> (50 requests/month).</p>
            </div>
            <button className="close-btn absolute-right" onClick={() => setShowBilling(false)}>×</button>
          </div>
          <div className="modal-body" style={{ padding: '2rem 3rem 3rem' }}>
            <div className="pricing-grid">
              
              {/* PRO PLAN CARD */}
              <div className="pricing-card pro">
                <h3 className="plan-name">Pro Plan</h3>
                <div className="plan-price">Ksh 1,500<span className="period">/mo</span></div>
                <ul className="plan-features">
                  <li><span className="check">✅</span> 200 ACL Requests / month</li>
                  <li><span className="check">✅</span> Read-only Admin Privileges</li>
                  <li><span className="check">✅</span> Priority Email Support</li>
                </ul>
                <button onClick={() => handleUpgrade('PRO', 1500)} className="btn-plan-action">
                  Upgrade to Pro
                </button>
              </div>

              {/* VIP PLAN CARD */}
              <div className="pricing-card vip">
                <div className="popular-badge">MOST POPULAR</div>
                <h3 className="plan-name">VIP Plan</h3>
                <div className="plan-price">Ksh 5,000<span className="period">/mo</span></div>
                <ul className="plan-features">
                  <li><span className="check">🔥</span> 1000 ACL Requests / month</li>
                  <li><span className="check">🔥</span> Read/Write Admin Privileges</li>
                  <li><span className="check">🔥</span> 24/7 Phone Support</li>
                </ul>
                <button onClick={() => handleUpgrade('VIP', 5000)} className="btn-plan-action primary">
                  Upgrade to VIP
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    )}

    {/* 4. Help Modal */}
    {showHelp && (
      <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
        <div className="modal-panel help-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', height: '85vh' }}>
          <div className="modal-header">
            <h2>❓ Documentation & Help</h2>
            <button className="close-btn" onClick={() => setShowHelp(false)}>×</button>
          </div>
          <div className="modal-body">
            {loadingHelp ? (
              <div className="loading-state"><div className="spinner-small"></div> Loading documentation...</div>
            ) : helpContent ? (
              <div className="doc-content">
                <section>
                  <h3>📖 Overview</h3>
                  <p>{helpContent.overview}</p>
                </section>

                <section>
                  <h3>📝 How to Create a Request</h3>
                  <ol>
                    {helpContent.how_to_create_request?.steps?.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                  <div className="info-box tip">
                    <strong>💡 Tips:</strong>
                    <ul>
                      {helpContent.how_to_create_request?.tips?.map((tip, idx) => <li key={idx}>{tip}</li>)}
                    </ul>
                  </div>
                </section>

                <section>
                  <h3>✅ Validation Rules</h3>
                  <div className="info-box warning">
                    <p><strong>IP Addresses:</strong> {helpContent.validation_rules?.ip_addresses}</p>
                    <p><strong>Services:</strong> {helpContent.validation_rules?.services}</p>
                    <p><strong>Description:</strong> {helpContent.validation_rules?.description}</p>
                  </div>
                </section>

                <section>
                  <h3>📋 Templates</h3>
                  <p><strong>Info:</strong> {helpContent.templates?.info}</p>
                  <p><strong>Usage:</strong> {helpContent.templates?.usage}</p>
                </section>
              </div>
            ) : (
              <div className="empty-state">Failed to load help information</div>
            )}
          </div>
          <div className="modal-footer">
            <button onClick={() => setShowHelp(false)} className="btn-secondary">Close Documentation</button>
          </div>
        </div>
      </div>
    )}

    {/* SAAS PREMIUM CSS INJECTIONS */}
    <style jsx="true">{`
      /* THEME VARIABLES (Matching ReviewerPage exactly) */
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
        --error-bg: #fef2f2;
        --error-border: #fca5a5;
        --error-text: #ef4444;
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
        --error-bg: rgba(239, 68, 68, 0.1);
        --error-border: rgba(239, 68, 68, 0.3);
        --error-text: #f87171;
      }

      /* GLOBAL */
      .requester-container {
        padding: 2.5rem;
        background-color: var(--bg-main);
        min-height: 100vh;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: var(--text-main);
        transition: all 0.3s ease;
      }

      /* TOP BAR */
      .top-bar {
        display: flex; justify-content: space-between; align-items: flex-end;
        margin-bottom: 2.5rem;
      }
      h1 { font-size: 2rem; font-weight: 800; margin: 0 0 0.25rem 0; letter-spacing: -0.02em; }
      .subtitle { color: var(--text-light); margin: 0; font-size: 1rem; }
      .actions { display: flex; gap: 1rem; align-items: center; }

      /* BUTTONS */
      .theme-toggle {
        background: transparent; color: var(--text-light);
        border: 1px solid var(--border);
        padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer;
        font-weight: 600; transition: all 0.2s;
      }
      .theme-toggle:hover { background: var(--accent-bg); color: var(--text-main); }

      .btn-upgrade {
        background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px;
        cursor: pointer; font-weight: 700; display: flex; align-items: center; gap: 6px;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); transition: transform 0.2s;
      }
      .btn-upgrade:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }

      .btn-secondary {
        padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer;
        background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); 
        box-shadow: var(--shadow); transition: all 0.2s; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px;
      }
      .btn-secondary:hover { border-color: var(--text-light); background: var(--accent-bg); }
      .btn-secondary.outline { background: transparent; box-shadow: none; }

      .btn-success {
        padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; 
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); transition: all 0.2s; font-size: 0.9rem;
      }
      .btn-success:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3); }
      .btn-success.lg { padding: 0.8rem 1.5rem; font-size: 1rem; }
      .btn-success.sm { padding: 0.4rem 0.8rem; font-size: 0.8rem; }

      .btn-icon {
        background: transparent; border: 1px solid var(--border); padding: 8px; border-radius: 6px;
        color: var(--text-light); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
      }
      .btn-icon:hover { background: var(--accent-bg); color: var(--text-main); }
      .btn-icon.danger:hover { background: var(--error-bg); color: var(--error-text); border-color: var(--error-border); }

      /* ALERTS & PROGRESS */
      .alert {
        padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;
        font-weight: 500; animation: slideIn 0.3s ease;
      }
      .alert button { background: none; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.5; color: inherit; }
      .alert button:hover { opacity: 1; }
      .alert.error { background: var(--error-bg); color: var(--error-text); border: 1px solid var(--error-border); }
      .alert.success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }

      .validation-progress-container {
        background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 8px; padding: 1rem 1.5rem; margin-bottom: 1.5rem; animation: slideIn 0.3s ease;
      }
      .validation-progress { display: flex; align-items: center; gap: 12px; color: #3b82f6; font-weight: 600; }
      .spinner-small { width: 18px; height: 18px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite; }

      /* TABLE WRAPPER */
      .table-wrapper {
        background: var(--bg-card); border-radius: 12px; box-shadow: var(--shadow);
        overflow-x: auto; border: 1px solid var(--border); margin-bottom: 1.5rem;
      }
      .modern-table { width: 100%; border-collapse: collapse; min-width: 1200px; }
      .modern-table th {
        background: var(--bg-main); padding: 1rem; text-align: left; font-size: 0.75rem; 
        text-transform: uppercase; color: var(--text-light); font-weight: 700; letter-spacing: 0.05em;
        border-bottom: 1px solid var(--border); white-space: nowrap;
      }
      .required-field::after { content: '*'; color: var(--error-text); margin-left: 4px; }
      
      .modern-table td { padding: 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
      .modern-table tr:last-child td { border-bottom: none; }
      
      .error-row td { background-color: rgba(239, 68, 68, 0.02); }

      /* INPUTS & SELECTS */
      .modern-input, .modern-select {
        width: 100%; padding: 0.6rem 0.8rem; border: 1px solid var(--border); border-radius: 6px;
        background: var(--input-bg); color: var(--text-main); font-size: 0.85rem; font-family: inherit;
        transition: all 0.2s;
      }
      .modern-input:focus, .modern-select:focus {
        outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px var(--focus-ring);
      }
      .modern-input:disabled, .modern-select:disabled { opacity: 0.6; cursor: not-allowed; }
      
      .input-error { border-color: var(--error-text) !important; background-color: var(--error-bg) !important; }
      .field-error { color: var(--error-text); font-size: 0.75rem; margin-top: 6px; font-weight: 600; }

      /* PILLS */
      .status-pill { padding: 4px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; display: inline-flex; align-items: center; border: 1px solid transparent; }
      .status-pill.pending { background: rgba(245, 158, 11, 0.1); color: #d97706; border-color: rgba(245, 158, 11, 0.2); }
      .status-pill.approved { background: rgba(16, 185, 129, 0.1); color: #059669; border-color: rgba(16, 185, 129, 0.2); }
      .code-pill { background: var(--bg-main); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; border: 1px solid var(--border); color: var(--text-light); }

      /* FOOTER ACTIONS */
      .form-footer-actions {
        display: flex; justify-content: space-between; align-items: center;
        background: var(--bg-card); padding: 1.5rem; border-radius: 12px;
        box-shadow: var(--shadow); border: 1px solid var(--border);
      }
      .left-actions, .right-actions { display: flex; gap: 1rem; align-items: center; }
      .count-badge { background: var(--accent-bg); padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; border: 1px solid var(--border); }

      /* MODALS */
      .modal-backdrop {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4); backdrop-filter: blur(8px);
        z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 1rem;
      }
      .modal-panel {
        background: var(--bg-card); width: 100%; max-height: 90vh;
        border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex; flex-direction: column; animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        color: var(--text-main); border: 1px solid var(--border); position: relative;
      }
      @keyframes modalPop { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

      .modal-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
      .modal-header h2 { margin: 0; font-size: 1.25rem; }
      .close-btn { background: var(--accent-bg); border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; color: var(--text-light); transition: all 0.2s; }
      .close-btn:hover { background: var(--error-text); color: white; }
      .absolute-right { position: absolute; top: 1.5rem; right: 1.5rem; }

      .modal-body { padding: 2rem; overflow-y: auto; flex: 1; }
      .modal-footer { padding: 1.5rem 2rem; border-top: 1px solid var(--border); background: var(--bg-main); border-radius: 0 0 16px 16px; display: flex; justify-content: flex-end; }

      /* TEMPLATES MODAL SPECIFICS */
      .templates-list { display: flex; flex-direction: column; gap: 1rem; }
      .template-card { background: var(--bg-main); border: 1px solid var(--border); padding: 1.25rem; border-radius: 12px; transition: transform 0.2s; }
      .template-card:hover { transform: translateY(-2px); border-color: var(--brand); }
      .template-title { margin: 0 0 0.5rem 0; font-size: 1.1rem; }
      .template-rules-preview { margin-top: 1rem; font-size: 0.85rem; color: var(--text-light); background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--border); }
      .rule-preview-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .rule-preview-item .dot { width: 6px; height: 6px; background: var(--brand); border-radius: 50%; }
      .rule-preview-item:last-child { margin-bottom: 0; }

      /* VALIDATION MODAL SPECIFICS */
      .error-list-container { display: flex; flex-direction: column; gap: 1rem; }
      .validation-error-item { background: var(--error-bg); border: 1px solid var(--error-border); border-radius: 8px; padding: 1.25rem; }
      .validation-error-item h4 { color: var(--error-text); margin: 0 0 0.75rem 0; }
      .validation-error-item ul { margin: 0; padding-left: 1.5rem; color: var(--text-main); font-size: 0.9rem; }
      .validation-error-item li { margin-bottom: 4px; }

      /* BILLING MODAL SPECIFICS */
      .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
      .pricing-card { background: var(--bg-card); border: 2px solid var(--border); border-radius: 16px; padding: 2.5rem 2rem; text-align: center; position: relative; transition: all 0.2s; }
      .pricing-card.pro:hover { border-color: var(--text-light); }
      .pricing-card.vip { border-color: var(--brand); box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.1); }
      .popular-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--brand); color: white; padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; }
      .plan-name { font-size: 1.5rem; margin: 0 0 1rem 0; color: var(--text-main); }
      .plan-price { font-size: 3rem; font-weight: 900; color: var(--text-main); margin-bottom: 2rem; }
      .plan-price .period { font-size: 1rem; color: var(--text-light); font-weight: 500; }
      .pricing-card.vip .plan-price { color: var(--brand); }
      .plan-features { list-style: none; padding: 0; margin: 0 0 2.5rem 0; text-align: left; color: var(--text-main); font-size: 0.95rem; line-height: 2.5; }
      .check { margin-right: 12px; }
      .btn-plan-action { width: 100%; padding: 1rem; background: var(--accent-bg); color: var(--text-main); border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 1rem; transition: background 0.2s; }
      .btn-plan-action:hover { background: var(--border); }
      .btn-plan-action.primary { background: var(--brand); color: white; }
      .btn-plan-action.primary:hover { filter: brightness(1.1); }

      /* HELP MODAL SPECIFICS */
      .doc-content section { margin-bottom: 2.5rem; line-height: 1.6; }
      .doc-content h3 { font-size: 1.25rem; margin: 0 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
      .doc-content ol, .doc-content ul { padding-left: 1.5rem; margin: 0; }
      .doc-content li { margin-bottom: 0.5rem; }
      .info-box { padding: 1rem; border-radius: 8px; margin-top: 1rem; font-size: 0.9rem; }
      .info-box.tip { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); }
      .info-box.warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); }

      .loading-state, .empty-state { text-align: center; padding: 3rem; color: var(--text-light); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
      .loading-screen { display: flex; flex-direction: column; gap: 1rem; height: 100vh; justify-content: center; align-items: center; background: var(--bg-main); color: var(--text-main); font-weight: 600; }
      .spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--brand); border-radius: 50%; animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `}</style>
  </div>
);
}
export default RequesterPage;