// GrantGenie Modular Toolkit Configuration System
// This file defines multiple toolkits that can be swapped with minimal changes

const TOOLKIT_CONFIGS = {
    grantgenie: {
        name: "GrantGenie",
        tagline: "Unlock grant opportunities with AI-powered assistance",
        icon: "/favicon-32x32.png",
        logo: "grantgenie-logo.png",
        themeColor: "#4DB6E7", // Light Blue
        primaryColorRGB: "79, 195, 247",
        
        // Form configuration
        formType: "compliance",
        formFields: [
            { id: "entityName", label: "Entity Name", type: "text", required: false },
            { id: "entityType", label: "Business Entity Type", type: "select", required: true, options: [
                "LLC (Limited Liability Company)",
                "Corporation",
                "S-Corporation",
                "C-Corporation",
                "Nonprofit Organization",
                "Sole Proprietorship",
                "Partnership",
                "LLP (Limited Liability Partnership)"
            ]},
            { id: "jurisdiction", label: "Jurisdiction (State/Country)", type: "text", required: false },
            { id: "filingType", label: "Filing Type", type: "select", required: true, options: [
                "Annual Report",
                "BOIR (Beneficial Ownership Information Report)",
                "DBE Certification",
                "MBE Certification",
                "8a Certification",
                "SAM.gov Registration",
                "Business License Renewal",
                "SBA Filing",
                "State Tax Registration",
                "Operating Agreement Update",
                "Other Compliance Filing"
            ]},
            { id: "deadline", label: "Filing Deadline", type: "date", required: true },
            { id: "requirements", label: "Required Documents & Information", type: "checkbox-group", required: false },
            { id: "risks", label: "Identified Risks/Consequences", type: "textarea", required: false },
            { id: "mitigation", label: "Mitigation Plan", type: "textarea", required: false }
        ],
        
        // AI prompt template
        systemPromptTemplate: "compliance",
        
        // PDF export settings
        pdfFilenamePrefix: "GrantGenie_Compliance_Report"
    },
    
    elev8analyzer: {
        name: "Elev8 Analyzer",
        tagline: "Elevate Your Business — 8 Pillars to Growth",
        icon: "/favicon-32x32.png",
        logo: "ybg-logo.svg",
        themeColor: "#0891B2", // Deep Blue-Teal (cyan-600)
        primaryColorRGB: "8, 145, 178",
        
        // Form configuration
        formType: "diagnostic",
        formFields: [
            { id: "businessName", label: "Business Name", type: "text", required: true },
            { id: "industry", label: "Industry", type: "select", required: true, options: [
                "Technology / Software",
                "Professional Services",
                "Healthcare",
                "Manufacturing",
                "Retail / E-commerce",
                "Construction",
                "Food & Beverage",
                "Real Estate",
                "Financial Services",
                "Transportation & Logistics",
                "Education",
                "Other"
            ]},
            { id: "revenueRange", label: "Annual Revenue Range", type: "select", required: true, options: [
                "Pre-Revenue",
                "$0 - $100K",
                "$100K - $500K",
                "$500K - $1M",
                "$1M - $5M",
                "$5M - $10M",
                "$10M+"
            ]},
            { id: "creditProfile", label: "Credit Profile", type: "select", required: false, options: [
                "Excellent (740+)",
                "Good (670-739)",
                "Fair (580-669)",
                "Poor (<580)",
                "Unknown/Not Established"
            ]},
            { id: "employees", label: "Number of Employees", type: "select", required: true, options: [
                "Just Me (0 employees)",
                "1-5",
                "6-10",
                "11-25",
                "26-50",
                "51-100",
                "100+"
            ]},
            { id: "challenges", label: "Primary Business Challenges", type: "textarea", required: false, 
              placeholder: "Describe your main business challenges, pain points, or growth obstacles..." },
            { id: "goals", label: "Strategic Goals (Next 12 Months)", type: "textarea", required: false,
              placeholder: "What are your key business objectives for the next year?" }
        ],
        
        // AI prompt template
        systemPromptTemplate: "diagnostic",
        
        // PDF export settings
        pdfFilenamePrefix: "Elev8_Business_Analysis"
    }
};

// Toolkit switcher - returns active toolkit config
function getActiveToolkit() {
    const activeToolkitKey = window.ACTIVE_TOOLKIT || 'elev8analyzer';
    return TOOLKIT_CONFIGS[activeToolkitKey];
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TOOLKIT_CONFIGS = TOOLKIT_CONFIGS;
    window.getActiveToolkit = getActiveToolkit;
}
