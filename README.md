# Sanding Monitoring Web App

A basic React TypeScript application with minimal dependencies that displays a list of strings, built with Vite.

## Features

- React 18 with TypeScript
- Vite for fast development and building
- Minimal dependencies
- String list component that renders a list of strings
- Clean, modern UI

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Start the viam proxy:
    ```bash
    viam module local-app-testing --app-url http://localhost:3000 --machine-id <machine-id>
    ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Project Structure

- `src/Root.tsx` - Sets up routing and Viam client context
- `src/App.tsx` - Fetches sanding pass data
- `src/AppInterface.tsx` - Main UI component for displaying sanding history
- `src/index.tsx` - Application entry point
- `index.html` - HTML template
- `vite.config.ts` - Vite configuration

## Dependencies

- React 18.2.0
- React DOM 18.2.0
- React Router DOM 7.10.1
- @viamrobotics/sdk 0.57.0
- js-cookie 3.0.5
- Vite 4.4.0
- TypeScript 5.0.0
- @vitejs/plugin-react 4.0.0
- Type definitions for React, React DOM, React Router DOM, and js-cookie
