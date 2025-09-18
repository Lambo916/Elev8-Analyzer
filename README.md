# YourBizGuru Master Template v1.0.0

This template includes official YBG branding, favicon set, gradients, neon glow, and updated footer. It serves as the **master template v1.0.0** for all toolkits (Grant Genie, CompliPilot, Elev8 Analyzer, BizPlan Builder, Credit Commander, Contract Commander). Clone this template to start each toolkit.

## Features

- **Official YBG Branding**: Professional dark gradient theme with neon glow effects
- **Complete Icon Set**: Favicon, Apple Touch Icon, Android Chrome icons, and PWA manifest
- **Dark Gradient Background**: `linear-gradient(135deg, #0A0A0A, #1A1A1A, #000000)`
- **Neon Glow Effects**: Interactive elements with light blue (#4FC3F7) and yellow (#FFEB3B) accents
- **AI-Powered Backend**: OpenAI GPT-4o-mini integration with fallback support
- **Mobile Responsive**: Optimized for all device sizes
- **PWA Ready**: Complete manifest and icon set for Progressive Web App deployment

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 with custom properties
- **Backend**: Express.js with TypeScript
- **AI Integration**: OpenAI API (GPT-4o-mini with GPT-3.5-turbo fallback)
- **Database**: PostgreSQL with Drizzle ORM (optional)
- **Development**: Vite, React (for client components), Tailwind CSS

## Branding Guidelines

### Colors
- **Primary**: #4FC3F7 (Light Blue)
- **Accent**: #FFEB3B (Yellow)
- **Background**: Dark gradient (#0A0A0A → #1A1A1A → #000000)
- **Text**: #FFFFFF on dark backgrounds

### Typography
- **Headings**: Montserrat (with neon text-shadow)
- **Body**: Open Sans

### Interactive Elements
- Buttons with gradient backgrounds and neon box-shadow
- Hover effects with yellow accent glow
- Focus states with blue outline for accessibility

## Setup Instructions

1. **Clone the template**
   ```bash
   git clone [repository-url]
   cd ybg-template
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Add your `OPENAI_API_KEY` to the secrets panel
   - Optionally add `SESSION_SECRET` for session management

4. **Run development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5000`

## Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with automatic builds on push

### GoHighLevel Integration
Embed the dashboard using an iframe:
```html
<iframe 
  src="https://your-app.vercel.app" 
  width="100%" 
  height="800"
  frameborder="0">
</iframe>
```

## Customization for Specific Toolkits

To customize for each toolkit (Grant Genie, CompliPilot, etc.):

1. Update the title and description in `public/index.html`
2. Modify the OpenAI prompt system message in `server/routes.ts`
3. Adjust the placeholder text in the textarea
4. Update the `site.webmanifest` with toolkit-specific details

## File Structure

```
/
├── public/
│   ├── index.html          # Main HTML with YBG branding
│   ├── style.css           # Dark gradient theme with neon effects
│   ├── script.js           # Frontend JavaScript
│   ├── favicon.ico         # Browser favicon
│   ├── favicon-32x32.png   # 32px favicon
│   ├── apple-touch-icon.png # iOS icon
│   ├── android-chrome-*.png # Android icons
│   └── site.webmanifest    # PWA manifest
├── server/
│   ├── index.ts            # Express server entry
│   ├── routes.ts           # API routes with OpenAI integration
│   └── storage.ts          # Storage interface
├── client/
│   └── src/                # React components (if needed)
└── package.json            # Dependencies
```

## API Endpoints

- `GET /` - Serves the main dashboard
- `POST /api/generate` - Generates AI responses
  - Request: `{ "prompt": "Your business question" }`
  - Response: `{ "result": "AI response", "timestamp": "ISO date", "model": "gpt-4o-mini" }`

## Security Features

- API key validation and secure storage
- Input validation and sanitization
- Rate limiting ready
- CORS configuration for iframe embedding
- No API key logging in production

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

© 2025 YourBizGuru.com - All Rights Reserved

## Support

For support and questions, visit [YourBizGuru.com](https://yourbizguru.com)

---

**Version**: 1.0.0  
**Release Date**: September 2025  
**Template Tag**: `ybg-template-v1.0.0`