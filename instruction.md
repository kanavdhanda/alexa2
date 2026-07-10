MASTER FRONTEND ARCHITECTURE & DESIGN BLUEPRINT
Project: HomeSense Digital Twin & Ecosystem (Interactive Demo)
Target AI Engine: Claude Code / Advanced UI Generators
Core Technologies: WebGL (Three.js/React Three Fiber), GSAP (ScrollTrigger & Flip), Framer Motion. 
1. INTENTIONS & DESIGN PHILOSOPHY
The Goal: To build an interactive, Awwwards-winning frontend demo that triggers a profound "Eureka!" moment for hackathon judges. This is not a control panel; it is a mesmerizing, living visualization of ambient intelligence.
What I Dislike (DO NOT BUILD THIS):
The "Dashboard" Trap: I hate rigid U-shaped layouts, standard CSS grid sidebars, and basic "Alexa App" lists on the left.
Hacking/Cyberpunk Slop: No dark, gritty, generic matrix-green hacking aesthetics. It shouldn't look like a cybersecurity tool.
Static UI: Flat cards sliding in with basic opacity fades are banned.
What I Love (BUILD THIS):
The "Steel Troops" Anime Aesthetic: Inspired by Doraemon: Nobita and the Steel Troops (2011). The aesthetic contrasts a warm, normal suburban setting (the house) with massive, hyper-advanced, clean, and friendly "mecha" engineering hidden beneath.
The Terminal Industries X-Ray Reveal: (Reference the truck images). The object is solid, but when triggered, a scanline washes over it, transforming it into a glowing point-cloud/wireframe, revealing the complex internal data structure.
Spatial UI & Liquid Glass: UI elements don’t live in sidebars; they float in 3D space around the house. When expanded, they use an "Apple Liquid Glass" effect—warping and blurring the background organically.
Educational Interaction: When a user clicks on an expanded layer/node, the UI physically zooms in and explains why that layer exists (e.g., "Why T1 Edge? To process the cooker whistle locally, saving a 1.2s cloud roundtrip.").
2. THE VISUAL LANGUAGE & COLOR THEME
The canvas is an infinite 3D WebGL space. The lighting is cinematic and volumetric.
The Canvas (Background): Twilight Blue (#0B1021). Not pure black. It feels like a deep, serene anime night sky.
The Suburban Shell (Resting State): The 3D isometric house uses warm, cel-shaded Ghibli colors. Terracotta roofs, warm yellow window lights, soft shadows.
The HomeSense Core (The X-Ray State): When the Terminal Industries scanline hits, the house turns into a wireframe.
Structural Lines: Luminous Cyan (#00E5FF).
Data Point Cloud (Sensors): Starlight White (#F8FAFC).
Active Routing / Alerts: Energy Pink (#FF2A6D) (Creates a beautiful, striking contrast against the cyan/dark blue).
UI Panels (Liquid Glass): rgba(255, 255, 255, 0.05) with backdrop-filter: blur(24px) saturate(150%). Borders are 1px solid rgba(255, 255, 255, 0.15).
3. TYPOGRAPHY SYSTEM
We need a mix of approachable editorial elegance and high-end engineering.
Headers & Section Titles: Satoshi or General Sans (Bold/Black). These are clean, geometric, Apple-like fonts that feel premium and modern.
Body & Explanations: Inter (Regular). Highly legible for paragraphs explaining the architecture.
Telemetry, Code & MCP Routing: Space Mono or JetBrains Mono. Used for all data particles, JSON snippets, and wireframe node labels.
4. SHADOW ENGINES & TEXTURES
Volumetric Lighting: The Three.js scene must include a subtle volumetric "god ray" effect casting down on the house, giving it a museum-exhibit quality.
The Scanline Shader: The transition from solid house to wireframe must use a custom WebGL fragment shader. A glowing cyan ring passes over the geometry. Above the ring: solid Ghibli textures. Below the ring: glowing wireframe and point-cloud vertices.
UI Drop Shadows: No muddy black shadows. Use large, highly diffused, color-tinted shadows behind the glass panels (e.g., box-shadow: 0px 30px 60px rgba(0, 229, 255, 0.1)).
5. SCENE CHOREOGRAPHY & INTERACTION MAPPING
This section defines exactly how the user experiences the demo.
State 1: The Resting Home (The Anchor)
The camera slowly orbits a beautiful, solid isometric Indian home in the center of the screen.
UI: Completely minimal. No left sidebar. Just a sleek, glass search/voice bar at the bottom center saying: "Ask HomeSense..."
State 2: The "Terminal Industries" Data Reveal (The Trigger)
Action: The user triggers an event (e.g., clicks a "Simulate Whistle" button or types "Dhobi ko das kapde diye").
The Animation: A massive, deep bass sound-wave visual pulses. The WebGL Scanline washes over the house. The solid walls vanish. We are now looking at the HomeSense Data Nervous System (the point-cloud/wireframe).
Data Routing: Glowing pink particles (data) shoot from the kitchen (cooker) into a glowing node labeled T1_EDGE_NODE.
State 3: The Explanation Zoom (Educational Interaction)
Action: The user clicks on the T1_EDGE_NODE hovering inside the wireframe house.
The Animation: The camera uses GSAP to dramatically swoop in, macro-focusing on that specific node. Depth of Field blurs the rest of the house.
The UI Popup: A Liquid Glass panel elegantly unfolds (using Framer Motion spring physics).
The Content: It explicitly explains the architecture.
Title: "T1 Edge ML Layer"
Purpose: "Why does this exist? HomeSense intercepts the 3rd whistle here using Silero VAD. By not sending this to the Bedrock LLM, we save 1.2s of latency and guarantee 100% privacy."
Visual: A mini live-graph showing Cloud Cost: $0.00.
6. THE MCP APP ECOSYSTEM (The Modular Hub)
How we showcase Bookkeeper, Swiggy, and Zomato.
We must prove that HomeSense is not a walled garden, but an operating system for the house. The App Store is not a webpage of 2D grids; it is a physical visualization of plugins.
The Transition: The user clicks "View Integrations" on the bottom nav. The camera flies up and over the wireframe house, revealing a massive orbital ring surrounding the property.
The Modules: Floating on this ring are "Mecha Cartridges"—heavy, glass-and-metal 3D objects representing external apps.
Integration A: Bookkeeper (Ambient Khata)
Visual: A blue-tinted cartridge.
Interaction: We simulate the voice command: "Alexa, dhobi ko das kapde diye."
Animation: A stream of white data particles flows from the house, hits the HomeSense core, gets translated into a structured MCP Schema (JSON: {vendor: dhobi, qty: 10}), and physically shoots into the Bookkeeper cartridge.
Expansion: The Bookkeeper cartridge opens up, revealing a clean, beautiful ledger UI showing the updated tally and a glowing "Generate UPI" button.
Integration B: Zomato / Swiggy (Context Matching)
Visual: A crimson/orange cartridge.
Interaction: We trigger a "Late Night Work" context macro.
Animation: The house wireframe glows orange in the "Study Room." The HomeSense core pulses. Without any voice command, a data line automatically connects to the Zomato cartridge.
Explanation Panel: A glass panel pops up: "Why did this happen? HomeSense Ontology detected [Regime: Work] + [Time: 23:00]. It queried the MCP ecosystem and autonomously generated a cart based on historical data."
Result: A glowing 3D Zomato receipt floats out of the cartridge with a 1-tap order button.
7. TECHNICAL DIRECTIVES FOR CLAUDE CODE (Copy-Paste Instructions)
Dear AI Assistant, execute the following to the letter:
Architecture: Setup a Next.js / React application.
3D Engine: Initialize @react-three/fiber and @react-three/drei. Load a placeholder isometric house model. You MUST implement a custom shader material that allows transitioning the model from a solid MeshStandardMaterial to a PointsMaterial (point cloud) or Wireframe based on a uniforms trigger (The Terminal Industries sweep effect).
UI Overlay: Use framer-motion for all HTML UI elements. They must sit on top of the canvas using position: absolute and pointer-events: none (except for buttons).
Animations: Use gsap with ScrollTrigger or click-event state changes to move the <PerspectiveCamera>. Ensure easing is set to power3.inOut for cinematic camera sweeps.
Layout: DO NOT create a left sidebar. The UI must be spatial. Use Drei's <Html> component to anchor liquid-glass explanation panels directly to 3D coordinates (like the T1 Edge Node or the Bookkeeper cartridge).
Aesthetic: Enforce the Twilight Blue (#0B1021), Luminous Cyan (#00E5FF), and Energy Pink (#FF2A6D) color palette strictly.
HOMESENSE DIGITAL TWIN - ARCHITECTURE & MOTION SPECIFICATION
Target Engine: Claude Code (for automated generation)
Project Scope: HomeSense Context-Awareness Visualization & Z-Axis Expansion
Aesthetic: Studio Ghibli Cyber-Organic × Anime.js Fluidity
1. CORE VISION & REQUIREMENTS
The goal is to build an interactive, Awwwards-caliber web experience that visualizes the "HomeSense" brain of a smart home. The experience must feel like a tactile, high-end WebGL interactive movie rather than a standard web app.
The Digital Twin Anchor: The 3D isometric representation of the home must remain the central anchor of the experience.
Context-Aware Visualization: The UI must visually explain how HomeSense processes data (from raw sensor noise to semantic, ontology-based context resolution).
Z-Axis Navigation: The user will navigate not by scrolling down a page, but by flying through the depth of the application (Z-axis).
Performance: The experience must be buttery smooth, relying on hardware-accelerated compositor thread rendering and niche, powerful physics-based animation engines.
2. DESIGN PREFERENCES: LIKES VS. DISLIKES
What We Dislike (DO NOT USE):
Generic Layouts: No U-shaped dashboards, no left-side "Alexa" menu bars, and no rigid CSS grid columns.
Standard Dark Mode: No flat #111 backgrounds with standard "frosted glass" (backdrop-filter: blur(10px)).
Basic Transitions: No simple opacity fade-ins or basic transform: translateY slides.
Corporate Tech Aesthetics: No generic glowing orbs, boring data tables, or "SaaS-looking" UI components.
What We Like (MANDATORY TO USE):
Studio Ghibli Sci-Fi: Organic, hand-drawn mechanics (like Akira or Howl's Moving Castle).
Cel-Shading: 3D and 2.5D objects with distinct structural outlines and flat, high-contrast shading rather than soft ambient occlusion.
Liquid Glass: Panels that feel viscous and organic. When they open, they morph and expand like a liquid metal bubble, warping the background slightly.
Physics-Based Easing: Elements must have elasticity, mass, and spring dynamics. They should overshoot their targets and wobble organically into place.
Staggered Vector Drawing: Complex SVGs and structural lines that draw themselves in sequence before filling with color.
3. COLOR SCHEME: ORGANIC CYBERNETICS
This palette is designed to make neon accents pop against a deep, texture-rich void.
The Void (Background): #050505 (Pure Void Black).
Structural Linework: #D97757 (Studio Copper). Used for architectural outlines, 3D grids, and the "branches" of the HomeSense ontology tree.
Active Energy / T0 Actions: #39FF14 (Radium Green). Indicates successful local context resolution.
Data Streams: #00FFFF (Synthwave Cyan). Used for raw data particles and MCP routing lines.
Context Shifts / Escalations: #FF5722 (Plasma Orange).
4. TYPOGRAPHY SYSTEM
The typography must blend brutalist mecha-anime title cards with hyper-precise engineering readouts.
Display/Headers: Clash Display (Semibold). Ultra-wide, brutalist, and aggressive. Used for massive background text and section transitions.
UI/Body Text: Space Grotesk (Regular). A geometric sans-serif with slight quirks, giving a highly technical feel to descriptions and tooltips.
Telemetry & Logs: Fira Code (Retina). A monospaced font with programming ligatures enabled (e.g., converting -> into a seamless arrow). Used for all JSON blocks, ontology translations, and latency metrics.
5. SHADOW ENGINES & TEXTURES
We are moving away from soft CSS box-shadows.
Hard Vector Shadows: Use solid, offset shadows (e.g., box-shadow: 6px 6px 0px #D97757) to enforce the 2.5D cel-shaded look.
Liquid Glass Filter: Claude must implement an SVG <feTurbulence> and <feDisplacementMap> filter applied via CSS filter: url(#liquid). This ensures that when a UI panel opens, its borders warp and breathe slightly, breaking the rigid HTML bounding box.
Film Grain Void: The background must contain a fixed, pointer-events: none overlay with a 2-3% opacity SVG noise texture to prevent color banding and add a cinematic, physical film-stock feel to the empty space.
6. TECH STACK: NICHE & POWERFUL
Claude Code must utilize the following libraries to achieve the requested physics and performance:
Three.js / React Three Fiber: For rendering the central isometric Digital Twin and handling the Z-axis camera space.
Theatre.js: Essential for choreographing the complex cinematic camera flights and 3D object positioning without relying on messy coordinate guessing.
Anime.js (v4): The core engine for UI micro-interactions. Its new physics engine will handle the mass/stiffness/damping of the Liquid Glass panels and the staggered SVG line-drawing (stroke-dashoffset).
Lenis: For buttery-smooth, hardware-accelerated scroll hijacking that synchronizes multi-threaded browser scrolling without breaking sticky positioning.
GSAP (ScrollTrigger): For tying the Anime.js animations and the Theatre.js camera movements directly to the user's scroll wheel position.
7. ANIMATION CHOREOGRAPHY: THE HOMESENSE DIVE
This is the exact sequence Claude Code must build. It details how the HomeSense brain is revealed and how it processes data.
Step 1: The Ambient Awakening (Scroll 0%)
Initial State: The screen is pitch black.
The Draw: A Synthwave Cyan spark drops into the center. Anime.js triggers a 1200ms stroke-dashoffset animation, drawing the Studio Copper structural lines of the 3D Digital Twin.
The Fill: Using a staggered spring animation (spring(1, 80, 10, 0)), the flat cel-shaded colors drop into the isometric rooms.
UI: No sidebars. 3 liquid glass spheres float lazily around the house using a subtle sine-wave translation.
Step 2: The Ontology Dive (Scroll 1% - 40%)
The Camera Move: As the user scrolls down, Theatre.js commands the camera to plunge into the screen, flying directly through the floor of the Digital Twin.
The Reveal: Below the house is the HomeSense Central Brain—visualized as a massive, glowing, fractal-like tree structure made of copper lines (The Ontology Tree).
Data Ingestion (Animation): Hundreds of Plasma Orange dots (raw acoustic/sensor embeddings) vibrate erratically at the bottom of the screen.
Step 3: Context Resolution (Scroll 40% - 70%)
The Flow: The orange dots are sucked upward into a spinning, neon Context Management Ring.
Semantic Structuring: As they pass through the ring, they snap into rigid, organized geometric branches on the tree, turning Radium Green.
Liquid Glass Morph: Beside the tree, a small sphere elastically morphs into a wide panel. The SVG border ripples as it opens.
Fira Code Typing: Inside the panel, text types out rapidly:
Plaintext
> audio_proj_88 + pir_active
> Mapping to Semantic Ontology...
> RESOLVED: [Entity: Family] -> [State: Cooking] -> [Env: Kitchen]


Step 4: The MCP Expansion (Scroll 70% - 100%)
The Camera Move: The camera pans sharply to the right, flying horizontally through a dark cavern.
The App Ecosystem: Massive, monolithic liquid glass blocks (MCP modules like Swiggy, Zomato, Bookkeeper) float in the void.
The Connection: A glowing Synthwave Cyan data stream arcs from the HomeSense tree (in the deep background) directly into the Zomato block.
The Finale: The block splits open with an Anime.js elastic bounce, projecting a glowing 3D receipt of a predicted meal order, proving the ambient intelligence of the system.
8. CLAUDE CODE IMPLEMENTATION DIRECTIVES
Prompt to Claude: "Read this document. Build the exact Z-axis scroll experience described in Section 7. Do not use standard HTML divs for the main layout; initialize a WebGL canvas for the spatial navigation. Rely exclusively on Anime.js for the elastic UI panel morphing and GSAP ScrollTrigger to tie the camera progress to the mouse wheel. Ensure the Liquid Glass SVG filter is applied to all floating text panels."
