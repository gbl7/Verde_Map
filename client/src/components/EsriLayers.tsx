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
      epaLayer = esriLeaflet.dynamicMapLayer({
        url: "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer",
        opacity: 0.7,
        layers: [0],
        layerDefs: {
          0: "FAC_MAJOR_FLAG = 'Y' OR FAC_QTRS_WITH_NC > 0 OR FAC_COMPLIANCE_STATUS = 'Significant Violation'"
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
