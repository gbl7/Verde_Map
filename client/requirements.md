## Packages
leaflet | Core mapping library
react-leaflet | React bindings for Leaflet
framer-motion | For smooth UI transitions and animations
recharts | For visualizing environmental scores (radar/bar charts)
lucide-react | Iconography for environmental factors
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind classes safely

## Notes
- Using OpenStreetMap tiles via Leaflet for the map interface.
- Leaflet CSS needs to be imported in the main entry file or index.css.
- Map markers will need custom icons or colors based on the "type" of pin (animal, pollution, trail).
- The 'analyze' endpoint takes lat/lng and returns scores/summary.
- The 'pins' endpoint lists community contributions.
