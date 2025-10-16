/**
 * CompliPilot - Unified Rendering Architecture
 * Panel = PDF with checksum verification
 */

// =====================================================
// THEME MANAGER (keeping existing functionality)
// =====================================================
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'ybg-theme';
        this.THEME_LIGHT = 'theme-light';
        this.THEME_DARK = 'theme-dark';
        this.init();
    }
    
    init() {
        const storedTheme = localStorage.getItem(this.STORAGE_KEY);
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        let initialTheme;
        if (storedTheme) {
            initialTheme = storedTheme;
        } else if (systemPrefersDark) {
            initialTheme = this.THEME_DARK;
        } else {
            initialTheme = this.THEME_LIGHT;
        }
        
        this.setTheme(initialTheme, false);
        this.bindToggle();
    }
    
    setTheme(theme, persist = true) {
        const htmlElement = document.documentElement;
        const themeIcon = document.getElementById('themeIcon');
        
        htmlElement.classList.remove(this.THEME_LIGHT, this.THEME_DARK);
        htmlElement.classList.add(theme);
        
        if (themeIcon) {
            themeIcon.textContent = theme === this.THEME_DARK ? '🌙' : '☀️';
        }
        
        if (persist) {
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
    }
    
    bindToggle() {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const current = document.documentElement.classList.contains(this.THEME_DARK) 
                    ? this.THEME_DARK 
                    : this.THEME_LIGHT;
                const newTheme = current === this.THEME_DARK ? this.THEME_LIGHT : this.THEME_DARK;
                this.setTheme(newTheme);
            });
        }
    }
}

// =====================================================
// COMPLIANCE TOOLKIT - UNIFIED RENDERING SYSTEM
// =====================================================
class ComplianceToolkit {
    constructor() {
        this.currentResult = null;
        this.ownerId = this.getOrCreateOwnerId();
        this.init();
    }

    // ========================================================
    // OWNER ID MANAGEMENT (Guest Ownership)
    // ========================================================
    getOrCreateOwnerId() {
        let ownerId = localStorage.getItem('ybg_owner_id');
        if (!ownerId) {
            // Generate UUID v4
            ownerId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('ybg_owner_id', ownerId);
        }
        return ownerId;
    }

    init() {
        this.bindFormSubmit();
        this.bindActions();
        this.bindDropdownMenus();
        this.bindKeyboardShortcuts();
        this.bindTitleInput();
        this.loadCurrentResult();
        this.startAutosave();
        this.bindHeaderResize();
    }

    // ========================================================
    // CHECKSUM (djb2 hash for Panel=PDF verification)
    // ========================================================
    checksum(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
    }

