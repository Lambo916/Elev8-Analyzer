# Elev8 Analyzer

> AI-powered business diagnostic toolkit — part of the YourBizGuru platform

![Elev8 Analyzer](public/elev8-logo.png)

## Overview

Elev8 Analyzer is a comprehensive business diagnostic platform that evaluates companies across **8 critical pillars** of business health and growth. Using advanced AI technology, it provides actionable insights, identifies strengths and gaps, and delivers a prioritized 30/60/90-day roadmap for business improvement.

### 8 Pillars of Business Health

1. **Formation & Compliance** - Legal structure, registrations, and regulatory adherence
2. **Business Credit Readiness** - Credit profile, tradelines, and funding preparedness
3. **Financials & Cash Flow** - Revenue, expenses, profitability, and cash management
4. **Operations & Systems** - Processes, efficiency, and operational infrastructure
5. **Sales & Marketing** - Customer acquisition, marketing channels, and sales strategies
6. **Brand & Web Presence** - Digital footprint, branding consistency, and online visibility
7. **Risk & Legal Posture** - Liability protection, contracts, and risk mitigation
8. **Growth Strategy & Execution** - Strategic planning, scalability, and expansion readiness

### Key Features

- **Elev8 Index (0-100)**: Overall business health score with weighted pillar contributions
- **Pillar Scoring**: Individual assessments (0-100) for each of the 8 pillars
- **Status Indicators**: Green (71-100), Yellow (41-70), Red (0-40) health markers
- **AI-Powered Insights**: Deep analysis of strengths, gaps, and improvement opportunities
- **Prioritized Roadmap**: Actionable 30/60/90-day plans tailored to your business
- **Professional PDF Export**: Multi-page reports with branding and disclaimer footers
- **Dark Mode Default**: Sleek emerald green (#00B87C) branding with deep navy→teal gradients
- **IP-Based Tracking**: 30-report soft-launch limit per IP address
- **Report Persistence**: Save, load, and manage multiple business analyses

## Tech Stack

### Frontend
- **HTML5, CSS3, JavaScript** - Vanilla implementation for maximum compatibility
- **Responsive Design** - Mobile-first with CompliPilot-style dropdown buttons
- **Theme System** - Light/Dark modes with persistent user preferences
- **PDF Generation** - jsPDF with custom formatting and multi-page support

### Backend
- **Node.js + Express** - RESTful API server
- **TypeScript** - Type-safe server implementation
- **OpenAI API** - GPT-4o integration for AI-powered analysis
- **PostgreSQL** - Report persistence and usage tracking
- **Drizzle ORM** - Type-safe database operations

### Deployment
- **Vercel** - Production hosting with serverless functions
- **Replit** - Development environment and staging
- **CORS Enabled** - Configured for analyzer.yourbizguru.com

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Lambo916/Elev8-Analyzer.git
cd Elev8-Analyzer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file or add the following secrets to your Replit environment:

```env
# Required
OPENAI_API_KEY=sk-...                    # OpenAI API key for AI analysis
DATABASE_URL=postgresql://...            # PostgreSQL connection string
SUPABASE_URL=https://...                 # Supabase project URL
SUPABASE_ANON_KEY=eyJ...                 # Supabase anon/public key

# Application
TOOL_NAME=elev8analyzer                  # Tool identifier for usage tracking
NODE_ENV=development                     # Environment (development/production)
SESSION_SECRET=your-secret-key           # Session encryption key

# Optional
PORT=5000                                # Server port (default: 5000)
```

### 4. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

For Replit users, simply click the **Run** button after configuring secrets.

## Usage

### Generating a Business Analysis

1. **Fill out the business profile**:
   - Business Name
   - Industry/Type
   - Years in Operation
   - Annual Revenue
   - Number of Employees
   - Current Challenges

2. **Submit for AI Analysis**:
   - Click "Analyze My Business"
   - Wait for AI-powered evaluation (typically 15-30 seconds)

3. **Review Results**:
   - Overall Elev8 Index score (0-100)
   - Individual pillar scores with color-coded status
   - Key Insights for each pillar
   - Priority Actions for improvement
   - 30/60/90-day roadmap with specific action items

4. **Export & Save**:
   - **Export PDF**: Professional multi-page report with branding
   - **Save Report**: Store analysis for future reference
   - **Load Saved Reports**: Access previously generated analyses

### Usage Limits

- **30 reports per IP address** during soft launch
- Counter displayed in the interface
- Usage tracked via PostgreSQL database

## Deployment

### Vercel Production

The application is hosted on Vercel:

**Live URL**: https://analyzer.yourbizguru.com

#### Deploy Your Own

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `TOOL_NAME=elev8analyzer`
   - `NODE_ENV=production`
3. Deploy with automatic builds on push to main branch

### Replit Staging

Use Replit for development and staging:

1. Fork this Repl or import from GitHub
2. Add secrets in the Secrets panel
3. Click Run to start the development server
4. Access via the Replit webview URL

## Architecture

### Project Structure

```
├── public/                 # Frontend application (vanilla JS)
│   ├── elev8-analyzer.html # Elev8 Analyzer main page
│   ├── elev8-script.js     # Analyzer application logic
│   ├── elev8-styles.css    # Analyzer-specific styles
│   ├── elev8-theme.css     # Theme system (light/dark modes)
│   ├── pdf-export.js       # PDF export functionality
│   ├── toolkit-config.js   # Toolkit configuration
│   ├── privacy.html        # Privacy policy
│   ├── terms.html          # Terms of service
│   ├── elev8-logo.png      # Branding assets
│   └── favicon*.png        # Favicon and icons
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API endpoints and business logic
│   ├── storage.ts          # Storage interface (in-memory/DB)
│   └── vite.ts             # Vite dev server integration
├── shared/                 # Shared types and database schemas
│   └── schema.ts           # Drizzle ORM schema definitions
├── client/                 # Alternative entry point (optional)
│   └── index.html          # Alternative frontend entry
└── api/                    # Vercel serverless functions
    └── *.ts                # Serverless API handlers
```

### Database Schema (PostgreSQL + Drizzle ORM)

```typescript
// users table (authentication, future feature)
{
  id: varchar (uuid, primary key)
  username: text (unique)
  password: text
}

// saved_elev8_reports table
{
  id: varchar (uuid, primary key)
  ipAddress: text
  reportName: text
  analysisData: json        // Full analysis results with pillars & roadmap
  createdAt: timestamp
}

// usage_tracking table
{
  id: varchar (uuid, primary key)
  ipAddress: text
  tool: text                // 'elev8analyzer'
  reportCount: integer
  lastUpdated: timestamp
  unique: (ipAddress, tool) // Composite unique constraint
}

// compliance_reports table (multi-tool support)
{
  id: varchar (uuid, primary key)
  name: text
  entityName: text
  entityType: text
  jurisdiction: text
  filingType: text
  deadline: text
  htmlContent: text
  checksum: text
  metadata: json
  toolkitCode: text         // Tool identifier
  ownerId: text
  userId: varchar
  createdAt: timestamp
}
```

## API Endpoints

### Core Endpoints

#### POST /api/generate
Generate AI-powered content (used by both tools).

**Request:**
```json
{
  "prompt": "Your business question or compliance scenario"
}
```

**Response:**
```json
{
  "result": "AI-generated response",
  "timestamp": "2025-01-26T12:00:00.000Z",
  "model": "gpt-4o-mini"
}
```

### Elev8 Analyzer Endpoints

#### POST /api/elev8/reports/save
Save an Elev8 analysis report.

**Request:**
```json
{
  "reportName": "Big Stake Q1 2025",
  "analysisData": {
    "businessName": "Big Stake Consulting LLC",
    "overall": { "score": 73, "summary": "..." },
    "pillars": [...],
    "roadmap": { "d30": [...], "d60": [...], "d90": [...] }
  }
}
```

#### GET /api/elev8/reports/list
Get all saved Elev8 reports for current IP address.

**Response:**
```json
{
  "reports": [
    {
      "id": "uuid",
      "reportName": "Big Stake Q1 2025",
      "createdAt": "2025-01-26T12:00:00.000Z"
    }
  ]
}
```

#### GET /api/elev8/reports/load/:id
Load a specific saved Elev8 report by ID.

#### DELETE /api/elev8/reports/delete/:id
Delete a saved Elev8 report.

### Legacy Compliance Report Endpoints

_Note: These endpoints support other tools in the YourBizGuru toolkit._

#### POST /api/reports/save
#### GET /api/reports/list
#### GET /api/reports/:id
#### DELETE /api/reports/:id

### Utility Endpoints

#### GET /api/usage/check?tool={tool}
Check usage count for current IP address.

**Parameters:**
- `tool`: `elev8analyzer` or `grantgenie`

**Response:**
```json
{
  "allowed": true,
  "count": 5,
  "limit": 30
}
```

#### POST /api/usage/increment
Increment usage counter (called automatically after report generation).

#### GET /api/db/ping
Database health check.

#### GET /api/auth/config
Authentication configuration (for future features).

## Branding & Design

### Color Palette

- **Primary**: Deep Teal (#0891B2) → Emerald gradients
- **Accent**: Emerald Green (#00B87C)
- **Success**: Green (#10B981)
- **Warning**: Amber (#F59E0B)
- **Error**: Red (#EF4444)

### Typography

- **Headings**: Montserrat (bold, 600)
- **Body**: Open Sans (regular, 400)
- **Monospace**: Consolas, Monaco

### Theme Modes

- **Dark Mode** (default): Deep navy backgrounds with teal/emerald accents
- **Light Mode**: Clean white with blue-tinted cards
- **User Preference**: Persisted in localStorage

## License

MIT License

Copyright (c) 2025 YourBizGuru / Big Stake Consulting LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Credits

**Developed by**: [YourBizGuru](https://yourbizguru.com) (Big Stake Consulting LLC)

**Concept, Design & Architecture**: Founder, Big Stake Consulting LLC

**AI Integration**: OpenAI GPT-4o

**Hosting**: Vercel

**Repository**: https://github.com/Lambo916/Elev8-Analyzer

---

**Version**: 1.1  
**Release Date**: January 2025  
**Status**: Soft Launch (30-report limit per IP)

For support or inquiries, visit [YourBizGuru.com](https://yourbizguru.com)
