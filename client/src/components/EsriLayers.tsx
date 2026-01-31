import { useEffect } from "react";
import { useMap } from "react-leaflet";
import * as esriLeaflet from "esri-leaflet";

interface EsriLayersProps {
  showEpaEcho: boolean;
  showGemsWater: boolean;
}

export function EsriLayers({ showEpaEcho, showGemsWater }: EsriLayersProps) {
  const map = useMap();

  useEffect(() => {
    let epaLayer: any = null;
    
    if (showEpaEcho) {
      // Use FeatureLayer with simplified query for faster loading
      // Focus on major facilities and those with violations
      epaLayer = esriLeaflet.featureLayer({
        url: "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0",
        where: "FAC_MAJOR_FLAG = 'Y' OR FAC_CURR_SNC_FLG = 'Y'",
        pointToLayer: function(_geojson: any, latlng: any) {
          return (window as any).L.circleMarker(latlng, {
            radius: 6,
            fillColor: "#ef4444",
            color: "#b91c1c",
            weight: 1,
            opacity: 0.9,
            fillOpacity: 0.7
          });
        }
      });
      epaLayer.addTo(map);
    }

    return () => {
      if (epaLayer) {
        map.removeLayer(epaLayer);
      }
    };
  }, [map, showEpaEcho]);

  useEffect(() => {
    let gemsLayer: any = null;
    
    if (showGemsWater) {
      gemsLayer = esriLeaflet.dynamicMapLayer({
        url: "https://geoportal.bafg.de/arcgis/rest/services/GEMSTAT/STATION_METADATA_MAP/MapServer",
        opacity: 0.8,
        layers: [0],
      });
      gemsLayer.addTo(map);
    }

    return () => {
      if (gemsLayer) {
        map.removeLayer(gemsLayer);
      }
    };
  }, [map, showGemsWater]);

  return null;
}
