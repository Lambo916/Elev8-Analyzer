/**
 * Elev8 Analyzer - Business Diagnostic System
 * Handles form submission, API calls, results rendering, and PDF export
 */

// =====================================================
// THEME MANAGER (reusing existing functionality)
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
        
        if (theme === this.THEME_DARK) {
            htmlElement.classList.remove(this.THEME_LIGHT);
            htmlElement.classList.add(this.THEME_DARK);
            if (themeIcon) themeIcon.textContent = '🌙';
        } else {
            htmlElement.classList.remove(this.THEME_DARK);
            htmlElement.classList.add(this.THEME_LIGHT);
            if (themeIcon) themeIcon.textContent = '☀️';
        }
        
        if (persist) {
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
    }
    
    bindToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.classList.contains(this.THEME_DARK)
                    ? this.THEME_DARK
                    : this.THEME_LIGHT;
                const newTheme = currentTheme === this.THEME_DARK ? this.THEME_LIGHT : this.THEME_DARK;
                this.setTheme(newTheme);
            });
        }
    }
}

// =====================================================
// USAGE TRACKING SYSTEM
// =====================================================
class UsageTracker {
    constructor() {
        this.TOOL = 'elev8analyzer';
    }

    async checkUsageLimit() {
        try {
            const response = await fetch('/api/usage/check?tool=' + this.TOOL);
            const data = await response.json();
            
            console.log('[Usage] Check result:', data);
            
            return {
                allowed: data.allowed,
                count: data.count || 0,
                limit: data.limit || 30
            };
        } catch (error) {
            console.error('[Usage] Check error:', error);
            return { allowed: true, count: 0, limit: 30 };
        }
    }

    async incrementUsage() {
        try {
            const response = await fetch('/api/usage/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool: this.TOOL })
            });
            const data = await response.json();
            
            console.log('[Usage] Increment result:', data);
            
            return data;
        } catch (error) {
            console.error('[Usage] Increment error:', error);
        }
    }

    showLimitReachedAlert(count, limit) {
        const message = `You've reached your ${limit}-report limit for the Elev8 Analyzer soft launch.`;
        const upgradeUrl = 'https://analyzer.yourbizguru.com/upgrade';
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 32px;
                max-width: 500px;
                text-align: center;
            ">
                <h2 style="color: var(--text-primary); margin-bottom: 16px;">Report Limit Reached</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">${message}</p>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Please upgrade or purchase additional access to continue generating business analysis reports.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <a href="${upgradeUrl}" target="_blank" style="
                        background: var(--ybg-brand-primary);
                        color: white;
                        padding: 12px 24px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: 600;
                    ">Upgrade Now ($97)</a>
                    <button id="closeLimit" style="
                        background: transparent;
                        border: 1px solid var(--border-color);
                        color: var(--text-primary);
                        padding: 12px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('closeLimit').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
}

// =====================================================
// ELEV8 INDEX CALCULATOR
// =====================================================
class Elev8Calculator {
    static calculateOverallIndex(pillars) {
        // Weighted scoring: Financials ×1.5, Operations ×1.2, Sales & Marketing ×1.2
        const weights = {
            'Formation & Compliance': 1.0,
            'Business Credit Readiness': 1.0,
            'Financials & Cash Flow': 1.5,
            'Operations & Systems': 1.2,
            'Sales & Marketing': 1.2,
            'Brand & Web Presence': 1.0,
            'Risk & Legal Posture': 1.0,
            'Growth Strategy & Execution': 1.0
        };

        let totalScore = 0;
        let totalWeight = 0;

        pillars.forEach(pillar => {
            const weight = weights[pillar.name] || 1.0;
            totalScore += pillar.score * weight;
            totalWeight += weight;
        });

        return Math.round(totalScore / totalWeight);
    }

    static getStatusBand(score) {
        if (score >= 85) return { label: 'Elite', color: '#10B981', class: 'elite' };
        if (score >= 75) return { label: 'Strong', color: '#22C55E', class: 'strong' };
        if (score >= 60) return { label: 'Stable', color: '#EAB308', class: 'stable' };
        if (score >= 40) return { label: 'At Risk', color: '#F97316', class: 'at-risk' };
        return { label: 'Critical', color: '#EF4444', class: 'critical' };
    }

