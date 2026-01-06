
# Murder At Midnight Frontend

This is the frontend for the Murder At Midnight project, built with React and Vite.

## Features
- Pixel art font styling using 'Press Start 2P'
- Tailwind CSS for utility-first styling
- React Router for navigation
- Sound effects support (add your own .wav files to `public/sounds/`)

## Getting Started

### Prerequisites
- Node.js (v18 or newer recommended)
- npm

### Install dependencies

```
npm install
```

### Run the development server

```
npm run dev
```

### Build for production

```
npm run build
```

## Tailwind CSS Setup
- Tailwind is configured via `tailwind.config.js` and `postcss.config.js`.
- If you see errors about `@tailwind` rules, ensure you have `tailwindcss`, `postcss`, and `autoprefixer` installed.

## Customization
- To change the font, edit `src/index.css` and use a different Google Fonts import.
- To add sound effects, place `.wav` or `.mp3` files in `public/sounds/` and use the `playSound` utility in your components.

## Project Structure
- `src/` — React components and pages
- `public/` — Static assets
- `tailwind.config.js` — Tailwind configuration
- `postcss.config.js` — PostCSS configuration

## License
See LICENSE in the root directory.
