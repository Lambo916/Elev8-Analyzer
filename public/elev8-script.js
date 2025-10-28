/**
 * Elev8 Analyzer - Business Diagnostic System
 * Handles form submission, API calls, results rendering, and PDF export
 */

// =====================================================
// CHART.JS OPTIMIZATION UTILITIES
// =====================================================

/**
 * Set up Chart.js defaults for optimal performance and appearance
 */
function setupChartDefaultsForAnalyzer() {
    if (!window.Chart) return;
    
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = { duration: 300 };
    Chart.defaults.elements.line.tension = 0.2;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    
    console.log('[Elev8 Charts] Defaults configured for optimal performance');
}

/**
 * Force render all pending lazy-loaded charts
 * Call this before export/print to ensure all charts exist
 */
function forceRenderAllCharts() {
    console.log('[Elev8 Charts] Force rendering all pending charts');
    
    // Check if app instance exists
    if (!window.elev8App || !window.elev8App.analysisData) {
        console.warn('[Elev8 Charts] Cannot force render charts - app instance or analysis data not available');
        return;
    }
    
    // Find all chart-wrap containers that haven't been initialized yet
    const pendingCharts = document.querySelectorAll('.chart-wrap:not([data-inited])');
    if (pendingCharts.length === 0) {
        console.log('[Elev8 Charts] All charts already rendered');
        return;
    }
    
    pendingCharts.forEach(wrap => {
        const chartType = wrap.dataset.chart;
        window.elev8App.initChartByType(chartType, window.elev8App.analysisData);
        wrap.dataset.inited = '1';
        console.log(`[Elev8 Charts] Force-rendered ${chartType} chart`);
    });
}

/**
 * Freeze charts before PDF export or print (disable animations, force redraw)
 */
function freezeChartsForExport() {
    if (!window.Chart) return;
    
    Chart.defaults.animation = false;
    const canvases = document.querySelectorAll('canvas.chartjs, .chart-card canvas');
    canvases.forEach(c => {
        const chart = Chart.getChart(c);
        if (chart) {
            chart.resize();
            chart.update(0);
        }
    });
    
    console.log('[Elev8 Charts] Charts frozen for export');
}

/**
 * Restore chart animations after export
 */
function restoreChartAnimations() {
    if (!window.Chart) return;
    
    Chart.defaults.animation = { duration: 300 };
    console.log('[Elev8 Charts] Animations restored');
}

/**
 * Prepare charts for high-DPI printing
 */
function prepareChartsForPrint() {
    // Force render all charts first (in case user hasn't scrolled to them)
    forceRenderAllCharts();
    
    // Then freeze animations
    freezeChartsForExport();
    
    // Force high-DPI redraw for crisp PDF
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    document.querySelectorAll('canvas.chartjs, .chart-card canvas').forEach(c => {
        const chart = Chart.getChart(c);
        if (chart) {
            const { width, height } = c.getBoundingClientRect();
            c.width = Math.round(width * ratio);
            c.height = Math.round(height * ratio);
            chart.resize();
            chart.update(0);
        }
    });
    
    console.log('[Elev8 Charts] Prepared for high-DPI print at ' + ratio + 'x');
}

// Initialize Chart.js when the library loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupChartDefaultsForAnalyzer);
} else {
    setupChartDefaultsForAnalyzer();
}

