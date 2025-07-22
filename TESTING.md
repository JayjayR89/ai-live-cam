# AI Live Cam v2.0.0 - Testing Guide

## 🧪 Comprehensive Testing Protocol

### 🚀 Quick Start Testing
1. Launch: npm run dev (https://localhost:8080)
2. Camera: Click 'Camera On' and grant permissions
3. Detection: Click 'Detect Objects' and wait for model load
4. Settings: Click gear icon to access detection settings

### 🎯 Object Detection Testing
- 🔴 People (Red): Show face, verify red highlighting
- 🔵 Vehicles (Teal): Show toy cars, verify teal highlighting  
- 🟦 Animals (Blue): Show pets/photos, verify blue highlighting
- 🟢 Objects (Green): Show bottles/books, verify green highlighting
- 🟡 Electronics (Yellow): Show phones/laptops, verify yellow highlighting

### ⚙️ Settings Testing
- Toggle categories on/off - verify real-time filtering
- Adjust confidence slider (10%-90%) - verify sensitivity changes
- Toggle labels and confidence display - verify immediate updates

### 📱 Mobile Testing
- Test portrait/landscape modes
- Verify touch interactions
- Test PWA installation (install button in header)
- Test offline functionality after installation

### 🎯 Performance Targets
- Initial Load: < 3 seconds
- Model Load: < 30 seconds
- Detection FPS: 15-30 desktop, 10-20 mobile
- Memory Usage: < 200MB steady state
