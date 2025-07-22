# Copilot Instructions for AI Live Cam

## Project Overview
- **AI Live Cam** is a PWA for real-time object detection, image analysis, and voice synthesis, built with React, TypeScript, Vite, shadcn-ui, Tailwind CSS, and TensorFlow.js (COCO-SSD model).
- The app is optimized for mobile and desktop, with offline support, push notifications, and installable features.

## Architecture & Key Patterns
- **Component Structure:**
  - Main UI and logic are in `src/components/` (e.g., `CameraAIApp.tsx`, `ObjectDetection.tsx`, `CameraPreview.tsx`).
  - UI primitives and reusable elements are in `src/components/ui/`.
  - Context providers (e.g., `TTSSettingsContext.tsx`) manage global state for features like TTS.
  - Utility and helper logic is in `src/lib/` (e.g., `errorHandling.ts`, `performanceUtils.ts`).
  - Service integrations (e.g., push notifications) are in `src/services/`.
- **AI/ML Integration:**
  - TensorFlow.js and COCO-SSD are used for real-time object detection in the browser.
  - Detection logic and model loading are handled in `ObjectDetection.tsx` and related components.
- **Voice Synthesis:**
  - Uses the Web Speech API, with controls and context in `TTSControls.tsx` and `TTSSettingsContext.tsx`.
- **PWA & Offline:**
  - Service worker and caching via Workbox, configured in Vite and PWA plugin settings.

## Developer Workflows
- **Install dependencies:** `npm install`
- **Start dev server:** `npm run dev` (Vite, hot reload)
- **Run tests:** `npm test` or `npx vitest`
- **Build for production:** `npm run build`
- **Lint:** `npx eslint .`
- **Format:** `npx prettier --write .`
- **Push notifications:** Managed in `src/services/pushNotifications.ts`.

## Project Conventions
- **TypeScript-first:** All logic and components use TypeScript for type safety.
- **Functional components and hooks:** React code uses hooks and context for state management.
- **Tailwind CSS:** Utility classes for styling; see `tailwind.config.ts` for customizations.
- **shadcn-ui:** Preferred for UI primitives; see `src/components/ui/` for usage patterns.
- **Error handling:** Centralized in `src/lib/errorHandling.ts` and `ErrorBoundary.tsx`.
- **Testing:** Tests are colocated in `src/components/__tests__/` and use Vitest.
- **Performance:** FPS monitoring and efficient model loading are prioritized in detection components.

## Integration Points
- **TensorFlow.js**: Used directly in detection components.
- **Web APIs:** MediaDevices for camera, Web Speech API for TTS, Push API for notifications.
- **Lovable Platform:** Project can be edited and deployed via [Lovable](https://lovable.dev/projects/182aa45d-870d-49c9-a66c-fc2d915ef08e).

## Examples
- See `src/components/ObjectDetection.tsx` for model loading and detection loop.
- See `src/components/TTSControls.tsx` and `contexts/TTSSettingsContext.tsx` for TTS integration.
- See `src/components/ErrorBoundary.tsx` for error handling pattern.
- See `src/services/pushNotifications.ts` for notification logic.

---

For more, see `README.md` and explore the `src/` directory for implementation details.
