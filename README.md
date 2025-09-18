# YourBizGuru Master Template v1.1.0

This template includes official YBG branding, complete theming system (Light/Dark), tokenized CSS architecture, increased yellow accents, and persistent theme preferences. It serves as the **master template v1.1.0** for all toolkits (Grant Genie, CompliPilot, Elev8 Analyzer, BizPlan Builder, Credit Commander, Contract Commander). Clone this template to start each toolkit.

## Features

- **Dual Theme System**: Professional Light and Dark themes with persistent user preference
- **Tokenized CSS Architecture**: Reusable CSS variables for colors, gradients, shadows, and typography
- **Enhanced Yellow Accents**: Tasteful use of YBG yellow (#FFEB3B) throughout both themes
- **Complete Icon Set**: Favicon, Apple Touch Icon, Android Chrome icons, and PWA manifest
- **Theme Persistence**: Respects system preferences with localStorage override capability
- **Accessibility First**: AA contrast compliance and reduced-motion support
- **AI-Powered Backend**: OpenAI GPT-4o-mini integration with fallback support
- **Mobile Responsive**: Optimized for all device sizes with theme-aware mobile chrome
- **PWA Ready**: Complete manifest and icon set for Progressive Web App deployment

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3 with custom properties
- **Backend**: Express.js with TypeScript
- **AI Integration**: OpenAI API (GPT-4o-mini with GPT-3.5-turbo fallback)
- **Database**: PostgreSQL with Drizzle ORM (optional)
- **Development**: Vite, React (for client components), Tailwind CSS

## Branding Guidelines

### Colors (Both Themes)
- **Primary**: #4FC3F7 (Light Blue)
- **Accent**: #FFEB3B (Yellow - increased presence)
- **Success**: #4CAF50 (Green)
- **Error**: #F44336 (Red)

### Light Theme
- **Background**: Subtle gradient (#f8fafd → #f0f4f8 → #fafbfc)
- **Cards**: Pure white with soft borders
- **Text**: Dark slate (#1e293b)
- **Yellow Accents**: Subtle accent markers on cards, hover underlines

### Dark Theme
- **Background**: Dark gradient (#0A0A0A → #1A1A1A → #0f0f0f)
- **Cards**: Elevated dark surfaces with blue borders
- **Text**: Pure white (#FFFFFF)
- **Yellow Accents**: Enhanced glows, dual-layer button effects, accent borders

### Typography
- **Headings**: Montserrat (with theme-aware shadows)
- **Body**: Open Sans
- **Sizes**: Consistent scale from 12px to 28px

### Interactive Elements
- Theme toggle with sun/moon icons
- Buttons with gradient backgrounds and theme-specific glows
- Dual-layer hover effects (blue core + yellow halo)
- Focus states with combined blue/yellow rings for accessibility

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

## Themes

### Theme System Architecture
The template uses a tokenized CSS variable system located in `public/style.css`:

- **Root variables**: Define brand colors as RGB values for flexible alpha usage
- **Theme classes**: `.theme-light` (default) and `.theme-dark` applied to `<html>`
- **Token categories**:
  - Colors: `--bg`, `--card`, `--text`, `--muted`, `--border`
  - Brand: `--primary`, `--accent`, `--success`, `--error`
  - Gradients: `--bg-gradient`, `--btn-gradient`, `--accent-glow`
  - Shadows: `--shadow`, `--shadow-strong`, `--glow-primary`, `--glow-accent`

### Theme Behavior
1. **First Load**: Honors system preference via `prefers-color-scheme`
2. **Manual Toggle**: Overrides system preference, persists to localStorage (`ybg-theme`)
3. **Persistence**: User choice survives page refreshes
4. **System Changes**: Only applied if no manual preference is set

### Customizing Theme Tokens
Toolkits can override specific tokens without modifying components:
```css
/* Example: Increase accent intensity for a specific toolkit */
html.theme-light {
    --accent-glow-alpha: rgba(var(--accent-rgb), 0.4); /* Stronger yellow */
}
```

### Accessibility Features
- AA contrast compliance on all text/background combinations
- `prefers-reduced-motion`: Disables heavy animations and glows
- Focus rings: Blue core with subtle yellow halo
- Theme toggle: Keyboard accessible with clear focus states

## Customization for Specific Toolkits

To customize for each toolkit (Grant Genie, CompliPilot, etc.):

1. Update the title and description in `public/index.html`
2. Modify the OpenAI prompt system message in `server/routes.ts`
3. Adjust the placeholder text in the textarea
4. Update the `site.webmanifest` with toolkit-specific details
5. (Optional) Override theme tokens for toolkit-specific branding

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

**Version**: 1.1.0  
**Release Date**: September 2025  
**Template Tag**: `ybg-template-v1.1.0`  

### Changelog v1.1.0
- Added comprehensive Light/Dark theme system
- Implemented tokenized CSS architecture for reusability
- Increased yellow accent presence across both themes
- Added persistent theme toggle with localStorage
- Enhanced accessibility with AA contrast and reduced-motion support
- Improved button hover states with dual-layer glows