    static getPillarStatus(score) {
        if (score >= 71) return { color: '#10B981', class: 'green', label: 'Strong' };
        if (score >= 41) return { color: '#EAB308', class: 'yellow', label: 'Moderate' };
        return { color: '#EF4444', class: 'red', label: 'Critical' };
    }
}

// =====================================================
// ELEV8 ANALYZER APP
// =====================================================
class Elev8AnalyzerApp {
    constructor() {
        this.usageTracker = new UsageTracker();
        this.currentAnalysis = null;
        this.analysisHistory = [];
        
        this.init();
    }

    init() {
        this.bindFormEvents();
        this.bindActionButtons();
        this.loadFromLocalStorage();
    }

    bindFormEvents() {
        const form = document.getElementById('toolkitForm');
        const clearBtn = document.getElementById('clearBtn');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleGenerate();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                form.reset();
                this.clearErrors();
            });
        }
    }

    bindActionButtons() {
        const exportPdfBtn = document.getElementById('exportPdfBtn');
        const copyAllBtn = document.getElementById('copyAllBtn');
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportToPDF());
        }

        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', () => this.copyAllResults());
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearResults());
        }
    }

    async handleGenerate() {
        try {
            // Check usage limit before generating
            const usageCheck = await this.usageTracker.checkUsageLimit();
            if (!usageCheck.allowed) {
                this.usageTracker.showLimitReachedAlert(usageCheck.count, usageCheck.limit);
                return;
            }

            this.setLoadingState(true);
            this.clearErrors();

            // Collect form data
            const formData = this.collectFormData();
            
            // Validate required fields
            if (!this.validateForm(formData)) {
                this.setLoadingState(false);
                return;
            }

            // Call API
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tool: 'elev8analyzer',
                    formData: formData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.limitReached) {
                    this.usageTracker.showLimitReachedAlert(data.count, data.limit);
                    return;
                }
                throw new Error(data.error || 'Failed to generate analysis');
            }

            // Store and render results
            this.currentAnalysis = {
                ...data,
                businessName: formData.businessName,
                timestamp: new Date().toISOString()
            };
            
            this.analysisHistory.unshift(this.currentAnalysis);
            this.saveToLocalStorage();
            this.renderResults();

            // Increment usage after successful generation
            await this.usageTracker.incrementUsage();

        } catch (error) {
            console.error('Generation error:', error);
            
            if (error.message && error.message.includes('30-report limit')) {
                const usageCheck = await this.usageTracker.checkUsageLimit();
                this.usageTracker.showLimitReachedAlert(usageCheck.count, usageCheck.limit);
                return;
            }
            
            this.showError(error.message || 'Failed to generate analysis');
        } finally {
            this.setLoadingState(false);
        }
    }

    collectFormData() {
        return {
            businessName: document.getElementById('businessName')?.value || '',
            industry: document.getElementById('industry')?.value || '',
            revenueRange: document.getElementById('revenueRange')?.value || '',
            creditProfile: document.getElementById('creditProfile')?.value || '',
            employees: document.getElementById('employees')?.value || '',
            challenges: document.getElementById('challenges')?.value || '',
            goals: document.getElementById('goals')?.value || ''
        };
    }

    validateForm(formData) {
        let isValid = true;

        if (!formData.businessName.trim()) {
            this.showFieldError('businessName', 'Business name is required');
            isValid = false;
        }

        if (!formData.industry) {
            this.showFieldError('industry', 'Industry is required');
            isValid = false;
        }

        if (!formData.revenueRange) {
            this.showFieldError('revenueRange', 'Revenue range is required');
            isValid = false;
        }

        if (!formData.employees) {
            this.showFieldError('employees', 'Number of employees is required');
            isValid = false;
        }

        return isValid;
    }

    showFieldError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}Error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    showError(message) {
        alert(message);
    }

    setLoadingState(isLoading) {
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const loadingText = document.getElementById('loadingText');

        if (submitBtn) {
            submitBtn.disabled = isLoading;
        }

        if (submitText && loadingText) {
            if (isLoading) {
                submitText.classList.add('hidden');
                loadingText.classList.remove('hidden');
            } else {
                submitText.classList.remove('hidden');
                loadingText.classList.add('hidden');
            }
        }
    }

    renderResults() {
        const container = document.getElementById('resultsContainer');
        const noResults = document.getElementById('noResults');

        if (!this.currentAnalysis) {
            if (noResults) noResults.style.display = 'block';
            return;
        }

        if (noResults) noResults.style.display = 'none';

        const analysis = this.currentAnalysis;
        const overallIndex = analysis.overall?.score || Elev8Calculator.calculateOverallIndex(analysis.pillars || []);
        const statusBand = Elev8Calculator.getStatusBand(overallIndex);

        // Create results HTML
        container.innerHTML = `
            <!-- Overall Elev8 Index -->
            <div class="elev8-index-card" data-testid="card-overall-index">
                <div class="elev8-index-score" style="color: ${statusBand.color}">
                    <div class="elev8-index-number">${overallIndex}</div>
                    <div class="elev8-index-label">Overall Elev8 Index</div>
                </div>
                <div class="elev8-index-band ${statusBand.class}" style="background-color: ${statusBand.color}20; border-color: ${statusBand.color}">
                    ${statusBand.label}
                </div>
                <div class="elev8-index-summary">
                    ${analysis.overall?.summary || 'Comprehensive business health analysis across 8 critical pillars.'}
                </div>
            </div>

            <!-- 8 Pillar Cards -->
            <div class="pillars-section">
                <h3 class="section-title">8 Pillars of Business Health</h3>
                <div class="pillars-grid">
                    ${this.renderPillarCards(analysis.pillars || [])}
                </div>
            </div>

            <!-- Top Strengths & Priority Gaps -->
            <div class="insights-section">
                ${this.renderTopStrengths(analysis.pillars || [])}
                ${this.renderPriorityGaps(analysis.pillars || [])}
            </div>

            <!-- 30/60/90 Day Roadmap -->
            <div class="roadmap-section">
                <h3 class="section-title">30/60/90-Day Action Roadmap</h3>
                ${this.renderRoadmap(analysis.roadmap || {})}
            </div>
        `;
    }

    renderPillarCards(pillars) {
        return pillars.map((pillar, index) => {
            const status = Elev8Calculator.getPillarStatus(pillar.score);
            return `
                <div class="pillar-card" data-testid="card-pillar-${index}">
                    <div class="pillar-header">
                        <h4 class="pillar-name">${pillar.name}</h4>
                        <div class="pillar-score-badge ${status.class}" style="background-color: ${status.color}20; border-color: ${status.color}; color: ${status.color}">
                            ${pillar.score}
                        </div>
                    </div>
                    <div class="pillar-status-badge ${status.class}" style="background-color: ${status.color}20; color: ${status.color}">
                        ${status.label}
                    </div>
                    <div class="pillar-insights">
                        <strong>Key Insights:</strong>
                        <ul>
                            ${(pillar.insights || []).map(insight => `<li>${insight}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="pillar-actions">
                        <strong>Priority Actions:</strong>
                        <ol>
                            ${(pillar.actions || []).map(action => `<li>${action}</li>`).join('')}
                        </ol>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTopStrengths(pillars) {
        const sorted = [...pillars].sort((a, b) => b.score - a.score);
        const topTwo = sorted.slice(0, 2);

        return `
            <div class="insights-card strengths-card">
                <h4 class="insights-title">
                    <svg class="insights-icon success-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Top Strengths
                </h4>
                <ul class="insights-list">
                    ${topTwo.map(p => `
                        <li class="strength-item">
                            <svg class="list-icon success-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            <strong>${p.name}</strong> (Score: ${p.score})
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    renderPriorityGaps(pillars) {
        const sorted = [...pillars].sort((a, b) => a.score - b.score);
        const bottomThree = sorted.slice(0, 3);

        return `
            <div class="insights-card gaps-card">
                <h4 class="insights-title">
                    <svg class="insights-icon warning-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    Priority Gaps
                </h4>
                <ul class="insights-list">
                    ${bottomThree.map(p => `
                        <li class="gap-item">
                            <svg class="list-icon warning-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <strong>${p.name}</strong> (Score: ${p.score})
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    renderRoadmap(roadmap) {
        return `
            <div class="roadmap-grid">
                <div class="roadmap-phase">
                    <h4 class="roadmap-phase-title">30 Days (Quick Wins)</h4>
                    <ul class="roadmap-actions">
                        ${(roadmap.d30 || []).map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
                <div class="roadmap-phase">
                    <h4 class="roadmap-phase-title">60 Days (Process Improvements)</h4>
                    <ul class="roadmap-actions">
                        ${(roadmap.d60 || []).map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
                <div class="roadmap-phase">
                    <h4 class="roadmap-phase-title">90 Days (Strategic Initiatives)</h4>
                    <ul class="roadmap-actions">
                        ${(roadmap.d90 || []).map(action => `<li>${action}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    exportToPDF() {
        if (!this.currentAnalysis) {
            alert('No analysis to export. Generate an analysis first.');
            return;
        }

        // Call the PDF export function (defined in pdf-export.js)
        if (typeof window.exportElev8AnalysisToPDF === 'function') {
            window.exportElev8AnalysisToPDF(this.currentAnalysis);
        } else {
            alert('PDF export functionality not available.');
        }
    }

    copyAllResults() {
        if (!this.currentAnalysis) {
            alert('No results to copy.');
            return;
        }

        const text = this.formatResultsAsText();
        navigator.clipboard.writeText(text).then(() => {
            alert('Results copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            alert('Failed to copy results.');
        });
    }

    formatResultsAsText() {
        const a = this.currentAnalysis;
        const overallIndex = a.overall?.score || Elev8Calculator.calculateOverallIndex(a.pillars || []);
        
        let text = `ELEV8 ANALYZER REPORT\n`;
        text += `Business: ${a.businessName}\n`;
        text += `Generated: ${new Date(a.timestamp).toLocaleDateString()}\n\n`;
        text += `OVERALL ELEV8 INDEX: ${overallIndex}/100\n`;
        text += `${a.overall?.summary || ''}\n\n`;
        
        text += `8 PILLARS OF BUSINESS HEALTH:\n\n`;
        (a.pillars || []).forEach(p => {
            text += `${p.name}: ${p.score}/100\n`;
            text += `Insights:\n${(p.insights || []).map(i => `- ${i}`).join('\n')}\n`;
            text += `Actions:\n${(p.actions || []).map((ac, i) => `${i+1}. ${ac}`).join('\n')}\n\n`;
        });

        text += `30/60/90-DAY ROADMAP:\n\n`;
        text += `30 Days:\n${(a.roadmap?.d30 || []).map((ac, i) => `${i+1}. ${ac}`).join('\n')}\n\n`;
        text += `60 Days:\n${(a.roadmap?.d60 || []).map((ac, i) => `${i+1}. ${ac}`).join('\n')}\n\n`;
        text += `90 Days:\n${(a.roadmap?.d90 || []).map((ac, i) => `${i+1}. ${ac}`).join('\n')}\n\n`;

        return text;
    }

    clearResults() {
        if (confirm('Clear all analysis results?')) {
            this.currentAnalysis = null;
            this.analysisHistory = [];
            localStorage.removeItem('elev8-analysis');
            
            const container = document.getElementById('resultsContainer');
            const noResults = document.getElementById('noResults');
            
            if (container) container.innerHTML = '';
            if (noResults) {
                noResults.style.display = 'block';
                container.appendChild(noResults);
            }
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('elev8-analysis', JSON.stringify({
                current: this.currentAnalysis,
                history: this.analysisHistory.slice(0, 5)
            }));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('elev8-analysis');
            if (saved) {
                const data = JSON.parse(saved);
                this.currentAnalysis = data.current;
                this.analysisHistory = data.history || [];
                
                if (this.currentAnalysis) {
                    this.renderResults();
                }
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
    }
}

// =====================================================
// INITIALIZE APP
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme manager
    new ThemeManager();
    
    // Initialize Elev8 Analyzer app
    window.elev8App = new Elev8AnalyzerApp();
    
    console.log('[Elev8 Analyzer] Application initialized');
});
