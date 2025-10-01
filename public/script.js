/**
 * YourBizGuru Mini-Dashboard - Frontend JavaScript
 * Handles form submission, API calls, results display, local storage, and theming
 * 
 * === PHASE 2 RESERVATION NOTES (DEVELOPER USE ONLY) ===
 * Future subscription system integration planned:
 * - Toolkits will be connected to subscription plans (Basic, Pro, Enterprise tiers)
 * - Each client will have a master dashboard showing:
 *   • Active subscriptions and billing status
 *   • Invoice history and payment methods
 *   • Purchase history and usage analytics
 *   • Additional features: integrated calendar, product marketplace, team management
 * - Authentication will be handled via secure token system
 * - API rate limiting based on subscription tier
 * - Webhook integration for real-time subscription updates
 * 
 * Note: This is a placeholder for Phase 2 implementation. 
 * Current template operates as a standalone toolkit without authentication.
 * ========================================================
 */

/**
 * Theme Manager - Handles light/dark theme switching and persistence
 */
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'ybg-theme';
        this.THEME_LIGHT = 'theme-light';
        this.THEME_DARK = 'theme-dark';
        
        this.init();
    }
    
    init() {
        // Get initial theme preference
        const storedTheme = localStorage.getItem(this.STORAGE_KEY);
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Order of precedence: manual > system preference > default (light)
        let initialTheme;
        if (storedTheme) {
            initialTheme = storedTheme;
        } else if (systemPrefersDark) {
            initialTheme = this.THEME_DARK;
        } else {
            initialTheme = this.THEME_LIGHT;
        }
        
        // Apply initial theme
        this.setTheme(initialTheme, false);
        
        // Bind toggle button
        this.bindToggle();
        
        // Listen for system preference changes
        this.listenForSystemChanges();
    }
    
    setTheme(theme, persist = true) {
        const htmlElement = document.documentElement;
        const themeIcon = document.getElementById('themeIcon');
        
        // Remove existing theme classes
        htmlElement.classList.remove(this.THEME_LIGHT, this.THEME_DARK);
        
        // Apply new theme
        htmlElement.classList.add(theme);
        
        // Update icon
        if (themeIcon) {
            themeIcon.textContent = theme === this.THEME_DARK ? '🌙' : '☀️';
        }
        
        // Persist choice if manual toggle
        if (persist) {
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
        
        // Update meta theme-color for mobile browsers
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = theme === this.THEME_DARK ? '#0A0A0A' : '#4DB6E7';
        }
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.classList.contains(this.THEME_DARK) 
            ? this.THEME_DARK 
            : this.THEME_LIGHT;
        
        const newTheme = currentTheme === this.THEME_DARK 
            ? this.THEME_LIGHT 
            : this.THEME_DARK;
        
        this.setTheme(newTheme, true);
    }
    
    bindToggle() {
        const toggleButton = document.getElementById('themeToggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggleTheme());
        }
    }
    
    listenForSystemChanges() {
        // Only apply system changes if user hasn't manually set a preference
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const hasManualPreference = localStorage.getItem(this.STORAGE_KEY);
            if (!hasManualPreference) {
                const newTheme = e.matches ? this.THEME_DARK : this.THEME_LIGHT;
                this.setTheme(newTheme, false);
            }
        });
    }
}

class YBGToolkit {
    constructor() {
        this.maxResults = 5; // Store last 5 results per toolkit
        this.storageKey = 'ybg_toolkit_results'; // Will be prefixed with toolkit name
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.bindKeyboardShortcuts();
        // Auto-save and character counter disabled for compliance form
        // this.initAutoSave();
        // this.initCharacterCounter();
        this.loadStoredResults();
    }