    // ========================================================
    // HELPERS FOR SAFE CONTENT
    // ========================================================
    ensure(val) {
        if (Array.isArray(val)) return val.length ? val : null;
        return val && String(val).trim() ? val : null;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    safePlaceholder(val) {
        // Returns escaped content or styled placeholder
        if (!val || (Array.isArray(val) && val.length === 0)) {
            return '<em style="color: rgb(var(--text-muted));">[Pending Input]</em>';
        }
        return this.escapeHtml(val);
    }

    // ========================================================
    // UNIFIED HTML RENDERER (single source of truth)
    // ========================================================
    renderStructuredHTML(payload, generated) {
        const {
            summary = '',
            checklist = [],
            timeline = [],
            riskMatrix = [],
            recommendations = [],
            references = []
        } = generated || {};

        // Build header metadata
        const headerBlock = `
            <div class="doc-meta">
                <div><strong>Entity:</strong> ${this.safePlaceholder(payload.entityName)}</div>
                <div><strong>Type:</strong> ${this.safePlaceholder(payload.entityType)}</div>
                <div><strong>Jurisdiction:</strong> ${this.safePlaceholder(payload.jurisdiction || 'General')}</div>
                <div><strong>Filing:</strong> ${this.safePlaceholder(payload.filingType)}</div>
                <div><strong>Deadline:</strong> ${this.safePlaceholder(payload.deadline)}</div>
            </div>
            <hr/>
        `;

        // Build sections
        const checklistItems = checklist && checklist.length > 0 ? checklist : ['[No checklist items provided]'];
        const checklistHTML = checklistItems.map(item => 
            `<li>${this.escapeHtml(item)}</li>`
        ).join('');

        const timelineItems = timeline && timeline.length > 0 ? timeline : [{
            milestone: '[Pending Input]', 
            owner: '[Pending Input]', 
            dueDate: '[Deadline required]', 
            notes: 'Provide filing deadline to generate timeline'
        }];
        const timelineRows = timelineItems.map(row => `
            <tr>
                <td>${this.safePlaceholder(row.milestone)}</td>
                <td>${this.safePlaceholder(row.owner)}</td>
                <td>${this.safePlaceholder(row.dueDate)}</td>
                <td>${this.escapeHtml(row.notes || '')}</td>
            </tr>
        `).join('');

        const riskItems = riskMatrix && riskMatrix.length > 0 ? riskMatrix : [{
            risk: 'Late filing penalty',
            severity: 'Medium',
            likelihood: 'Medium',
            mitigation: 'File well before deadline; set calendar reminders'
        }];
        const riskRows = riskItems.map(r => `
            <tr>
                <td>${this.safePlaceholder(r.risk)}</td>
                <td><span class="severity-badge ${(r.severity || 'medium').toLowerCase()}">${this.safePlaceholder(r.severity)}</span></td>
                <td>${this.safePlaceholder(r.likelihood)}</td>
                <td>${this.safePlaceholder(r.mitigation)}</td>
            </tr>
        `).join('');

        const recItems = recommendations && recommendations.length > 0 ? recommendations : ['Create compliance calendar with reminders'];
        const recList = recItems.map((r, i) => 
            `<li><strong>${i+1}.</strong> ${this.escapeHtml(r)}</li>`
        ).join('');

        const refItems = references && references.length > 0 ? references : ['Contact your state or federal agency for official filing portals'];
        const refs = refItems.map(r => 
            `<li>${this.escapeHtml(r)}</li>`
        ).join('');

        // Assemble final HTML
        const html = `
            ${headerBlock}

            <section class="compliance-section">
                <h2 class="section-title">Executive Compliance Summary</h2>
                <div class="section-content">${this.safePlaceholder(summary)}</div>
            </section>

            <section class="compliance-section">
                <h3 class="section-title">Filing Requirements Checklist</h3>
                <ul class="checklist">${checklistHTML}</ul>
            </section>

            <section class="compliance-section">
                <h3 class="section-title">Compliance Timeline</h3>
                <div class="table-container">
                    <table class="compliance-table grid">
                        <thead>
                            <tr><th>Milestone</th><th>Owner</th><th>Due Date</th><th>Notes</th></tr>
                        </thead>
                        <tbody>${timelineRows}</tbody>
                    </table>
                </div>
            </section>

            <section class="compliance-section">
                <h3 class="section-title">Risk Matrix</h3>
                <div class="table-container">
                    <table class="compliance-table grid">
                        <thead>
                            <tr><th>Risk</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th></tr>
                        </thead>
                        <tbody>${riskRows}</tbody>
                    </table>
                </div>
            </section>

            <section class="compliance-section">
                <h3 class="section-title">Strategic Recommendations</h3>
                <ol class="recs">${recList}</ol>
            </section>

            <section class="compliance-section">
                <h3 class="section-title">Official References</h3>
                <ul class="refs">${refs}</ul>
            </section>
        `;

        return html;
    }

    // ========================================================
    // FORM SUBMISSION
    // ========================================================
    bindFormSubmit() {
        const form = document.getElementById('toolkitForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleGenerate();
            });
        }
    }

    async handleGenerate() {
        try {
            // Show loading state
            this.setLoadingState(true);

            // Collect form data
            const payload = {
                entityName: document.getElementById('entityName')?.value.trim() || '',
                entityType: document.getElementById('entityType')?.value || '',
                jurisdiction: document.getElementById('jurisdiction')?.value.trim() || '',
                filingType: document.getElementById('filingType')?.value || '',
                deadline: document.getElementById('deadline')?.value || '',
                requirements: Array.from(document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked'))
                    .map(cb => cb.value),
                risks: document.getElementById('risks')?.value.trim() || '',
                mitigation: document.getElementById('mitigation')?.value.trim() || ''
            };

            // Call backend for structured JSON
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData: payload })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Generation failed');
            }

            const generated = await response.json();

            // Build ONE HTML using unified renderer
            const html = this.renderStructuredHTML(payload, generated);

            // Display in panel
            const resultsContainer = document.getElementById('resultsContainer');
            if (resultsContainer) {
                resultsContainer.innerHTML = html;
            }

            // Wrap tables for responsive scrolling
            this.wrapTablesForResponsive();

            // Compute checksum on exact HTML
            const cs = this.checksum(html);

            // Update checksum display
            const checksumEl = document.getElementById('results-checksum');
            if (checksumEl) {
                checksumEl.textContent = `checksum: ${cs}`;
            }

            // Store result (single source of truth)
            this.currentResult = {
                id: 'r_' + Date.now(),
                payload,
                structured: { html, text: this.stripHTML(html) },
                createdAt: new Date().toISOString(),
                checksum: cs
            };

            this.saveCurrentResult();

            // Hide "no results" message
            const noResults = document.getElementById('noResults');
            if (noResults) {
                noResults.style.display = 'none';
            }

            // Ensure header fits after render
            setTimeout(() => this.ensureHeaderFits(), 50);

            this.showSuccess('Compliance guide generated successfully!');

        } catch (error) {
            console.error('Generation error:', error);
            this.showError(error.message || 'Failed to generate compliance guide');
        } finally {
            this.setLoadingState(false);
        }
    }

    // ========================================================
    // STATE PERSISTENCE
    // ========================================================
    saveCurrentResult() {
        try {
            localStorage.setItem('currentResult', JSON.stringify(this.currentResult));
        } catch (e) {
            console.warn('Failed to save result to localStorage:', e);
        }
    }

    loadCurrentResult() {
        try {
            const raw = localStorage.getItem('currentResult');
            if (raw) {
                this.currentResult = JSON.parse(raw);
                if (this.currentResult?.structured?.html) {
                    const resultsContainer = document.getElementById('resultsContainer');
                    if (resultsContainer) {
                        resultsContainer.innerHTML = this.currentResult.structured.html;
                    }
                    
                    // Wrap tables for responsive scrolling
                    this.wrapTablesForResponsive();
                    
                    const checksumEl = document.getElementById('results-checksum');
                    if (checksumEl) {
                        checksumEl.textContent = `checksum: ${this.currentResult.checksum}`;
                    }
                    const noResults = document.getElementById('noResults');
                    if (noResults) {
                        noResults.style.display = 'none';
                    }
                    
                    // Ensure header fits after render
                    setTimeout(() => this.ensureHeaderFits(), 50);
                }
            }
        } catch (e) {
            console.warn('Failed to load result from localStorage:', e);
        }
    }

    // ========================================================
    // ACTIONS (Export, Copy, Clear, Save, Load)
    // ========================================================
    bindActions() {
        const exportBtn = document.getElementById('exportPdfBtn');
        const copyBtn = document.getElementById('copyAllBtn');
        const clearBtn = document.getElementById('clearBtn');
        const saveBtn = document.getElementById('saveReportBtn');
        const loadBtn = document.getElementById('loadReportBtn');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExport());
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.handleCopy());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClear());
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.showSaveModal());
        }
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.showLoadModal());
        }

        // Power Menu Actions
        const validateBtn = document.getElementById('validateInputs');
        const renameBtn = document.getElementById('renameReport');
        const duplicateBtn = document.getElementById('duplicateReport');
        const recalcBtn = document.getElementById('recalcChecksum');
        const docsBtn = document.getElementById('openDocs');

        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateInputs());
        }
        if (renameBtn) {
            renameBtn.addEventListener('click', () => this.renameReport());
        }
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => this.duplicateReport());
        }
        if (recalcBtn) {
            recalcBtn.addEventListener('click', () => this.recalculateChecksum());
        }
        if (docsBtn) {
            docsBtn.addEventListener('click', () => this.openDocumentation());
        }
    }

    bindDropdownMenus() {
        const menuBtns = document.querySelectorAll('.menu-btn');
        
        menuBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = btn.parentElement;
                const menuContent = dropdown.querySelector('.menu-content');
                
                // Close all other dropdowns
                document.querySelectorAll('.menu-content.show').forEach(menu => {
                    if (menu !== menuContent) {
                        menu.classList.remove('show');
                    }
                });
                
                // Toggle this dropdown
                menuContent.classList.toggle('show');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-dropdown')) {
                document.querySelectorAll('.menu-content.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });

        // Close dropdown when clicking menu item
        document.querySelectorAll('.menu-content button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.menu-content.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            });
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const cmd = isMac ? e.metaKey : e.ctrlKey;
            
            if (!cmd) return;
            
            switch (true) {
                case (cmd && e.key === 's' && !e.shiftKey):
                    e.preventDefault();
                    this.showSaveModal();
                    break;
                case (cmd && e.key === 'S' && e.shiftKey):
                    e.preventDefault();
                    this.showSaveAsModal();
                    break;
                case (cmd && e.key.toLowerCase() === 'o'):
                    e.preventDefault();
                    this.showLoadModal();
                    break;
                case (cmd && e.key.toLowerCase() === 'n'):
                    e.preventDefault();
                    this.handleClear();
                    break;
            }
        });
    }

    bindTitleInput() {
        const titleInput = document.getElementById('reportTitle');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                this.updateSaveStatus('Unsaved …');
            });
        }
    }

    startAutosave() {
        // Autosave stub - check every 60s for unsaved changes
        setInterval(() => {
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus && saveStatus.textContent === 'Unsaved …' && this.currentResult) {
                // Future: auto-save logic here
                console.log('Autosave stub: Would save here');
            }
        }, 60000);
    }

    updateSaveStatus(status) {
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
            saveStatus.textContent = status;
            saveStatus.classList.add('fade-in');
            setTimeout(() => {
                saveStatus.classList.remove('fade-in');
            }, 300);
        }
    }

    bindHeaderResize() {
        // Bind resize event
        window.addEventListener('resize', () => this.ensureHeaderFits());
        // Initial check
        setTimeout(() => this.ensureHeaderFits(), 100);
    }

    ensureHeaderFits() {
        const header = document.querySelector('.panel-header');
        const checksum = document.querySelector('.checksum');
        const actions = document.querySelector('.panel-actions');
        
        if (!header || !actions) return;

        // Helper to check if header is overflowing
        const isOverflowing = () => header.scrollWidth > header.clientWidth + 2;

        // If header is overflowing, hide checksum first (keeps actions visible)
        if (isOverflowing() && checksum) {
            checksum.style.display = 'none';
        }

        // If still overflowing, allow actions to take full row
        if (isOverflowing()) {
            actions.style.flexBasis = '100%';
            actions.style.justifyContent = 'flex-start';
        } else {
            actions.style.flexBasis = '';
            actions.style.justifyContent = '';
        }
    }

    wrapTablesForResponsive() {
        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;

        const tables = resultsContainer.querySelectorAll('table');
        tables.forEach(table => {
            // Skip if already wrapped
            if (table.parentElement && table.parentElement.classList.contains('table-wrap')) {
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrap';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    async handleExport() {
        if (!this.currentResult?.structured?.html) {
            this.showError('No results to export');
            return;
        }

        try {
            // Wrap HTML for PDF with header/footer and checksum
            const pdfHTML = this.wrapForPdf(this.currentResult.structured.html, this.currentResult);
            
            // Use existing pdf-export.js functionality
            if (window.exportAllResultsToPDF) {
                await window.exportAllResultsToPDF([{
                    html: pdfHTML,
                    fileName: this.buildFileName(this.currentResult)
                }], { mode: 'single' });
                this.showSuccess('PDF exported successfully!');
            } else {
                this.showError('PDF export not available');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export PDF');
        }
    }

    buildFileName(r) {
        const safe = (s) => String(s || '').replace(/[^a-z0-9-_]+/gi, '_');
        return `CompliPilot_${safe(r?.payload?.entityName)}_${safe(r?.payload?.filingType)}.pdf`;
    }

    wrapForPdf(innerHTML, r) {
        const stamp = new Date(r.createdAt).toLocaleString();
        return `
            <div class="pdf-wrapper">
                <div class="pdf-header">
                    <div class="brand">CompliPilot</div>
                    <div class="tiny">Generated: ${stamp} • checksum: ${r.checksum}</div>
                </div>
                ${innerHTML}
                <div class="footer">
                    Powered by YourBizGuru.com • For informational purposes only. Not legal, tax, or financial advice.
                </div>
            </div>
        `;
    }

    handleCopy() {
        if (!this.currentResult?.structured?.text) {
            this.showError('No results to copy');
            return;
        }
        
        navigator.clipboard.writeText(this.currentResult.structured.text)
            .then(() => this.showSuccess('Results copied to clipboard!'))
            .catch(() => this.showError('Failed to copy results'));
    }

    handleClear() {
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
        
        const checksumEl = document.getElementById('results-checksum');
        if (checksumEl) {
            checksumEl.textContent = '';
        }
        
        const titleInput = document.getElementById('reportTitle');
        if (titleInput) {
            titleInput.value = '';
            titleInput.placeholder = 'Untitled Report';
        }
        
        this.updateSaveStatus('Saved');

        const noResults = document.getElementById('noResults');
        if (noResults) {
            noResults.style.display = 'block';
        }

        this.currentResult = null;
        localStorage.removeItem('currentResult');
        
        this.showSuccess('History cleared');
    }

    // ========================================================
    // UI HELPERS
    // ========================================================
    stripHTML(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    setLoadingState(loading) {
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const loadingText = document.getElementById('loadingText');
        const formInputs = document.querySelectorAll('#toolkitForm input, #toolkitForm select, #toolkitForm textarea');

        if (loading) {
            if (submitBtn) submitBtn.disabled = true;
            if (submitText) submitText.classList.add('hidden');
            if (loadingText) loadingText.classList.remove('hidden');
            formInputs.forEach(input => input.disabled = true);
        } else {
            if (submitBtn) submitBtn.disabled = false;
            if (submitText) submitText.classList.remove('hidden');
            if (loadingText) loadingText.classList.add('hidden');
            formInputs.forEach(input => input.disabled = false);
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#4DB6E7' : type === 'error' ? '#F44336' : '#FFC107'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ========================================================
    // SAVE/LOAD FUNCTIONALITY
    // ========================================================
    showSaveModal() {
        if (!this.currentResult) {
            this.showError('No report to save. Generate a report first.');
            return;
        }

        const modal = document.getElementById('saveModal');
        const reportNameInput = document.getElementById('reportName');
        const confirmBtn = document.getElementById('confirmSaveBtn');
        const cancelBtn = document.getElementById('cancelSaveBtn');
        const closeBtn = document.getElementById('saveModalClose');

        if (!modal) return;

        const suggestedName = this.generateReportName();
        if (reportNameInput) {
            reportNameInput.value = suggestedName;
        }

        modal.style.display = 'block';
        if (reportNameInput) {
            reportNameInput.focus();
            reportNameInput.select();
        }

        const handleSave = async () => {
            const name = reportNameInput?.value.trim();
            if (!name) {
                this.showError('Please enter a report name');
                return;
            }
            await this.saveReportToDatabase(name);
            modal.style.display = 'none';
        };

        const handleCancel = () => {
            modal.style.display = 'none';
        };

        confirmBtn?.addEventListener('click', handleSave, { once: true });
        cancelBtn?.addEventListener('click', handleCancel, { once: true });
        closeBtn?.addEventListener('click', handleCancel, { once: true });

        reportNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        }, { once: true });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        }, { once: true });
    }

    generateReportName() {
        if (!this.currentResult?.payload) return 'Compliance Report';
        
        const { entityName, filingType, deadline } = this.currentResult.payload;
        const parts = [];
        
        if (filingType) parts.push(filingType);
        if (entityName) parts.push(entityName);
        if (deadline) {
            const date = new Date(deadline);
            parts.push(date.toLocaleDateString());
        }
        
        return parts.join(' - ') || 'Compliance Report';
    }

    async saveReportToDatabase(name) {
        try {
            if (!this.currentResult) {
                throw new Error('No report to save');
            }

            const payload = {
                name: name,
                entityName: this.currentResult.payload?.entityName || '',
                entityType: this.currentResult.payload?.entityType || '',
                jurisdiction: this.currentResult.payload?.jurisdiction || '',
                filingType: this.currentResult.payload?.filingType || '',
                deadline: this.currentResult.payload?.deadline || '',
                htmlContent: this.currentResult.structured?.html || '',
                checksum: this.currentResult.checksum || '',
                metadata: JSON.stringify(this.currentResult.payload || {}),
                toolkitCode: 'complipilot'
            };

            const response = await fetch('/api/reports/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Owner-Id': this.ownerId
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save report');
            }

            const result = await response.json();
            this.showSuccess(`Report "${name}" saved successfully!`);
            
            // Update title input and save status
            const titleInput = document.getElementById('reportTitle');
            if (titleInput) {
                titleInput.value = name;
            }
            this.updateSaveStatus('Saved ✓');
            
            return result;

        } catch (error) {
            console.error('Save error:', error);
            this.showError(error.message || 'Failed to save report');
            throw error;
        }
    }

    async showLoadModal() {
        const modal = document.getElementById('loadModal');
        const listContainer = document.getElementById('savedReportsList');
        const closeBtn = document.getElementById('loadModalClose');

        if (!modal || !listContainer) return;

        modal.style.display = 'block';
        listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: rgb(var(--text-muted));">Loading saved reports...</div>';

        closeBtn?.addEventListener('click', () => {
            modal.style.display = 'none';
        }, { once: true });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        }, { once: true });

        try {
            const response = await fetch('/api/reports/list?toolkit=complipilot', {
                headers: {
                    'X-Owner-Id': this.ownerId
                }
            });
            if (!response.ok) {
                throw new Error('Failed to load reports');
            }

            const reports = await response.json();

            if (!reports || reports.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: rgb(var(--text-muted));" data-testid="text-no-reports">
                        <p style="font-size: 18px; margin-bottom: 8px;">No saved reports yet</p>
                        <p style="font-size: 14px;">Generate and save a report to see it here</p>
                    </div>
                `;
                return;
            }

            const reportsHTML = reports.map(report => {
                const createdDate = new Date(report.createdAt).toLocaleDateString();
                const createdTime = new Date(report.createdAt).toLocaleTimeString();
                
                return `
                    <div class="saved-report-item" data-report-id="${report.id}" data-testid="item-saved-report-${report.id}" 
                         style="border: 1px solid rgb(var(--border)); border-radius: 8px; padding: 16px; margin-bottom: 12px; background: rgb(var(--card));">
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
                            <div style="flex: 1;">
                                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: rgb(var(--text));" data-testid="text-report-name-${report.id}">
                                    ${this.escapeHtml(report.name)}
                                </h3>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 13px; color: rgb(var(--text-secondary));">
                                    <div data-testid="text-report-entity-${report.id}">
                                        <strong>Entity:</strong> ${this.escapeHtml(report.entityName || 'N/A')}
                                    </div>
                                    <div data-testid="text-report-jurisdiction-${report.id}">
                                        <strong>Jurisdiction:</strong> ${this.escapeHtml(report.jurisdiction || 'N/A')}
                                    </div>
                                    <div data-testid="text-report-filing-${report.id}">
                                        <strong>Filing Type:</strong> ${this.escapeHtml(report.filingType || 'N/A')}
                                    </div>
                                    <div data-testid="text-report-date-${report.id}">
                                        <strong>Created:</strong> ${createdDate} ${createdTime}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                <button 
                                    class="action-btn load-report-btn" 
                                    data-report-id="${report.id}"
                                    data-testid="button-load-report-${report.id}"
                                    title="Load this report"
                                >
                                    Load
                                </button>
                                <button 
                                    class="clear-btn delete-report-btn" 
                                    data-report-id="${report.id}"
                                    data-testid="button-delete-report-${report.id}"
                                    title="Delete this report"
                                    style="padding: 8px 16px;"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            listContainer.innerHTML = reportsHTML;

            listContainer.querySelectorAll('.load-report-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const reportId = e.target.getAttribute('data-report-id');
                    await this.loadReportFromDatabase(reportId);
                    modal.style.display = 'none';
                });
            });

            listContainer.querySelectorAll('.delete-report-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const reportId = e.target.getAttribute('data-report-id');
                    if (confirm('Are you sure you want to delete this report?')) {
                        await this.deleteReport(reportId);
                        await this.showLoadModal();
                    }
                });
            });

        } catch (error) {
            console.error('Load modal error:', error);
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgb(var(--error));" data-testid="text-load-error">
                    <p style="font-size: 16px; margin-bottom: 8px;">Failed to load reports</p>
                    <p style="font-size: 14px;">${this.escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }

    async loadReportFromDatabase(id) {
        try {
            const response = await fetch(`/api/reports/${id}`, {
                headers: {
                    'X-Owner-Id': this.ownerId
                }
            });
            if (!response.ok) {
                throw new Error('Failed to load report');
            }

            const report = await response.json();

            const resultsContainer = document.getElementById('resultsContainer');
            if (resultsContainer && report.htmlContent) {
                resultsContainer.innerHTML = report.htmlContent;
            }

            // Wrap tables for responsive scrolling
            this.wrapTablesForResponsive();

            const checksumEl = document.getElementById('results-checksum');
            if (checksumEl && report.checksum) {
                checksumEl.textContent = `checksum: ${report.checksum}`;
            }

            const noResults = document.getElementById('noResults');
            if (noResults) {
                noResults.style.display = 'none';
            }

            // Ensure header fits after render
            setTimeout(() => this.ensureHeaderFits(), 50);

            let metadata = {};
            try {
                metadata = JSON.parse(report.metadata || '{}');
            } catch (e) {
                console.warn('Failed to parse metadata:', e);
            }

            this.currentResult = {
                id: report.id,
                name: report.name,
                payload: metadata,
                structured: { 
                    html: report.htmlContent,
                    text: this.stripHTML(report.htmlContent)
                },
                createdAt: report.createdAt,
                checksum: report.checksum
            };

            this.saveCurrentResult();
            
            // Update title input and save status
            const titleInput = document.getElementById('reportTitle');
            if (titleInput) {
                titleInput.value = report.name || 'Untitled Report';
            }
            this.updateSaveStatus('Saved ✓');
            
            this.showSuccess(`Report "${report.name}" loaded successfully!`);

        } catch (error) {
            console.error('Load error:', error);
            this.showError(error.message || 'Failed to load report');
        }
    }

    async deleteReport(id) {
        try {
            const response = await fetch(`/api/reports/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-Owner-Id': this.ownerId
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete report');
            }

            this.showSuccess('Report deleted successfully');

        } catch (error) {
            console.error('Delete error:', error);
            this.showError(error.message || 'Failed to delete report');
        }
    }

    // ========================================================
    // POWER MENU ACTIONS
    // ========================================================
    validateInputs() {
        const requiredFields = [
            { id: 'entityType', label: 'Business Entity Type' },
            { id: 'filingType', label: 'Filing Type' },
            { id: 'deadline', label: 'Filing Deadline' }
        ];

        let hasErrors = false;
        requiredFields.forEach(field => {
            const input = document.getElementById(field.id);
            if (!input || !input.value.trim()) {
                if (input) {
                    input.style.border = '2px solid var(--primary)';
                    setTimeout(() => {
                        input.style.border = '';
                    }, 2000);
                }
                hasErrors = true;
            }
        });

        if (hasErrors) {
            this.showError('Some required fields are empty. They have been highlighted.');
        } else {
            this.showSuccess('Validation complete. All required fields are filled.');
        }
    }

    showSaveAsModal() {
        if (!this.currentResult) {
            this.showError('No report to save. Generate a report first.');
            return;
        }
        this.showSaveModal();
    }

    renameReport() {
        if (!this.currentResult || !this.currentResult.id) {
            this.showError('No saved report to rename. Please save the report first.');
            return;
        }

        const newName = prompt('Enter new report name:', this.currentResult.name || 'Compliance Report');
        if (!newName || !newName.trim()) {
            return;
        }

        this.showError('Rename functionality coming soon. Use Save As for now.');
    }

    async duplicateReport() {
        if (!this.currentResult) {
            this.showError('No report to duplicate. Generate a report first.');
            return;
        }

        const originalName = this.currentResult.name || this.generateReportName();
        const duplicateName = originalName + ' (copy)';
        
        try {
            await this.saveReportToDatabase(duplicateName);
        } catch (error) {
            console.error('Duplicate error:', error);
        }
    }

    recalculateChecksum() {
        if (!this.currentResult?.structured?.html) {
            this.showError('No report content to calculate checksum.');
            return;
        }

        const payload = JSON.stringify(this.currentResult.payload || {});
        const html = this.currentResult.structured.html;
        const combined = payload + html;
        const newChecksum = this.checksum(combined);

        this.currentResult.checksum = newChecksum;
        this.saveCurrentResult();

        const checksumEl = document.getElementById('results-checksum');
        if (checksumEl) {
            checksumEl.textContent = `checksum: ${newChecksum}`;
        }

        this.showSuccess(`Checksum recalculated: ${newChecksum}`);
    }

    openDocumentation() {
        window.open('https://yourbizguru.com/complipilot/help', '_blank');
        this.showSuccess('Opening documentation in new tab...');
    }
}

// =====================================================
// INITIALIZE ON PAGE LOAD
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    window.complianceToolkit = new ComplianceToolkit();
});
