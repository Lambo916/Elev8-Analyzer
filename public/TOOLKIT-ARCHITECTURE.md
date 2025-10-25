# GrantGenie Modular Toolkit Architecture

## Overview
This system demonstrates a modular architecture that allows multiple GrantGenie toolkits to share common infrastructure while maintaining distinct branding, forms, and AI prompts.

## Current Toolkits

### 1. GrantGenie (Production)
- **Purpose**: Grant opportunity discovery and application assistance
- **Primary Color**: Gold (#FFD700)
- **Form Type**: Compliance filing form (7 fields)
- **AI Output**: 5 sections (Executive Summary, Checklist, Roadmap, Risk Matrix, Next Steps)
- **Status**: ✅ Production Ready

### 2. Elev8 Analyzer (Scaffold)
- **Purpose**: Business diagnostic analysis and strategic planning
- **Primary Color**: Green (#2E7D32)
- **Form Type**: Diagnostic profile form (7 fields)
- **AI Output**: 4 sections (Executive Summary, SWOT, Risk/Opportunity Matrix, Recommendations)
- **Status**: 🚧 Scaffold Only

## Architecture Components

### 1. Toolkit Configuration (`toolkit-config.js`)
Centralized configuration defining:
- Toolkit metadata (name, tagline, icons)
- Theme colors (primary, accent, etc.)
- Form field definitions
- AI prompt template selection
- PDF export settings

### 2. Theme System
**Base Theme** (`style.css`): Shared CSS architecture using CSS variables
- Typography system
- Layout grid
- Component styles
- Interactive states

**Toolkit Themes**:
- `index.html` - CompliPilot theme (default)
- `elev8-theme.css` - Elev8 Analyzer green theme
- Activates via CSS class: `class="elev8-theme"`

### 3. AI System Prompts (`server/routes.ts`)
Two specialized prompt templates:
- `getComplianceSystemPrompt()` - GrantGenie structured compliance output
- `getDiagnosticSystemPrompt()` - Elev8 Analyzer strategic analysis output

**Toolkit-Aware API Routing:**
The `/api/generate` endpoint accepts a `toolkitType` parameter:
```javascript
fetch('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
        prompt: userPrompt,
        formData: {...},
        toolkitType: 'diagnostic'  // or 'compliance' (default)
    })
});
```
- `toolkitType: 'compliance'` (default) → uses GrantGenie prompt
- `toolkitType: 'diagnostic'` → uses Elev8 Analyzer prompt

### 4. PDF Export System (`pdf-export.js`)
Modular branding via:
- `window.currentToolkitName` - Sets header title
- `window.currentToolkitIcon` - Sets header icon
- `getToolkitName()` - Dynamic toolkit detection
- Shared GrantGenie footer across all toolkits

## How to Add a New Toolkit

### Step 1: Define Configuration
Add entry to `TOOLKIT_CONFIGS` in `toolkit-config.js`:
```javascript
newtoolkit: {
    name: "NewToolkit Name",
    tagline: "Your tagline here",
    themeColor: "#HEXCODE",
    formFields: [...],
    systemPromptTemplate: "template_key"
}
```

### Step 2: Create Theme CSS
Create `newtoolkit-theme.css`:
```css
.newtoolkit-theme {
    --ybg-brand-primary: R, G, B;
    --primary: rgb(R, G, B);
    /* Override other theme variables */
}
```

### Step 3: Add AI Prompt Template
In `server/routes.ts`, create prompt function:
```typescript
const getNewToolkitPrompt = () => {
    return `You are NewToolkit, ...`;
};
```

### Step 4: Create HTML Entry Point
Clone `index.html` or `elev8-analyzer.html`:
- Update title, tagline, meta tags
- Replace form fields based on config
- Set `window.currentToolkitName` and `window.ACTIVE_TOOLKIT`
- Link appropriate theme CSS

### Step 5: Update JavaScript Logic (if needed)
Adapt form validation, prompt building, and data collection in `script.js` based on new form structure.

## Key Benefits

✅ **Shared Infrastructure**: All toolkits use the same core components
✅ **Consistent Branding**: GrantGenie footer and attribution maintained
✅ **Easy Theming**: CSS variables enable quick color scheme changes
✅ **Modular Forms**: Each toolkit can have unique input structures
✅ **Specialized AI**: Dedicated system prompts for each toolkit's purpose
✅ **Unified PDF Export**: Automatic branding in PDF outputs

## File Structure

```
public/
├── index.html                  # CompliPilot (main)
├── elev8-analyzer.html         # Elev8 Analyzer (scaffold)
├── style.css                   # Base theme system
├── elev8-theme.css             # Analyzer green theme
├── toolkit-config.js           # Toolkit definitions
├── script.js                   # Core application logic
├── pdf-export.js               # PDF generation engine
└── TOOLKIT-ARCHITECTURE.md     # This file

server/
└── routes.ts                   # API endpoints + AI prompts
```

## Production Deployment

**Current Status**: GrantGenie is production-ready at `/` or `index.html`

**Future Toolkits**: Each can be deployed at:
- `/elev8` or `/elev8-analyzer.html` - Business Analysis
- `/funding` or `/funding-toolkit.html` - Funding Assistant
- `/tax` or `/tax-planner.html` - Tax Planning
- etc.

All sharing the same backend API and maintaining GrantGenie branding consistency.
