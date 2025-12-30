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
        system_type: rule.system_type,
        category: rule.category,
        sourceIP: rule.source_ip,
        sourceHost: rule.source_host,
        destinationIP: rule.destination_ip,
        destinationHost: rule.destination_host,
        service: rule.service,
        description: rule.description,
        action: rule.action
    }));
    setRequests(newRequests);
    // setAutoPopulatedFields(newAutoPopulatedFields)
    setShowTemplates(false);
    setSubmitSuccess(`Template "${template.template_name}" loaded!`);
    setTimeout(() => setSubmitSuccess(''), 3000);
  };
}

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
      // const newAutoPopulatedFields = [...autoPopulatedFields];

      // // Only update fields that are empty or were auto-populated
      // if (populatedData.source_ip && (!newRequests[index].sourceIP || autoPopulatedFields[index].sourceIP)) {
      //   newRequests[index].sourceIP = populatedData.source_ip;
      //   newAutoPopulatedFields[index].sourceIP = true;
      // }

      // if (populatedData.source_host && (!newRequests[index].sourceHost || autoPopulatedFields[index].sourceHost)) {
      //   newRequests[index].sourceHost = populatedData.source_host;
      //   newAutoPopulatedFields[index].sourceHost = true;
      // }

      // if (populatedData.destination_ip && (!newRequests[index].destinationIP || autoPopulatedFields[index].destinationIP)) {
      //   newRequests[index].destinationIP = populatedData.destination_ip;
      //   newAutoPopulatedFields[index].destinationIP = true;
      // }

      // if (populatedData.destination_host && (!newRequests[index].destinationHost || autoPopulatedFields[index].destinationHost)) {
      //   newRequests[index].destinationHost = populatedData.destination_host;
      //   newAutoPopulatedFields[index].destinationHost = true;
      // }

      // if (populatedData.service && (!newRequests[index].service || autoPopulatedFields[index].service)) {
      //   newRequests[index].service = populatedData.service;
      //   newAutoPopulatedFields[index].service = true;
      // }

      // if (populatedData.description && (!newRequests[index].description || autoPopulatedFields[index].description)) {
      //   newRequests[index].description = populatedData.description;
      //   newAutoPopulatedFields[index].description = true;
      // }

      setRequests(newRequests);
      // setAutoPopulatedFields(newAutoPopulatedFields);

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

  // Get filtered Destination IP options based on system_type and category - IMPROVED
  const getFilteredDestinationIPs = (index) => {
    const request = requests[index];
    const system_type = request.system_type;
    const category = request.category;

    if (!system_type || !category || system_type === "Others") return [];

    // console.log(`🔍 Filtering Destination IPs for ${system_type} - ${category}`);

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

  // Get all unique values for combobox suggestions
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

  // // NEW: Validate a single field
  // const validateField = (field, value) => {
  //   switch (field) {
  //     case 'sourceIP':
  //     case 'destinationIP':
  //       return validateIP(value);
  //     case 'service':
  //       return validateService(value);
  //     case 'description':
  //       return validateDescription(value);
  //     default:
  //       return { valid: true, error: '' };
  //   }
  // };

  //  Handle field blur - validate on blur
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
    const oldValue = newRequests[index][field ]

    newRequests[index][field] = value;

    if (validationErrors[index]?.[field]) {
      const newErrors = [...validationErrors];
      delete newErrors[index][field];
      setValidationErrors(newErrors);
    }

    if (field === 'system_type' && oldValue !== value) {

//       const wasTemplateLoaded = Object.values(newAutoPopulatedFields[index]).some(val => val === true);
//
//       if(!wasTemplateLoaded){
//         newRequests[index].category = "";
//         newRequests[index].sourceIP = "";
//         newRequests[index].sourceIPId = "";
//         newRequests[index].sourceHost = "";
//         newRequests[index].destinationIP = "";
//         newRequests[index].destinationIPId = "";
//         newRequests[index].destinationHost = "";
//         newRequests[index].service = "";
//         newRequests[index].description = "";
//
//         newAutoPopulatedFields[index] = {
//           sourceIP: false,
//           sourceHost: false,
//           destinationIP: false,
//           destinationHost: false,
//           service: false,
//           description: false
//         };
//       }


      // Clear validation errors for this row
      const newErrors = [...validationErrors];
      newErrors[index] = {};
      setValidationErrors(newErrors);
    }

    // Reset IP fields when category changes (for non-Others system_type)
    if (field === 'category' && !isOthersCategory(index) && oldValue !== value) {

//       const wasTemplateLoaded = Object.value(autoPopulatedFields[index]).some(val => val === true)
//       if(!wasTemplateLoaded){
//         newRequests[index].sourceIP = "";
//         newRequests[index].sourceIPId = "";
//         newRequests[index].sourceHost = "";
//         newRequests[index].destinationIP = "";
//         newRequests[index].destinationIPId = "";
//         newRequests[index].destinationHost = "";
//         newRequests[index].service = "";
//         newRequests[index].description = "";
//
//         newAutoPopulatedFields[index] = {
//           sourceIP: false,
//           sourceHost: false,
//           destinationIP: false,
//           destinationHost: false,
//           service: false,
//           description: false
//         };
//
//       }

      // Clear validation errors for IP fields
      const newErrors = [...validationErrors];
      newErrors[index] = {};
      setValidationErrors(newErrors);
    }

    // Handle combobox selection (when user selects from dropdown)
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

        // Clear validation errors for auto-populated fields
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

    // Auto-population logic for Source IP or Destination IP selection (ID-based)
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

        // Clear validation errors for auto-populated fields
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

  // MODIFIED: Add request with validation state
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
    // Add empty validation error object for new row
    setValidationErrors([...validationErrors, {}]);
    setTouchedFields([...touchedFields, {}]);
  };

  // MODIFIED: Remove request with validation state
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

  // NEW: Validate all requests before submission
  // const validateAllRequests = () => {
  //   const newErrors = [];
  //   let hasErrors = false;

  //   requests.forEach((req, index) => {
  //     const rowErrors = {};

  //     // Only validate relevant fields for "Others" category
  //     if (isOthersCategory(index)) {
  //       // Validate IPs
  //       const sourceIPValidation = validateIP(req.sourceIP);
  //       if (!sourceIPValidation.valid) {
  //         rowErrors.sourceIP = sourceIPValidation.error;
  //         hasErrors = true;
  //       }

  //       const destIPValidation = validateIP(req.destinationIP);
  //       if (!destIPValidation.valid) {
  //         rowErrors.destinationIP = destIPValidation.error;
  //         hasErrors = true;
  //       }

  //       // Validate Service
  //       const serviceValidation = validateService(req.service);
  //       if (!serviceValidation.valid) {
  //         rowErrors.service = serviceValidation.error;
  //         hasErrors = true;
  //       }

  //       // Validate Description (optional but if provided)
  //       if (req.description) {
  //         const descValidation = validateDescription(req.description);
  //         if (!descValidation.valid) {
  //           rowErrors.description = descValidation.error;
  //           hasErrors = true;
  //         }
  //       }
  //     } else {
  //       // Standard validation for non-"Others" system types
  //       if (req.sourceIP) {
  //         const sourceIPValidation = validateIP(req.sourceIP);
  //         if (!sourceIPValidation.valid) {
  //           rowErrors.sourceIP = sourceIPValidation.error;
  //           hasErrors = true;
  //         }
  //       }

  //       if (req.destinationIP) {
  //         const destIPValidation = validateIP(req.destinationIP);
  //         if (!destIPValidation.valid) {
  //           rowErrors.destinationIP = destIPValidation.error;
  //           hasErrors = true;
  //         }
  //       }

  //       if (req.service) {
  //         const serviceValidation = validateService(req.service);
  //         if (!serviceValidation.valid) {
  //           rowErrors.service = serviceValidation.error;
  //           hasErrors = true;
  //         }
  //       }

  //       if (req.description) {
  //         const descValidation = validateDescription(req.description);
  //         if (!descValidation.valid) {
  //           rowErrors.description = descValidation.error;
  //           hasErrors = true;
  //         }
  //       }
  //     }

  //     newErrors[index] = rowErrors;
  //   });

  //   // Mark all fields as touched
  //   const allTouched = requests.map(() => ({
  //     sourceIP: true,
  //     destinationIP: true,
  //     service: true,
  //     description: true
  //   }));
  //   setTouchedFields(allTouched);

  //   setValidationErrors(newErrors);
  //   return !hasErrors;
  // };

  const validateRequestsBackend = async () => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      const token = localStorage.getItem('token');
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
        // Validation failed - show errors
        setValidationErrors(data.validation_results || []);
        setShowValidationModal(true);
        return false;
      }

      // All valid
      return true;

    } catch (err) {
      setSubmitError(`Validation failed: ${err.message}`);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Handle bulk submit with validation
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    // Basic validation
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

      // Validate all fields
    const isValid = await validateRequestsBackend();

    if (!isValid) {
      setSubmitError('Please fix the validation errors highlighted below');
      return;
    }
      setLoading(true);

      const token = localStorage.getItem('token');
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
        })
      );

      const responses = await Promise.all(submissionPromises);
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];

        if (!response.ok) {
          // If any request failed, try to get the error message
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Request #${i + 1} failed`);
        }
      }

      // Success!
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

      setSubmitSuccess(`✅ Successfully submitted ${requests.length} ACL request(s)! You can download an Excel report below.`);

      setTimeout(() => setSubmitSuccess(""), 8000);

    } catch (err) {
      setSubmitError(`Failed to submit requests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  // // Helper to check if field has error
  // const hasFieldError = (index, field) => {
  //   return touchedFields[index]?.[field] && validationErrors[index]?.[field];
  // };

  // // Helper to get field error message
  // const getFieldError = (index, field) => {
  //   return validationErrors[index]?.[field] || '';
  // };

  if (loading && requests.length === 1 && !requests[0].system_type) {
    return <div className="loading">Loading form options...</div>;
  }

  return (
    <div className="acl-table-container">
      <div className="acl-table-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>📋 ACL Request Automation</h1>
            <p>Create multiple ACL requests in a table format</p>
          </div>
          <nav style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              style={{
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Help & Instructions"
            >
              ❓ Help
            </button>
            <LogoutButton />
          </nav>
        </div>
      </div>

      {submitSuccess && (
        <div className="success-message">
          {submitSuccess}
        </div>
      )}

      {submitError && (
        <div className="error-message">
          {submitError}
        </div>
      )}

      {error && (
        <div className={error.includes('✅') ? 'success-message' : 'error-message'}>
          {error}
        </div>
      )}

      <form onSubmit={handleBulkSubmit}>
        <div className="acl-table-wrapper">
          <table className="acl-table">
            <thead>
              <tr>
                <th className="required-field">System Type</th>
                <th className="required-field">Category</th>
                <th className="required-field">Source IP</th>
                <th>Source Host</th>
                <th className="required-field">Destination IP</th>
                <th>Destination Host</th>
                <th className="required-field">Service</th>
                <th style={{minWidth: '200px'}} >Description</th>
                <th className="required-field" style={{minWidth: '120px'}}>Action</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request, index) => {
                const rowError = validationErrors.find(v => v.row_index === index);
                return (
                  <tr key={index} className={rowError && !rowError.valid ? 'error-row' : ''}>
                    <td>
                      <select
                        value={request.system_type}
                        onChange={(e) => updateRequest(index, 'system_type', e.target.value)}
                        required
                      >
                        <option value="">Select System Type</option>
                        {options.system_types.map((st, idx) => (
                          <option key={idx} value={st}>{st}</option>
                        ))}
                      </select>
                      {rowError?.errors?.system_type && (
                        <div className="field-error">{rowError.errors.system_type}</div>
                      )}
                    </td>

                    <td>
                      {request.system_type === "Others" ? (
                        <input
                          type="text"
                          value={request.category}
                          onChange={(e) => updateRequest(index, 'category', e.target.value)}
                          placeholder="Enter category"
                        />
                      ) : (
                        <select
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
                    </td>

                    <td>
                      <input
                        list={`sourceIP-options-${index}`}
                        value={request.sourceIP}
                        onChange={(e) => updateRequest(index, 'sourceIP', e.target.value)}
                        placeholder="Source IP"
                        className={rowError?.errors?.sourceIP ? 'input-error' : ''}
                        required
                      />
                      <datalist id={`sourceIP-options-${index}`}>
                        {getFilteredSourceIPs(index).map((ip, idx) => (
                          <option key={idx} value={ip.value} />
                        ))}
                      </datalist>
                      {rowError?.errors?.sourceIP && (
                        <div className="field-error">{rowError.errors.sourceIP}</div>
                      )}
                    </td>

                    <td>
                      <input
                        type="text"
                        value={request.sourceHost}
                        onChange={(e) => updateRequest(index, 'sourceHost', e.target.value)}
                        placeholder="Source Host"
                      />
                    </td>

                    <td>
                      <input
                        list={`destinationIP-options-${index}`}
                        value={request.destinationIP}
                        onChange={(e) => updateRequest(index, 'destinationIP', e.target.value)}
                        placeholder="Destination IP"
                        className={rowError?.errors?.destinationIP ? 'input-error' : ''}
                        required
                      />
                      <datalist id={`destinationIP-options-${index}`}>
                        {getFilteredDestinationIPs(index).map((ip, idx) => (
                          <option key={idx} value={ip.value} />
                        ))}
                      </datalist>
                      {rowError?.errors?.destinationIP && (
                        <div className="field-error">{rowError.errors.destinationIP}</div>
                      )}
                    </td>

                    <td>
                      <input
                        type="text"
                        value={request.destinationHost}
                        onChange={(e) => updateRequest(index, 'destinationHost', e.target.value)}
                        placeholder="Destination Host"
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        value={request.service}
                        onChange={(e) => updateRequest(index, 'service', e.target.value)}
                        placeholder="Service"
                        className={rowError?.errors?.service ? 'input-error' : ''}
                        required
                      />
                      {rowError?.errors?.service && (
                        <div className="field-error">{rowError.errors.service}</div>
                      )}
                    </td>

                    <td>
                      <textarea
                        value={request.description}
                        onChange={(e) => updateRequest(index, 'description', e.target.value)}
                        placeholder="Description"
                        className={rowError?.errors?.description ? 'input-error' : ''}
                        style={{minWidth: '180px', minHeight: '40px'}}
                      />
                      {rowError?.errors?.description && (
                        <div className="field-error">{rowError.errors.description}</div>
                      )}
                    </td>

                    <td>
                      <select
                        value={request.action}
                        onChange={(e) => updateRequest(index, 'action', e.target.value)}
                        required
                        style={{minWidth: '100px'}}
                      >
                        <option value="">Select</option>
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                    </td>

                    <td>
                      {requests.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRequest(index)}
                          className="btn-remove-row"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }
              )}
            </tbody>
          </table>
        </div>
        {/* Form Actions */}
        <div className="acl-form-actions">
          <button
            type="button"
            onClick={addRequest}
            className="btn-add-request"
          >
            <span>+</span> Add Another Request
          </button>
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
          >
            <span>+</span> 📋 Use Template
          </button>

          <div className="acl-submit-section">
            <div className="acl-request-count">
              Total Requests: {requests.length}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleDownloadExcel}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                title="Download Excel report of all requests"
              >
                📥 Download Excel
              </button>
              <button
                type="submit"
                disabled={loading || isValidating}
                className="btn-submit-requests"
              >
                {loading ? "Submitting..." : `Submit ${requests.length} Request(s)`}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Template Selection Modal */}
        {showTemplates && (
        <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Select Template</h2>
              <button className="close-btn" onClick={() => setShowTemplates(false)}>×</button>
            </div>
            <div className="modal-body">
              {loadingTemplates ? (
                <p>Loading templates...</p>
              ) : templates.length === 0 ? (
                <p>No templates available</p>
              ) : (
                <div className="templates-list">
                  {templates.map(template => (
                    <div key={template.template_name} className="template-item">
                      <h4>{template.template_name}</h4>
                      <p><strong>Rules:</strong> {template.rule_count}</p>
                      <div style={{fontSize: '12px', color: '#666', marginBottom: '10px'}}>
                        {template.rules.map((rule, idx) => (
                          <div key={idx}>
                            {idx + 1}. {rule.system_type} - {rule.category} ({rule.service})
                          </div>
                        ))}
                      </div>
                      <button onClick={() => loadTemplate(template)} className="btn-use-template">
                        Use Template ({template.rule_count} rules)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors Modal */}
      {showValidationModal && validationErrors.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowValidationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Validation Errors</h2>
              <button className="close-btn" onClick={() => setShowValidationModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Please fix the following errors before submitting:</p>
              {validationErrors.filter(v => !v.valid).map((result, idx) => (
                <div key={idx} className="validation-error-item">
                  <h4>Request #{result.row_index + 1}:</h4>
                  <ul>
                    {Object.entries(result.errors).map(([field, error]) => (
                      <li key={field}><strong>{field}:</strong> {error}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowValidationModal(false)} className="btn-secondary">
                Close and Fix Errors
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Help Modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>❓ Help & Instructions</h2>
              <button className="close-btn" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="modal-body">
              {loadingHelp ? (
                <p>Loading help information...</p>
              ) : helpContent ? (
                <div style={{ padding: '20px' }}>
                  <section style={{ marginBottom: '30px' }}>
                    <h3>📖 Overview</h3>
                    <p>{helpContent.overview}</p>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>📝 How to Create a Request</h3>
                    <ol style={{ paddingLeft: '20px' }}>
                      {helpContent.how_to_create_request?.steps?.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>{step}</li>
                      ))}
                    </ol>
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
                      <strong>💡 Tips:</strong>
                      <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                        {helpContent.how_to_create_request?.tips?.map((tip, idx) => (
                          <li key={idx} style={{ marginBottom: '5px' }}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>✅ Validation Rules</h3>
                    <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                      <p><strong>IP Addresses:</strong> {helpContent.validation_rules?.ip_addresses}</p>
                      <p><strong>Services:</strong> {helpContent.validation_rules?.services}</p>
                      <p><strong>Description:</strong> {helpContent.validation_rules?.description}</p>
                    </div>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>📋 Templates</h3>
                    <p><strong>Info:</strong> {helpContent.templates?.info}</p>
                    <p><strong>Usage:</strong> {helpContent.templates?.usage}</p>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>📊 Request Status</h3>
                    <ul style={{ paddingLeft: '20px' }}>
                      <li><strong>Pending:</strong> {helpContent.request_status?.pending}</li>
                      <li><strong>Approved:</strong> {helpContent.request_status?.approved}</li>
                      <li><strong>Rejected:</strong> {helpContent.request_status?.rejected}</li>
                    </ul>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>👥 Role Permissions</h3>
                    <ul style={{ paddingLeft: '20px' }}>
                      <li><strong>User:</strong> {helpContent.role_permissions?.user}</li>
                      <li><strong>Reviewer:</strong> {helpContent.role_permissions?.reviewer}</li>
                      <li><strong>Admin:</strong> {helpContent.role_permissions?.admin}</li>
                    </ul>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>📦 Bulk Operations</h3>
                    <p>{helpContent.bulk_operations}</p>
                  </section>

                  <section style={{ marginBottom: '30px' }}>
                    <h3>📥 Export</h3>
                    <p>{helpContent.export}</p>
                  </section>

                  <section>
                    <h3>📧 Contact Support</h3>
                    <p><strong>Email:</strong> {helpContent.contact_support?.email}</p>
                    <p><em>{helpContent.contact_support?.note}</em></p>
                  </section>
                </div>
              ) : (
                <p>Failed to load help information</p>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '15px', borderTop: '1px solid #ddd', textAlign: 'right' }}>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS for validation styling */}
      <style jsx="true">{`
    .input-error {
      border: 2px solid #dc3545 !important;
      background-color: #fff5f5 !important;
    }

    .field-error-message {
      color: #dc3545;
      font-size: 11px;
      margin-top: 2px;
      position: absolute;
      background: white;
      padding: 2px 5px;
      border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      z-index: 100;
      max-width: 200px;
    }

    .combobox-container {
      position: relative;
    }

    .validation-error-row {
      background-color: #fff5f5;
    }

    .validation-errors-cell {
      padding: 10px !important;
    }

    .validation-errors-container {
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      padding: 10px;
      color: #721c24;
    }

    .validation-errors-container strong {
      display: block;
      margin-bottom: 8px;
    }

    .validation-errors-container ul {
      margin: 0;
      padding-left: 20px;
    }

    .validation-errors-container li {
      margin: 5px 0;
    }

    .success-message {
      background-color: #d4edda;
      color: #155724;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      border: 1px solid #c3e6cb;
    }

    .error-message {
      background-color: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      border: 1px solid #f5c6cb;
    }
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
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.template-item {
  border: 1px solid #ddd;
  padding: 15px;
  border-radius: 4px;
}

.template-item h4 {
  margin: 0 0 10px 0;
}

.btn-use-template {
  margin-top: 10px;
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
  `}</style>
    </div>
  )
}
export default RequesterPage;