// Add print event handlers
window.addEventListener('beforeprint', prepareChartsForPrint);
window.addEventListener('afterprint', restoreChartAnimations);

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
        
        let initialTheme;
        if (storedTheme) {
            initialTheme = storedTheme;
        } else {
            // Default to dark theme for all new visitors
            initialTheme = this.THEME_DARK;
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
                    
                    <!-- Horizontal Progress Bar -->
                    <div class="elev8-progress-container">
                        <div class="elev8-progress-track">
                            <div class="elev8-progress-fill" style="width: ${overallIndex}%" data-score="${overallIndex}"></div>
                        </div>
                        <div class="elev8-progress-labels">
                            <span class="progress-label-left">0</span>
                            <span class="progress-label-center">50</span>
                            <span class="progress-label-right">100</span>
                        </div>
                    </div>
                </div>
                <div class="elev8-index-band ${statusBand.class}" style="background-color: ${statusBand.color}20; border-color: ${statusBand.color}">
                    ${statusBand.label}
                </div>
                <div class="elev8-index-summary">
                    ${analysis.overall?.summary || 'Comprehensive business health analysis across 8 critical pillars.'}
                </div>
            </div>

            <!-- Charts Dashboard -->
            <div class="charts-dashboard">
                <h3 class="section-title">Business Metrics Visualization</h3>
                <div class="charts-grid">
                    <!-- Radar Chart for 8 Pillars -->
                    <div class="chart-card chart-wrap" data-chart="radar">
                        <h4 class="chart-title">Pillar Performance Radar</h4>
                        <canvas id="pillarRadarChart" class="chartjs"></canvas>
                    </div>
                    
                    <!-- Bar Chart for Pillar Scores -->
                    <div class="chart-card chart-wrap" data-chart="bar">
                        <h4 class="chart-title">Pillar Score Comparison</h4>
                        <canvas id="pillarBarChart" class="chartjs"></canvas>
                    </div>
                    
                    <!-- Progress Gauge for Overall Index -->
                    <div class="chart-card chart-wrap" data-chart="gauge">
                        <h4 class="chart-title">Business Health Gauge</h4>
                        <canvas id="healthGaugeChart" class="chartjs"></canvas>
                    </div>
                    
                    <!-- Roadmap Timeline Chart -->
                    <div class="chart-card chart-wrap" data-chart="timeline">
                        <h4 class="chart-title">Action Roadmap Timeline</h4>
                        <canvas id="roadmapTimelineChart" class="chartjs"></canvas>
                    </div>
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

        // Initialize charts with lazy loading after DOM is updated
        setTimeout(() => {
            this.setupLazyChartLoading(analysis);
        }, 100);
    }

    setupLazyChartLoading(analysis) {
        // Store analysis data for lazy init
        this.analysisData = analysis;
        
        // Set up IntersectionObserver for lazy chart initialization
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const chartWrap = entry.target;
                    const chartType = chartWrap.dataset.chart;
                    
                    if (!chartWrap.dataset.inited) {
                        this.initChartByType(chartType, analysis);
                        chartWrap.dataset.inited = '1';
                    }
                    
                    observer.unobserve(chartWrap);
                }
            });
        }, { rootMargin: '200px' });
        
        // Observe all chart containers
        document.querySelectorAll('.chart-wrap').forEach(wrap => observer.observe(wrap));
        
        console.log('[Elev8 Charts] Lazy loading initialized');
    }

    initChartByType(chartType, analysis) {
        switch(chartType) {
            case 'radar':
                this.createRadarChart(analysis.pillars || []);
                break;
            case 'bar':
                this.createBarChart(analysis.pillars || []);
                break;
            case 'gauge':
                this.createGaugeChart(analysis.overall?.score || 0);
                break;
            case 'timeline':
                this.createTimelineChart(analysis.roadmap || {});
                break;
        }
    }

    createRadarChart(pillars) {
        const ctx = document.getElementById('pillarRadarChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.radarChart) {
            this.radarChart.destroy();
        }

        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#e5e7eb' : '#1f2937';
        const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';

        this.radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: pillars.map(p => {
                    // Shorten pillar names for better display
                    const shortNames = {
                        'Formation & Compliance': 'Formation',
                        'Business Credit Readiness': 'Credit',
                        'Financials & Cash Flow': 'Financials',
                        'Operations & Systems': 'Operations',
                        'Sales & Marketing': 'Sales',
                        'Brand & Web Presence': 'Brand',
                        'Risk & Legal Posture': 'Legal',
                        'Growth Strategy & Execution': 'Growth'
                    };
                    return shortNames[p.name] || p.name;
                }),
                datasets: [{
                    label: 'Current Score',
                    data: pillars.map(p => p.score),
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(16, 185, 129, 1)',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }, {
                    label: 'Target Score',
                    data: pillars.map(() => 85), // Target of 85 for all pillars
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        },
                        pointLabels: {
                            color: textColor,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.r + '/100';
                            }
                        }
                    }
                }
            }
        });
    }

    createBarChart(pillars) {
        const ctx = document.getElementById('pillarBarChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.barChart) {
            this.barChart.destroy();
        }

        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#e5e7eb' : '#1f2937';
        const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';

        // Sort pillars by score
        const sortedPillars = [...pillars].sort((a, b) => b.score - a.score);

        // Determine colors based on scores
        const colors = sortedPillars.map(p => {
            if (p.score >= 71) return 'rgba(16, 185, 129, 0.8)'; // Green
            if (p.score >= 41) return 'rgba(234, 179, 8, 0.8)'; // Yellow
            return 'rgba(239, 68, 68, 0.8)'; // Red
        });

        this.barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedPillars.map(p => {
                    // Shorten pillar names
                    const shortNames = {
                        'Formation & Compliance': 'Formation',
                        'Business Credit Readiness': 'Credit',
                        'Financials & Cash Flow': 'Financials',
                        'Operations & Systems': 'Operations',
                        'Sales & Marketing': 'Sales',
                        'Brand & Web Presence': 'Brand',
                        'Risk & Legal Posture': 'Legal',
                        'Growth Strategy & Execution': 'Growth'
                    };
                    return shortNames[p.name] || p.name;
                }),
                datasets: [{
                    label: 'Score',
                    data: sortedPillars.map(p => p.score),
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.8', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor,
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Score: ' + context.parsed.y + '/100';
                            }
                        }
                    }
                }
            }
        });
    }

    createGaugeChart(score) {
        const ctx = document.getElementById('healthGaugeChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.gaugeChart) {
            this.gaugeChart.destroy();
        }

        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#e5e7eb' : '#1f2937';

        // Determine color based on score
        let gaugeColor;
        if (score >= 85) gaugeColor = '#10B981'; // Elite - Green
        else if (score >= 75) gaugeColor = '#22C55E'; // Strong - Light Green
        else if (score >= 60) gaugeColor = '#EAB308'; // Stable - Yellow
        else if (score >= 40) gaugeColor = '#F97316'; // At Risk - Orange
        else gaugeColor = '#EF4444'; // Critical - Red

        this.gaugeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Score', 'Remaining'],
                datasets: [{
                    data: [score, 100 - score],
                    backgroundColor: [gaugeColor, isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.5)'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            },
            plugins: [{
                id: 'text',
                beforeDraw: function(chart) {
                    const width = chart.width,
                        height = chart.height,
                        ctx = chart.ctx;
                    
                    ctx.restore();
                    const fontSize = (height / 114).toFixed(2);
                    ctx.font = "bold " + fontSize + "em sans-serif";
                    ctx.fillStyle = gaugeColor;
                    ctx.textBaseline = "middle";
                    
                    const text = score + "/100",
                        textX = Math.round((width - ctx.measureText(text).width) / 2),
                        textY = height / 1.4;
                    
                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    }

    createTimelineChart(roadmap) {
        const ctx = document.getElementById('roadmapTimelineChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.timelineChart) {
            this.timelineChart.destroy();
        }

        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#e5e7eb' : '#1f2937';
        const gridColor = isDarkMode ? 'rgba(156, 163, 175, 0.2)' : 'rgba(107, 114, 128, 0.2)';

        // Count actions for each period
        const actionCounts = {
            '30 Days': (roadmap.d30 || []).length,
            '60 Days': (roadmap.d60 || []).length,
            '90 Days': (roadmap.d90 || []).length
        };

        this.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Start', '30 Days', '60 Days', '90 Days'],
                datasets: [{
                    label: 'Actions to Complete',
                    data: [
                        actionCounts['30 Days'] + actionCounts['60 Days'] + actionCounts['90 Days'],
                        actionCounts['60 Days'] + actionCounts['90 Days'],
                        actionCounts['90 Days'],
                        0
                    ],
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }, {
                    label: 'Completed Actions',
                    data: [0, actionCounts['30 Days'], actionCounts['30 Days'] + actionCounts['60 Days'], 
                           actionCounts['30 Days'] + actionCounts['60 Days'] + actionCounts['90 Days']],
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y + ' actions';
                            }
                        }
                    }
                }
            }
        });
    }

    getPillarIcon(pillarName) {
        const iconMap = {
            'Formation & Compliance': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            'Business Credit Readiness': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
            'Financials & Cash Flow': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
            'Operations & Systems': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/></svg>',
            'Sales & Marketing': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            'Brand & Web Presence': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
            'Risk & Legal Posture': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            'Growth Strategy & Execution': '<svg class="pillar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>'
        };
        return iconMap[pillarName] || '';
    }

    renderPillarCards(pillars) {
        return pillars.map((pillar, index) => {
            const status = Elev8Calculator.getPillarStatus(pillar.score);
            const icon = this.getPillarIcon(pillar.name);
            return `
                <div class="pillar-card" data-testid="card-pillar-${index}">
                    <div class="pillar-header">
                        <div class="pillar-title-row">
                            ${icon}
                            <h4 class="pillar-name">${pillar.name}</h4>
                        </div>
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

        // Call the quick PDF export function that captures charts (defined in pdf-export.js)
        if (typeof window.exportElev8QuickPDF === 'function') {
            window.exportElev8QuickPDF();
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

    // =====================================================
    // SAVE/LOAD REPORT FUNCTIONALITY
    // =====================================================
    
    showSaveModal() {
        // Check if there's an analysis to save
        if (!this.currentAnalysis) {
            alert('No analysis to save. Generate an analysis first.');
            return;
        }

        const modal = document.getElementById('saveReportModal');
        const input = document.getElementById('reportNameInput');
        const errorDiv = document.getElementById('saveReportError');
        
        if (modal && input && errorDiv) {
            // Clear previous state
            input.value = '';
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
            
            // Show modal
            modal.classList.add('active');
            input.focus();
            
            // Setup event listeners (remove old ones first)
            const closeBtn = document.getElementById('closeSaveModal');
            const cancelBtn = document.getElementById('cancelSaveBtn');
            const confirmBtn = document.getElementById('confirmSaveBtn');
            
            const closeModal = () => modal.classList.remove('active');
            
            if (closeBtn) closeBtn.onclick = closeModal;
            if (cancelBtn) cancelBtn.onclick = closeModal;
            if (confirmBtn) {
                confirmBtn.onclick = () => this.saveReportToDb(input.value.trim(), errorDiv, modal);
            }
            
            // Handle Enter key in input
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    this.saveReportToDb(input.value.trim(), errorDiv, modal);
                }
            };
            
            // Close on overlay click
            modal.querySelector('.modal-overlay').onclick = closeModal;
        }
    }

    async saveReportToDb(reportName, errorDiv, modal) {
        if (!reportName) {
            errorDiv.textContent = 'Please enter a report name.';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/elev8/reports/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportName,
                    analysisData: this.currentAnalysis
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save report');
            }

            console.log('[Save Report] Saved successfully:', data.report);
            modal.classList.remove('active');
            alert(`Report "${reportName}" saved successfully!`);
        } catch (error) {
            console.error('[Save Report] Error:', error);
            errorDiv.textContent = error.message || 'Failed to save report. Please try again.';
            errorDiv.classList.remove('hidden');
        }
    }

    async showLoadModal() {
        const modal = document.getElementById('loadReportModal');
        const listDiv = document.getElementById('savedReportsList');
        const noReportsDiv = document.getElementById('noSavedReports');
        const errorDiv = document.getElementById('loadReportError');
        
        if (modal && listDiv && noReportsDiv && errorDiv) {
            // Clear previous state
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
            noReportsDiv.classList.add('hidden');
            listDiv.innerHTML = '<div class="loading-message">Loading saved reports...</div>';
            
            // Show modal
            modal.classList.add('active');
            
            // Setup close listeners
            const closeBtn = document.getElementById('closeLoadModal');
            const cancelBtn = document.getElementById('cancelLoadBtn');
            const closeModal = () => modal.classList.remove('active');
            
            if (closeBtn) closeBtn.onclick = closeModal;
            if (cancelBtn) cancelBtn.onclick = closeModal;
            modal.querySelector('.modal-overlay').onclick = closeModal;
            
            // Fetch saved reports
            try {
                const response = await fetch('/api/elev8/reports/list');
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load reports');
                }
                
                if (data.reports.length === 0) {
                    listDiv.innerHTML = '';
                    noReportsDiv.classList.remove('hidden');
                } else {
                    this.renderSavedReportsList(data.reports, listDiv, modal);
                }
            } catch (error) {
                console.error('[Load Report] Error:', error);
                listDiv.innerHTML = '';
                errorDiv.textContent = error.message || 'Failed to load saved reports.';
                errorDiv.classList.remove('hidden');
            }
        }
    }

    renderSavedReportsList(reports, listDiv, modal) {
        listDiv.innerHTML = '';
        
        const template = document.getElementById('savedReportTemplate');
        
        reports.forEach(report => {
            const item = template.content.cloneNode(true);
            
            item.querySelector('.saved-report-name').textContent = report.reportName;
            
            const date = new Date(report.createdAt);
            item.querySelector('.saved-report-date').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            const loadBtn = item.querySelector('.load-btn');
            loadBtn.onclick = () => this.loadReportFromDb(report.id, modal);
            
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.onclick = () => this.deleteReport(report.id, report.reportName, () => this.showLoadModal());
            
            listDiv.appendChild(item);
        });
    }

    async loadReportFromDb(reportId, modal) {
        try {
            const response = await fetch(`/api/elev8/reports/load/${reportId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load report');
            }
            
            // Set the loaded analysis as current
            this.currentAnalysis = data.report.analysisData;
            this.analysisHistory.unshift(data.report.analysisData);
            
            // Update UI
            this.renderResults();
            this.saveToLocalStorage();
            
            // Close modal
            modal.classList.remove('active');
            
            console.log('[Load Report] Loaded successfully:', data.report.reportName);
        } catch (error) {
            console.error('[Load Report] Error:', error);
            alert(error.message || 'Failed to load report. Please try again.');
        }
    }

    async deleteReport(reportId, reportName, onSuccess) {
        if (!confirm(`Delete report "${reportName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/elev8/reports/delete/${reportId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete report');
            }
            
            console.log('[Delete Report] Deleted successfully:', reportName);
            
            // Refresh the list
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('[Delete Report] Error:', error);
            alert(error.message || 'Failed to delete report. Please try again.');
        }
    }
}

// =====================================================
// DROPDOWN MANAGER
// =====================================================
class DropdownManager {
    constructor() {
        this.activeDropdown = null;
        this.init();
    }

    init() {
        // Setup File dropdown
        const fileBtn = document.getElementById('fileBtn');
        const fileMenu = document.getElementById('fileMenu');
        if (fileBtn && fileMenu) {
            fileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(fileMenu);
            });
        }

        // Setup Export dropdown
        const exportBtn = document.getElementById('exportBtn');
        const exportMenu = document.getElementById('exportMenu');
        if (exportBtn && exportMenu) {
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(exportMenu);
            });
        }

        // Setup File dropdown items
        const saveReportBtn = document.getElementById('saveReportBtn');
        if (saveReportBtn) {
            saveReportBtn.addEventListener('click', () => {
                this.closeAllDropdowns();
                if (window.elev8App) {
                    window.elev8App.showSaveModal();
                }
            });
        }

        const loadReportBtn = document.getElementById('loadReportBtn');
        if (loadReportBtn) {
            loadReportBtn.addEventListener('click', () => {
                this.closeAllDropdowns();
                if (window.elev8App) {
                    window.elev8App.showLoadModal();
                }
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });
    }

    toggleDropdown(menu) {
        if (this.activeDropdown === menu) {
            this.closeAllDropdowns();
        } else {
            this.closeAllDropdowns();
            menu.classList.add('active');
            this.activeDropdown = menu;
        }
    }

    closeAllDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
        this.activeDropdown = null;
    }
}

// =====================================================
// INITIALIZE APP
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme manager
    new ThemeManager();
    
    // Initialize dropdown manager
    new DropdownManager();
    
    // Initialize Elev8 Analyzer app
    window.elev8App = new Elev8AnalyzerApp();
    
    console.log('[Elev8 Analyzer] Application initialized');
});