    bindEvents() {
        // Form submission
        const form = document.getElementById('toolkitForm');
        form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Clear history
        const clearBtn = document.getElementById('clearHistoryBtn');
        clearBtn.addEventListener('click', () => this.clearHistory());
        
        // Export all results as PDF
        const exportBtn = document.getElementById('exportAllBtn');
        const exportMode = document.getElementById('exportMode');
        exportBtn.addEventListener('click', async () => {
            const resultsArray = this.getStoredResults();
            if (!resultsArray.length) return this.showError('No results to export');
            
            // Show loading state
            const originalText = exportBtn.textContent;
            exportBtn.disabled = true;
            exportBtn.textContent = 'Generating...';
            
            try {
                const mode = (exportMode?.value || "latest");
                const resultsForExport = resultsArray.map((result, index) => {
                    // Handle both old (prompt) and new (formData) result formats
                    const requestText = result.prompt || this.formatFormDataSummary(result.formData);
                    return {
                        title: `Result ${index + 1} - ${result.displayTime}`,
                        text: `Request: ${requestText}\n\nResult:\n${result.result}`
                    };
                });
                
                await window.exportAllResultsToPDF(resultsForExport, { mode });
                this.showSuccess(`PDF exported successfully (${mode} mode)`);
            } catch (error) {
                console.error('PDF export failed:', error);
                this.showError('Failed to export PDF. Please try again.');
            } finally {
                // Restore button state
                exportBtn.disabled = false;
                exportBtn.textContent = originalText;
            }
        });

        // Copy all results button
        const copyAllBtn = document.getElementById('copyAllBtn');
        copyAllBtn.addEventListener('click', () => this.copyAllResults());

        // Dynamic event delegation for copy button
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn')) {
                this.copyResult(e.target);
            }
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Clear previous errors
        this.clearValidationErrors();
        
        // Collect form data
        const formData = this.collectFormData();
        
