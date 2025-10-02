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
        this.init();
    }

    init() {
        this.bindFormSubmit();
        this.bindActions();
        this.loadCurrentResult();
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
                    const checksumEl = document.getElementById('results-checksum');
                    if (checksumEl) {
                        checksumEl.textContent = `checksum: ${this.currentResult.checksum}`;
                    }
                    const noResults = document.getElementById('noResults');
                    if (noResults) {
                        noResults.style.display = 'none';
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load result from localStorage:', e);
        }
    }

    // ========================================================
    // ACTIONS (Export, Copy, Clear)
    // ========================================================
    bindActions() {
        const exportBtn = document.getElementById('exportPdfBtn');
        const copyBtn = document.getElementById('copyAllBtn');
        const clearBtn = document.getElementById('clearBtn');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExport());
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.handleCopy());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClear());
        }
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
}

// =====================================================
// INITIALIZE ON PAGE LOAD
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    window.complianceToolkit = new ComplianceToolkit();
});
