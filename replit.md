# Verde - Environmental Quality Mapping Application

## Overview
Verde is an interactive environmental quality mapping application designed to provide users with location-based environmental data and facilitate community-sourced observations. Its core purpose is to enable users to click anywhere on a map to receive AI-powered environmental analyses (air quality, water quality, walkability, green space scores) and contribute observations such as wildlife sightings, pollution sources, or trails. The application aims to empower individuals with environmental awareness and foster community engagement in monitoring and improving local environmental quality.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, utilizing Wouter for routing and TanStack React Query for state management. UI components are developed using shadcn/ui on Radix UI primitives, styled with Tailwind CSS, and incorporate Framer Motion for animations. Leaflet with react-leaflet provides interactive map functionalities.

### Backend
The backend runs on Node.js with Express 5, written in TypeScript. It exposes REST API endpoints defined with shared route contracts. Drizzle ORM is used for PostgreSQL database interactions, with schema validation handled by Zod.

### Data Layer
A PostgreSQL database stores application data, including `pins` (community observations), `emissions_sources` (pre-cached Climate TRACE data), and `email_subscribers`. The schema is managed by Drizzle Kit.

### API Structure
Key API endpoints include `/api/analyze` for environmental analysis, `/api/ask` for AI-powered location-specific questions, and `/api/pins` for managing community observations.

### External Service Integrations
- **WAQI (World Air Quality Index)**: Integrates real-time AQI data into environmental analysis.
- **EPA ECHO**: Queries EPA's ArcGIS service for regulated facilities near a location, enhancing environmental scores with real regulatory data.
- **Climate TRACE**: Utilizes a pre-cached PostgreSQL database of global emissions data for rapid querying and display of emission sources on the map.
- **Sentinel 2 Land Cover**: Queries ArcGIS ImageServer for land cover analysis within a 1km radius, providing insights into vegetation, built areas, and water bodies.
- **CalEnviroScreen 4.0**: For California locations, integrates spatial data from CalEnviroScreen 4.0 to provide detailed environmental and population health indicators.

### Deterministic Scoring Engine (`server/scoringEngine.ts`)
The application employs a deterministic scoring engine that computes environmental scores from hard data before falling back to AI. Tiered by location:

| Tier | Location | Data Sources | AI Fallback |
|------|----------|-------------|-------------|
| Best | California | CalEnviroScreen 4.0 + WAQI + EPA ECHO + Sentinel-2 + Climate TRACE | Summary text only |
| Good | Other US | WAQI + EPA ECHO + Sentinel-2 + Climate TRACE | Water quality |
| Fair | International | WAQI + Sentinel-2 + Climate TRACE | Water quality |

**Five scoring categories**: Air Quality, Water Quality, Climate & Emissions, Green Space, Pollution/Cleanliness.

Score sources are tracked per-category (`scoreSources` field): "calenviroscreen", "climate-trace", "deterministic", or "ai".

**Climate & Emissions** score (replaced Walkability) leverages the full Climate TRACE database (1.1M emission sources, 120 countries, 46 sectors) within a 50km radius. Scoring uses tiered emissions thresholds with logarithmic scaling, sector diversity penalties, and CES traffic density blending for CA locations.

### CalEnviroScreen 4.0 Integration (`server/calenviroScreenQuery.ts`)
- ArcGIS FeatureServer spatial query using `esriGeometryEnvelope` (not Point — the server doesn't support point queries)
- Field names are **mixed case**: lowercase for most (`ozoneP`, `pmP`, `dieselP`, `pest`, `traffic`, `drink`, `cleanups`, `gwthreats`, `haz`, `iwb`, `swis`, `lead`, `asthma`, `cvd`, `lbw`, `pov`, `unemp`, `ling`, `edu`, `housingB`) but CamelCase for some (`CIscore`, `CIscoreP`, `Pollution`, `PollutionScore`, `PollutionP`, `RSEIhaz`, `RSEIhazP`)
- California detection via bounding box check in `isCaliforniaLocation()`
- 8-second timeout, returns null on failure

### Gamification System
A gamification system encourages user engagement through points for dropping pins and exploring locations, achievement badges, and a leveling system. This system is client-side, using `localStorage` for persistence.

### Authentication and Subscription
Verde integrates Replit Auth for user authentication and features a freemium model with a Pro upgrade via Stripe. This includes managing subscription tiers, tracking usage, and handling Stripe checkout and customer portal sessions.

## External Dependencies

- **PostgreSQL**: Database for storing application data.
- **OpenAI API**: Used for AI-powered environmental analysis and narrative generation.
- **OpenStreetMap**: Provides map tiles for the interactive map.
- **WAQI API**: Real-time air quality index data.
- **EPA ECHO ArcGIS Service**: Regulated facilities data.
- **Esri Impact Observatory 10m Land Cover ImageServer**: Satellite land cover data from Sentinel 2.
- **CalEnviroScreen 4.0 ArcGIS FeatureServer**: Environmental and population health data for California.
- **Stripe**: For subscription management and payment processing.