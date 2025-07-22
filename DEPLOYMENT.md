# AI Live Cam v2.0.0 - Deployment Guide

## 🚀 Production Deployment

### Prerequisites
- Node.js 18+ and npm
- HTTPS domain (required for camera access)
- Modern web server (Nginx/Apache/Vercel/Netlify)

### Build for Production
```bash
npm install
npm run build
```

### Deploy Options

#### Option 1: Vercel (Recommended)
```bash
npm install -g vercel
vercel --prod
```

#### Option 2: Netlify
- Connect GitHub repository
- Build command: `npm run build`
- Publish directory: `dist`

#### Option 3: Traditional Server
```bash
# Copy dist/ folder to web server
# Configure HTTPS (required for camera)
# Set proper MIME types for .wasm files
```

### Required Headers
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### Performance Optimizations
- ✅ Code splitting implemented
- ✅ TensorFlow.js in separate chunk (295KB gzipped)
- ✅ Service worker caching
- ✅ PWA manifest generated
- ✅ Optimized bundle sizes

### Post-Deployment Checklist
- [ ] HTTPS working
- [ ] Camera permissions granted
- [ ] Object detection loads
- [ ] PWA installable
- [ ] Mobile responsive
- [ ] Performance acceptable (15+ FPS)