        // Validate required fields
        const validation = this.validateForm(formData);
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }
        
        // Show loading state
        this.setLoadingState(true);
        
        try {
            // Initialize compliance generator
            const generator = new window.ComplianceGenerator();
            
            // Generate structured output using filing profile
            const result = await generator.generate(formData);
            
            // Show profile badge if generic fallback was used
            if (result.isGeneric) {
                this.showInfo(`Using generic ${formData.filingType} profile. State-specific profile not available for ${formData.jurisdiction || 'selected jurisdiction'}.`);
            } else {
                this.showSuccess(`Loaded: ${result.profileUsed}`);
            }

            // Add result to display and storage
            this.addResult(formData, result.output, result.profileUsed, result.matchType);
            
        } catch (error) {
            console.error('Error generating result:', error);
            this.showError(error.message || 'Failed to generate result. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }

    collectFormData() {
        // Collect all form field values
        const entityName = document.getElementById('entityName').value.trim();
        const entityType = document.getElementById('entityType').value;
        const jurisdiction = document.getElementById('jurisdiction').value.trim();
        const filingType = document.getElementById('filingType').value;
        const deadline = document.getElementById('deadline').value;
        const risks = document.getElementById('risks').value.trim();
        const mitigation = document.getElementById('mitigation').value.trim();
        
        // Collect selected requirements
        const requirements = [];
        const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked');
        checkboxes.forEach(cb => requirements.push(cb.value));
        
        return {
            entityName,
            entityType,
            jurisdiction,
            filingType,
            deadline,
            requirements,
            risks,
            mitigation
        };
    }

    validateForm(formData) {
        const errors = {};
        let isValid = true;
        
        // Validate required fields
        if (!formData.entityType) {
            errors.entityType = 'Business Entity Type is required';
            isValid = false;
        }
        
        if (!formData.filingType) {
            errors.filingType = 'Filing Type is required';
            isValid = false;
        }
        
        if (!formData.deadline) {
            errors.deadline = 'Filing Deadline is required';
            isValid = false;
        }
        
        return { isValid, errors };
    }

    showValidationErrors(errors) {
        // Display error messages
        for (const [field, message] of Object.entries(errors)) {
            const errorEl = document.getElementById(`${field}Error`);
            if (errorEl) {
                errorEl.textContent = message;
            }
        }
        
        // Show general error notification
        this.showError('Please fill in all required fields');
    }

    clearValidationErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.textContent = '');
    }

    buildCompliancePrompt(formData) {
        // Build a structured prompt that includes all form data
        let prompt = `Generate a comprehensive compliance report for the following filing:\n\n`;
        
        if (formData.entityName) {
            prompt += `Entity Name: ${formData.entityName}\n`;
        }
        prompt += `Entity Type: ${formData.entityType}\n`;
        
        if (formData.jurisdiction) {
            prompt += `Jurisdiction: ${formData.jurisdiction}\n`;
        }
        
        prompt += `Filing Type: ${formData.filingType}\n`;
        prompt += `Deadline: ${formData.deadline}\n\n`;
        
        if (formData.requirements.length > 0) {
            prompt += `Required Documents:\n${formData.requirements.map(r => `- ${r}`).join('\n')}\n\n`;
        }
        
        if (formData.risks) {
            prompt += `Identified Risks/Consequences:\n${formData.risks}\n\n`;
        }
        
        if (formData.mitigation) {
            prompt += `Mitigation Plan:\n${formData.mitigation}\n\n`;
        }
        
        prompt += `Please provide a structured compliance report with the following sections:\n`;
        prompt += `1. Executive Compliance Summary (1-2 paragraphs)\n`;
        prompt += `2. Filing Requirements Checklist (bulleted with checkmarks)\n`;
        prompt += `3. Compliance Roadmap (timeline table)\n`;
        prompt += `4. Risk Matrix (3-column table: Risk | Consequence | Mitigation)\n`;
        prompt += `5. Next Steps & Recommendations (numbered list)`;
        
        return prompt;
    }

    clearForm() {
        document.getElementById('entityName').value = '';
        document.getElementById('entityType').value = '';
        document.getElementById('jurisdiction').value = '';
        document.getElementById('filingType').value = '';
        document.getElementById('deadline').value = '';
        document.getElementById('risks').value = '';
        document.getElementById('mitigation').value = '';
        
        const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    }

    formatFormDataSummary(formData) {
        if (!formData) return 'Compliance Filing';
        
        let summary = '';
        if (formData.filingType) summary += formData.filingType;
        if (formData.entityType) summary += ` for ${formData.entityType}`;
        if (formData.entityName) summary += ` (${formData.entityName})`;
        if (formData.jurisdiction) summary += ` - ${formData.jurisdiction}`;
        
        return summary || 'Compliance Filing';
    }

    setLoadingState(loading) {
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const loadingText = document.getElementById('loadingText');
        const formInputs = document.querySelectorAll('#toolkitForm input, #toolkitForm select, #toolkitForm textarea');

        if (loading) {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            submitText.classList.add('hidden');
            loadingText.classList.remove('hidden');
            formInputs.forEach(input => input.disabled = true);
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitText.classList.remove('hidden');
            loadingText.classList.add('hidden');
            formInputs.forEach(input => input.disabled = false);
        }
    }

    addResult(formData, result, profileUsed, matchType) {
        const timestamp = new Date();
        
        // Create a summary prompt for display
        const promptSummary = `${formData.filingType} for ${formData.entityType}${formData.entityName ? ` (${formData.entityName})` : ''}`;
        
        const resultData = {
            id: Date.now().toString(),
            prompt: promptSummary,
            formData,
            result,
            profileUsed: profileUsed || 'Unknown',
            matchType: matchType || 'generic',
            timestamp: timestamp.toISOString(),
            displayTime: this.formatTimestamp(timestamp)
        };

        // Add to storage
        this.saveResult(resultData);

        // Add to display
        this.displayResult(resultData);

        // Hide "no results" message
        const noResults = document.getElementById('noResults');
        noResults.style.display = 'none';
    }

    displayResult(resultData) {
        const resultsContainer = document.getElementById('resultsContainer');
        const template = document.getElementById('resultTemplate');
        const resultElement = template.content.cloneNode(true);

        // Populate result data
        const timestampEl = resultElement.querySelector('.result-timestamp');
        const contentEl = resultElement.querySelector('.result-content');
        const copyBtn = resultElement.querySelector('.copy-btn');

        timestampEl.textContent = resultData.displayTime;
        contentEl.textContent = resultData.result;
        
        // Store data for copy action
        copyBtn.dataset.resultId = resultData.id;
        
        // Add to top of results (newest first)
        resultsContainer.insertBefore(resultElement, resultsContainer.firstChild);

        // Scroll to show new result
        resultsContainer.scrollTop = 0;
    }

    copyResult(button) {
        const resultId = button.dataset.resultId;
        const results = this.getStoredResults();
        const result = results.find(r => r.id === resultId);
        
        if (result) {
            navigator.clipboard.writeText(result.result).then(() => {
                this.showSuccess('Result copied to clipboard!');
                
                // Visual feedback
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Copy failed:', err);
                this.showError('Failed to copy result');
            });
        }
    }


    saveResult(resultData) {
        const results = this.getStoredResults();
        results.unshift(resultData); // Add to beginning
        
        // Keep only last N results
        if (results.length > this.maxResults) {
            results.splice(this.maxResults);
        }
        
        localStorage.setItem(this.getStorageKey(), JSON.stringify(results));
    }

    getStoredResults() {
        const stored = localStorage.getItem(this.getStorageKey());
        return stored ? JSON.parse(stored) : [];
    }

    loadStoredResults() {
        const results = this.getStoredResults();
        
        if (results.length === 0) {
            return;
        }

        // Hide "no results" message
        const noResults = document.getElementById('noResults');
        noResults.style.display = 'none';

        // Display results (newest first)
        results.forEach(result => {
            this.displayResult(result);
        });
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all results? This cannot be undone.')) {
            localStorage.removeItem(this.getStorageKey());
            
            // Clear display
            const resultsContainer = document.getElementById('resultsContainer');
            const resultItems = resultsContainer.querySelectorAll('.result-item');
            resultItems.forEach(item => item.remove());
            
            // Show "no results" message
            const noResults = document.getElementById('noResults');
            noResults.style.display = 'block';
            
            this.showSuccess('History cleared successfully!');
        }
    }

    async exportAllResults() {
        // This method is now handled by the event listener above
        // Keeping for backward compatibility if called directly
        const results = this.getStoredResults();
        
        if (results.length === 0) {
            this.showError('No results available to export.');
            return;
        }

        const allContent = results.map((result, index) => ({
            title: `Result ${index + 1} - ${result.displayTime}`,
            text: `Request: ${result.prompt}\n\nResult:\n${result.result}`
        }));

        try {
            await window.exportAllResultsToPDF(allContent, { mode: "all" });
            this.showSuccess('All results exported as PDF!');
        } catch (error) {
            console.error('PDF export failed:', error);
            this.showError('Failed to generate PDF. Please try again.');
        }
    }

    getToolkitName() {
        // Extract toolkit name from page title (before " ·")
        const title = document.title;
        return title.split(' ·')[0] || 'YBG Mini-Dashboard';
    }

    getStorageKey() {
        const toolkitName = this.getToolkitName().toLowerCase().replace(/\s+/g, '_');
        return `${this.storageKey}_${toolkitName}`;
    }

    formatTimestamp(date) {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add toast styles if not already present
        if (!document.querySelector('.toast-styles')) {
            const styles = document.createElement('style');
            styles.className = 'toast-styles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-family: var(--font-body, 'Open Sans', sans-serif);
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 10000;
                    opacity: 0;
                    transform: translateX(100%);
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
                .toast.show {
                    opacity: 1;
                    transform: translateX(0);
                }
                .toast-success {
                    background: #4CAF50;
                    color: white;
                }
                .toast-error {
                    background: #F44336;
                    color: white;
                }
                .toast-info {
                    background: #2196F3;
                    color: white;
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    // === UX ENHANCEMENTS ===

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter or Cmd+Enter to submit form
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                const form = document.getElementById('toolkitForm');
                if (!form) return;
                
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
                return;
            }
            
            // Ctrl+S or Cmd+S to export PDF
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const exportBtn = document.getElementById('exportAllBtn');
                if (exportBtn && !exportBtn.disabled) {
                    exportBtn.click();
                }
                return;
            }
            
            // Ctrl+K or Cmd+K to focus first input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const firstInput = document.getElementById('entityName');
                if (firstInput) {
                    firstInput.focus();
                    firstInput.select();
                }
                return;
            }

            // Ctrl+Shift+C or Cmd+Shift+C to copy all results
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.copyAllResults();
                return;
            }
        });
    }

    initAutoSave() {
        const promptInput = document.getElementById('promptInput');
        const autoSaveKey = 'ybg_autosave_input';
        
        // Load saved input on page load
        const savedInput = localStorage.getItem(autoSaveKey);
        if (savedInput && !promptInput.value) {
            promptInput.value = savedInput;
        }
        
        // Auto-save as user types (debounced)
        let saveTimeout;
        promptInput.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (promptInput.value.trim()) {
                    localStorage.setItem(autoSaveKey, promptInput.value);
                } else {
                    localStorage.removeItem(autoSaveKey);
                }
            }, 1000); // Save 1 second after user stops typing
        });
        
        // Clear auto-save after successful submission
        const form = document.getElementById('toolkitForm');
        form.addEventListener('submit', () => {
            setTimeout(() => {
                localStorage.removeItem(autoSaveKey);
            }, 100);
        });
    }

    initCharacterCounter() {
        const promptInput = document.getElementById('promptInput');
        const formGroup = promptInput.parentElement;
        
        // Create character counter element
        const counter = document.createElement('div');
        counter.className = 'character-counter';
        counter.id = 'characterCounter';
        
        // Add counter styles
        if (!document.querySelector('#character-counter-styles')) {
            const styles = document.createElement('style');
            styles.id = 'character-counter-styles';
            styles.textContent = `
                .character-counter {
                    font-size: var(--font-size-xs);
                    color: rgb(var(--text-muted));
                    text-align: right;
                    margin-top: 4px;
                    font-family: var(--font-body);
                }
                .character-counter.warning {
                    color: #ff9800;
                }
                .character-counter.danger {
                    color: #f44336;
                }
            `;
            document.head.appendChild(styles);
        }
        
        formGroup.appendChild(counter);
        
        const updateCounter = () => {
            const length = promptInput.value.length;
            counter.textContent = `${length.toLocaleString()} characters`;
            
            // Add visual warnings for common API limits
            counter.classList.remove('warning', 'danger');
            if (length > 8000) {
                counter.classList.add('danger');
            } else if (length > 6000) {
                counter.classList.add('warning');
            }
        };
        
        promptInput.addEventListener('input', updateCounter);
        updateCounter(); // Initial count
    }

    copyAllResults() {
        const results = this.getStoredResults();
        if (results.length === 0) {
            this.showToast('No results to copy', 'info');
            return;
        }

        // Format all results with timestamps
        const formattedResults = results.map((result, index) => {
            const date = new Date(result.timestamp).toLocaleString();
            return `=== Result ${index + 1} (${date}) ===\n\n${result.result}`;
        }).join('\n\n' + '='.repeat(50) + '\n\n');

        navigator.clipboard.writeText(formattedResults).then(() => {
            this.showToast(`Copied ${results.length} results to clipboard!`, 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            this.showToast('Failed to copy results', 'error');
        });
    }
}

// Initialize the toolkit and theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // YBG Toolkit Context (overridable per toolkit)
    if (!window.currentToolkitName) window.currentToolkitName = "CompliPilot";
    if (!window.currentToolkitIcon) window.currentToolkitIcon = "/favicon-32x32.png";
    
    window.themeManager = new ThemeManager();
    window.ybgToolkit = new YBGToolkit();
});

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.ybgToolkit) {
        window.ybgToolkit.showError('An unexpected error occurred. Please try again.');
    }
});