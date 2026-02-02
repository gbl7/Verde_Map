# Verde - Environmental Quality Mapping Application

## Overview

Verde is an interactive environmental quality mapping application that allows users to explore location-based environmental data and contribute community observations. Users can click anywhere on a map to get AI-powered environmental analysis (air quality, water quality, walkability, green space scores) and drop pins to mark wildlife sightings, pollution sources, trails, or other environmental observations.

The application follows a full-stack TypeScript architecture with a React frontend using Leaflet maps and a Node.js/Express backend that integrates with OpenAI for environmental analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom nature-inspired color palette
- **Mapping**: Leaflet with react-leaflet bindings for interactive maps
- **Animations**: Framer Motion for smooth UI transitions
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript compiled with tsx
- **API Pattern**: REST endpoints defined in shared route contracts
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod for runtime type checking with drizzle-zod integration

### Data Layer
- **Database**: PostgreSQL (connection via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` defines all database tables
- **Migrations**: Drizzle Kit manages migrations in `/migrations` folder
- **Current Tables**:
  - `pins`: Community-contributed location markers (lat, lng, type, description)
  - `emissions_sources`: Pre-cached Climate TRACE data (~478,000 sources with lat/lng, sector, emissions)
  - `email_subscribers`: Newsletter/alert subscribers
  - `conversations` and `messages`: Chat storage for AI integrations (available but not actively used)

### API Structure
- Routes defined declaratively in `shared/routes.ts` with Zod schemas
- `POST /api/analyze`: Takes lat/lng, queries EPA ECHO for nearby facilities, returns AI-generated environmental scores enhanced with real regulatory data
- `POST /api/ask`: Takes lat/lng, location name, and question - returns AI-powered answer about the location
- `GET /api/pins`: Lists all community pins
- `POST /api/pins`: Creates a new pin

### WAQI (World Air Quality Index) Integration
The `/api/analyze` endpoint now queries real-time AQI data:
- **Utility**: `server/waqiQuery.ts` handles the WAQI API query
- **Endpoint**: `https://api.waqi.info/feed/geo:{lat};{lng}/`
- **Data returned**: AQI value, category (Good/Moderate/Unhealthy), dominant pollutant, monitoring station name
- **Frontend display**: Color-coded AQI badge in EnvironmentalCard (green/yellow/orange/red based on severity)
- **Score influence**: Real AQI data directly influences the AI-generated airQuality score
- **Token**: Uses `WAQI_API_TOKEN` env var (falls back to demo token)

### EPA ECHO Integration
The `/api/analyze` endpoint queries the EPA ECHO ArcGIS service for regulated facilities within a 10-mile radius:
- **Utility**: `server/epaQuery.ts` handles the API query
- **Fields**: FAC_NAME, FAC_NAICS_CODES, FAC_MAJOR_FLAG, FAC_CURR_SNC_FLG, FAC_QTRS_IN_NC
- **Data returned**: Total facilities, major emitters, facilities with violations, industry breakdown
- This real data is passed to the AI to generate more accurate environmental scores
- The frontend displays EPA context in the EnvironmentalCard when facilities are found

### Climate TRACE Integration (Database-backed)
The application uses a pre-cached PostgreSQL database of Climate TRACE emissions data for fast queries:

**Database Storage**:
- **Table**: `emissions_sources` in PostgreSQL with ~1.1M sources from 120 countries (global coverage)
- **Schema**: sourceId, name, country (ISO3), sector, lat, lng, emissions (CO2e tonnes/yr)
- **Indexes**: Composite index on (lat, lng) for spatial queries, plus country and sector indexes
- **Import Script**: `server/importClimateTrace.ts` fetches from Climate TRACE API and populates database
- **Full Import**: Run with `FULL_IMPORT=true npx tsx server/importClimateTrace.ts` to import all 120 countries

**Query Functions** (in `server/climateTraceQuery.ts`):
- `queryEmissionsFromDatabase()`: Returns top 50,000 emitters globally, sorted by emissions
- `queryEmissionsNearLocation(lat, lng, radiusKm)`: Bounding box + haversine radius query for nearby sources
- `getEmissionsDatabaseCount()`: Returns total sources in database for fallback logic

**API Behavior**:
- `/api/analyze`: Uses `queryEmissionsNearLocation()` when database has data, falls back to API otherwise
- `/api/emissions-sources`: Uses database for global or viewport-filtered queries

**Frontend Display**: Emerald-colored section in EnvironmentalCard showing emissions context

### Emissions Sources Map Layer
When the CO2 layer is toggled on, emission point sources are displayed on the map:
- **API Endpoint**: `GET /api/emissions-sources` with optional viewport params (minLat, maxLat, minLng, maxLng)
- **Data Source**: PostgreSQL database with 1.1M+ cached Climate TRACE sources from 120 countries
- **Viewport Filtering**: When bounds provided, queries only sources in visible area using spatial indexes
- **Global Mode**: Without bounds, returns top 50,000 emitters globally sorted by emissions
- **Map display**: CircleMarker components with sector-based colors (power=purple, oil&gas=orange, manufacturing=cyan, etc.)
- **Size scaling**: Circle radius uses `log10(emissions) * 3` (min 5px, max 20px) for visual hierarchy
- **Map Panning**: Emissions refresh automatically when map is panned (debounced by 500ms)
- **Performance**: Frontend limits to 500 markers, backend returns up to 1,000 per viewport
- **Popup content**: Source name, sector with color indicator, emissions in tonnes CO2e/yr
- **Performance**: Database queries with indexes are sub-second vs 10+ seconds for API calls

### Sentinel 2 Land Cover Integration
The `/api/analyze` endpoint queries Sentinel 2 satellite land cover data:
- **Utility**: `server/landCoverQuery.ts` handles the ArcGIS ImageServer query
- **Endpoint**: Esri Impact Observatory 10m Land Cover ImageServer
- **Analysis radius**: 1km around the clicked location
- **Data returned**: Land cover class breakdown with percentages
- **Classes**: Water, Trees, Grass, Flooded Vegetation, Crops, Scrub/Shrub, Built Area, Bare Ground, Snow/Ice, Clouds, Rangeland
- **Frontend display**: Sky-blue themed section in EnvironmentalCard showing:
  - 3-column summary: Vegetation %, Built Area %, Water %
  - Detailed breakdown with color-coded bars for top 5 classes
  - Dominant land use class
- **Timeout**: 10-second limit to prevent slow responses
- **Data source**: Partnership between Impact Observatory, Microsoft, and Esri (no API key required)

### API Performance
The `/api/analyze` endpoint is optimized for speed:
- **Data fetching**: All external APIs (reverse geocoding, WAQI, EPA, Climate TRACE, Land Cover) run in parallel using `Promise.all`
- **AI model**: Uses `gpt-4o` for quality environmental analysis (~8-10s) - balances speed and response quality
- **Timeouts**: EPA ECHO has 8s timeout to prevent slow responses from blocking requests
- **Typical response time**: 10-12 seconds total (down from 22s+ with sequential calls)
- **Timing logs**: Server logs show `[TIMING]` breakdown for data fetch and AI analysis

### Key Design Decisions

1. **Shared Route Contracts**: The `shared/routes.ts` file defines API contracts with input/output schemas, enabling type-safe API calls from the frontend and validation on the backend.

2. **AI Integration**: Uses OpenAI via Replit AI Integrations environment variables (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`) for environmental analysis.

3. **Component Architecture**: UI components follow shadcn/ui patterns - unstyled Radix primitives wrapped with Tailwind styling, stored in `client/src/components/ui/`.

4. **Path Aliases**: TypeScript paths configured for clean imports:
   - `@/*` → `client/src/*`
   - `@shared/*` → `shared/*`

## External Dependencies

### Database
- **PostgreSQL**: Required, connection string via `DATABASE_URL` environment variable
- **Drizzle Kit**: Run `npm run db:push` to sync schema to database

### AI Services
- **OpenAI API**: Used for environmental analysis generation
  - `AI_INTEGRATIONS_OPENAI_API_KEY`: API key for OpenAI
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`: Base URL (Replit AI proxy or direct OpenAI)

### Mapping Services
- **OpenStreetMap**: Free map tiles via Leaflet (no API key required)

### Included Integration Utilities
The `server/replit_integrations/` folder contains pre-built utilities for:
- Audio/voice chat (speech-to-text, text-to-speech)
- Image generation
- Chat with conversation storage
- Batch processing with rate limiting

These are available but not currently integrated into the main application flow.

## Gamification System

Verde includes a gamification system to encourage user engagement with environmental exploration and community contributions.

### Features
- **Points System**: Users earn points for:
  - Dropping pins: 10 points + streak bonus
  - Exploring locations: 5 points
  - Earning badges: 25 bonus points each

- **Badges**: Achievement badges awarded for milestones:
  - First Steps (1 pin), Explorer (5 pins), Naturalist (10 pins), Eco Warrior (25 pins), Guardian (50 pins), Legend (100 pins)
  - Curious (5 locations explored), Wanderer (15 locations), Globetrotter (50 locations)

- **Levels**: Progress through ranks based on total points:
  - Newcomer (0), Observer (50), Contributor (150), Advocate (300), Champion (500), Expert (800), Master (1200), Legend (2000)

- **Streak System**: Daily activity bonus (up to 20 extra points per action)

### Implementation
- **Storage**: Uses localStorage for persistence (no backend required)
- **Location**: `client/src/lib/gamification.ts` - Core logic
- **Hook**: `client/src/hooks/use-gamification.ts` - React state management
- **UI Components**: 
  - `GamificationPanel.tsx` - Collapsible stats/progress display
  - `BadgeNotification.tsx` - Badge achievement celebration

## UI/UX Features

### Responsive Design
- **Mobile-first**: Optimized for 400px+ viewports
- **Layer toggles**: Collapsible dropdown menu on mobile, inline buttons on desktop (≥1024px)
- **Search bar**: Compact on mobile (h-9 input), larger on desktop (h-10)
- **GamificationPanel**: Bottom-left positioning with responsive width (w-48 mobile, w-52 tablet)

### EnvironmentalCard Interactions
- **Close button**: X icon in header, sets `isCardVisible=false` and resets analysis data
- **Minimize button**: Collapses to compact view showing only score circle and location name
- **Expand button**: Click minimized card to restore full view
- **State management**: `isCardVisible` controls visibility, `isCardMinimized` controls compact/full state

### Map Initialization
- **Fast fallback**: 3-second timeout to San Francisco if geolocation is slow
- **Geolocation options**: 5-second timeout, 60-second max age for cached positions
- Ensures map loads quickly regardless of browser location permissions