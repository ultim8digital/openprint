import L from 'leaflet';

/** Both maps use the same operator setting. The coastline layer is served by the node itself. */
export function addMapBackground(map: L.Map, online: boolean, onError?: () => void) {
  if (online) {
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
    if (onError) tiles.on('tileerror', onError);
    tiles.addTo(map);
    return () => tiles.remove();
  }
  const controller = new AbortController();
  map.getContainer().style.backgroundColor = '#dcebf0';
  map.attributionControl.addAttribution('Natural Earth');
  void fetch('/maps/land-110m.geojson', { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error('Basemap unavailable');
      return response.json();
    })
    .then((land) => {
      if (!controller.signal.aborted)
        L.geoJSON(land, {
          pane: 'tilePane',
          interactive: false,
          style: { color: '#9ba99a', weight: 1, fillColor: '#edf1e4', fillOpacity: 1 },
        }).addTo(map);
    })
    .catch(() => {
      if (!controller.signal.aborted) onError?.();
    });
  return () => {
    controller.abort();
    map.getContainer().style.backgroundColor = '';
  };
}
