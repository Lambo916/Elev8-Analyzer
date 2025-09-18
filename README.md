# YourBizGuru (YBG) Toolkit Template

Production-ready, reusable template for creating business toolkits powered by AI. Designed for easy deployment across Replit (development), GitHub (version control), and Vercel (production).

## 🎯 Project Overview

This template creates brand-aligned mini-dashboards that can be:
- Developed locally in Replit
- Deployed to production on Vercel
- Embedded in GoHighLevel via iframe
- Customized for 6 different toolkits using placeholder tokens

## 🛠 Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend (Dev)**: Node.js + Express (Replit)
- **Backend (Prod)**: Vercel Serverless Functions
- **AI Integration**: OpenAI GPT-5
- **Deployment**: Vercel + GoDaddy DNS

## 📁 Project Structure

```
.
├── public/
│   ├── favicon.ico              # YBG favicon
│   ├── ybg-logo.svg            # YBG logo (SVG)
│   └── ybg-logo.png            # YBG logo (PNG)
├── src/
│   ├── frontend/
│   │   ├── index.html          # Main HTML template
│   │   ├── app.css            # Brand-aligned styles
│   │   └── app.js             # Frontend functionality
│   └── api/
│       └── generate.js         # Vercel serverless function
├── server.js                   # Express server (Replit dev)
├── vercel.json                 # Vercel deployment config
├── package.json                # Dependencies & scripts
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## 🎨 Brand Guidelines

**Colors:**
- Primary: Light Blue (#4FC3F7)
- Accent: Yellow (#FFEB3B) - use sparingly
- Base: White (#FFFFFF), Gray (#9E9E9E), Black (#000000)

**Typography:**
- Headings: Montserrat (600/500 weights)
- Body: Open Sans (400/500/600 weights)

**Design:**
- Clean, professional, helpful tone
- 16px border radius, subtle shadows
- Mobile-first responsive design
- Lighthouse optimized (90+ performance)

## 🔧 Placeholder Token System

Replace these tokens when creating each toolkit:

- `{{TOOLKIT_NAME}}` → "Grant Genie", "CompliPilot", etc.
- `{{TOOLKIT_DESC}}` → Short tagline/description
- `{{DEFAULT_PROMPT_HELPER}}` → Placeholder text for input
- `{{RESULT_LABEL}}` → "Results", "Analysis", "Recommendations"
- `{{EXPORT_LABEL}}` → "Export", "Download", "Save"

## 🚀 Quick Start

### Development (Replit)

1. **Clone/Import** this project to Replit
2. **Set Environment Variables**:
   - Go to Replit Secrets
   - Add `OPENAI_API_KEY` with your OpenAI API key
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Start Development Server**:
   ```bash
   npm run dev
   ```
5. **Open** `https://your-repl-name.your-username.repl.co`

### Production (Vercel)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial YBG toolkit template"
   git remote add origin https://github.com/yourbizguru/your-toolkit-name.git
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Import GitHub repo to Vercel
   - Add `OPENAI_API_KEY` in Project Settings > Environment Variables
   - Deploy automatically

3. **Custom Domain (Optional)**:
   - Add CNAME in GoDaddy: `subdomain → cname.vercel-dns.com`
   - Add domain in Vercel project settings

### GoHighLevel Embedding

Add iframe block with your deployed URL:
```html
<iframe 
  src="https://your-toolkit.vercel.app" 
  width="100%" 
  height="900px" 
  frameborder="0"
  scrolling="yes">
</iframe>
```

## 📦 Creating New Toolkits

1. **Duplicate** this template repository
2. **Replace** all placeholder tokens with toolkit-specific values
3. **Customize** any toolkit-specific styling/functionality
4. **Deploy** following the production steps above
5. **Map** subdomain in GoDaddy DNS

**Example for Grant Genie:**
- `{{TOOLKIT_NAME}}` → "Grant Genie"
- `{{TOOLKIT_DESC}}` → "AI-powered grant writing assistant"
- `{{DEFAULT_PROMPT_HELPER}}` → "Describe your organization and funding needs..."
- `{{RESULT_LABEL}}` → "Grant Recommendations"
- `{{EXPORT_LABEL}}` → "Download Grant Guide"

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key for GPT-5 integration |
| `NODE_ENV` | ❌ | Environment (development/production) |
| `PORT` | ❌ | Server port (default: 3000) |

## 🎯 Target Toolkits

1. **Grant Genie** - Grant writing assistant
2. **CompliPilot** - Compliance automation
3. **Elev8 Analyzer** - Business analysis
4. **BizPlan Builder** - Business plan creation
5. **Credit Commander** - Credit improvement
6. **Contract Commander** - Contract analysis

## 📱 Features

- **Responsive Design**: Mobile-first, works on all devices
- **Real-time AI**: GPT-5 powered responses
- **Local Storage**: Saves last 5 results per toolkit
- **Export Functions**: Copy to clipboard & download as .txt
- **Error Handling**: Comprehensive error management
- **Loading States**: Professional UX during processing
- **Accessibility**: WCAG AA compliant
- **Performance**: Lighthouse optimized

## 🔧 Technical Details

**Frontend Architecture:**
- Vanilla JavaScript class-based structure
- CSS variables for consistent theming
- Progressive enhancement approach
- Local storage for result persistence

**Backend Architecture:**
- Express.js for development server
- Vercel serverless functions for production
- OpenAI GPT-5 integration with error handling
- Input validation and rate limiting

**Security Features:**
- Input length validation (2000 char limit)
- API key environment variable management
- CORS headers for iframe embedding
- Error message sanitization

## 📄 License

MIT License - Feel free to customize for your toolkit needs.

## 🆘 Support

For technical support or questions:
- **Development**: Check console logs and network tab
- **Deployment**: Verify environment variables are set
- **API Issues**: Confirm OpenAI API key is valid and has credits

---

**Powered by YourBizGuru.com** - Professional business tools made simple.