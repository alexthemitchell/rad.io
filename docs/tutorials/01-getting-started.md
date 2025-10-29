# Tutorial 1: Getting Started with rad.io

Welcome! This tutorial will guide you through setting up your development environment and running your first SDR application. By the end, you'll have rad.io running locally and understand the basic project structure.

**Time to complete**: 15-20 minutes  
**Prerequisites**: Basic command line knowledge  
**What you'll learn**: Project setup, development workflow, basic architecture

## What You'll Build

You'll set up a complete rad.io development environment and:
1. Install dependencies
2. Run the development server
3. Open the application in your browser
4. Explore the basic features
5. Make a small code change to see hot reloading in action

## Prerequisites

Before starting, make sure you have:

- **Node.js 16+** and **npm 8+** installed ([Download Node.js](https://nodejs.org/))
- A modern web browser (Chrome 61+, Edge 79+, or Opera 48+)
- A code editor (we recommend [VS Code](https://code.visualstudio.com/))
- Git installed ([Download Git](https://git-scm.com/))

## Step 1: Clone the Repository

Open your terminal and clone the rad.io repository:

```bash
git clone https://github.com/alexthemitchell/rad.io.git
cd rad.io
```

**What's happening?** You're downloading the complete rad.io codebase to your local machine.

## Step 2: Install Dependencies

Install all required packages:

```bash
npm install
```

**What's happening?** npm reads `package.json` and installs:
- React 19 for UI
- TypeScript for type safety
- Webpack for bundling
- Jest for testing
- ESLint and Prettier for code quality

This might take a few minutes on first run. ☕

## Step 3: Run Quality Checks

Before starting development, verify everything works:

```bash
npm run lint
npm run type-check
npm test
```

**Expected output**:
- ✅ Lint: No errors
- ✅ Type check: No type errors
- ✅ Tests: All tests passing

**If you see errors:** Make sure you're using Node.js 16+ and have a clean clone of the repository.

## Step 4: Start the Development Server

Start the development server with hot reloading:

```bash
npm start
```

**What's happening?** Webpack is:
1. Compiling TypeScript to JavaScript
2. Bundling all modules
3. Starting an HTTPS server on port 8080
4. Watching for file changes

**Expected output**:
```
webpack 5.x.x compiled successfully in X ms
Server running at https://localhost:8080
```

**Important:** The server uses HTTPS because WebUSB requires a secure context.

## Step 5: Open the Application

Open your browser and navigate to:

```
https://localhost:8080/#/
```

**Note:** rad.io uses hash-based routing (the `#/` in the URL). As you navigate the app, you'll see URLs like `https://localhost:8080/#/spectrum` or `https://localhost:8080/#/settings`. The hash routing helps the app manage navigation and page state within the single-page application.

**You'll see a security warning** because we're using a self-signed certificate. This is normal for local development:

- **Chrome/Edge**: Click "Advanced" → "Proceed to localhost (unsafe)"
- **Opera**: Click "Help me understand" → "Continue anyway"

**What you should see:**
- The rad.io interface
- "Connect Device" button
- Visualization panels (IQ Constellation, Spectrogram, Waterfall, Waveform)
- Device control panel (frequency, gain settings)

## Step 6: Explore the Interface

Try these interactions (no hardware required):

### Without a Device

1. **Look at the visualizations** - They're ready but showing no data
2. **Try the preset buttons** - Notice they're disabled until a device connects
3. **Hover over controls** - Tooltips explain each feature
4. **Use keyboard navigation** - Press Tab to move between controls

### Simulated Mode (Optional)

If you want to see visualizations without hardware:

1. Open the browser console (F12)
2. The app runs in demo mode when no device is connected
3. Some features will work with simulated data

## Step 7: Make Your First Code Change

Let's verify hot reloading works. We'll change the welcome message.

### 7.1 Open the Main App File

In your code editor, open:

```
src/App.tsx
```

### 7.2 Find the Page Title

Look for this line (around line 50-60):

```typescript
<h1>rad.io - SDR Visualizer</h1>
```

### 7.3 Change the Text

Modify it to:

```typescript
<h1>rad.io - My First SDR App! 🎉</h1>
```

### 7.4 Save and Watch

1. Save the file (Ctrl+S / Cmd+S)
2. Look at your terminal - you'll see Webpack recompiling
3. Look at your browser - the page refreshes automatically
4. See your new title!

**Congratulations!** You just made your first change to rad.io. 🎉

## Step 8: Explore the Project Structure

Let's understand what's in the repository:

```
rad.io/
├── src/               # Application source code
│   ├── components/    # React components
│   ├── models/        # Device models (HackRF, RTL-SDR, etc.)
│   ├── utils/         # DSP utilities, helpers
│   ├── hooks/         # React hooks
│   └── App.tsx        # Main application component
├── docs/              # Documentation (you are here!)
├── e2e/               # End-to-end tests
├── assembly/          # WebAssembly DSP code
├── dist/              # Build output (generated)
└── package.json       # Dependencies and scripts
```

### Key Files to Know

- **`src/App.tsx`** - Main application entry point
- **`src/models/HackRFOne.ts`** - HackRF device driver
- **`src/utils/dsp.ts`** - DSP functions (FFT, waveforms)
- **`src/components/Spectrogram.tsx`** - Spectrum visualization
- **`webpack.config.ts`** - Build configuration

## Step 9: Stop the Server

When you're done, stop the development server:

1. Go to your terminal
2. Press `Ctrl+C`
3. Type `y` if prompted

## What You've Learned

✅ How to set up rad.io for development  
✅ How to run the development server  
✅ How hot reloading works  
✅ Basic project structure  
✅ How to navigate the interface

## Common Issues and Solutions

### Port 8080 Already in Use

If you see "Port 8080 is already in use":

```bash
# Find and kill the process (macOS/Linux)
lsof -ti:8080 | xargs kill -9

# Or use a different port
PORT=3000 npm start
```

### Self-Signed Certificate Errors

This is normal for local HTTPS. Modern browsers require HTTPS for WebUSB, so we use a self-signed certificate in development.

### Build Errors

If you see TypeScript or build errors:

```bash
# Clean and reinstall
npm run clean
npm install
npm start
```

## Next Steps

Now that you have rad.io running, you're ready to:

- **[Tutorial 2: Your First Visualization](./02-first-visualization.md)** - Create a custom spectrum display
- **[Tutorial 3: Building an FM Radio](./03-fm-radio-receiver.md)** - Complete FM receiver implementation
- Explore the [Reference Documentation](../reference/) to learn about the APIs
- Read the [Architecture Overview](../explanation/sdr-architecture-overview.md) to understand the design

## Need Help?

- Check the [How-To Guides](../how-to/) for specific problems
- Read the [FAQ](../reference/common-use-cases.md#frequently-asked-questions)
- Ask in [GitHub Discussions](https://github.com/alexthemitchell/rad.io/discussions)

**Next:** [Your First Visualization →](./02-first-visualization.md)
