"use client";
import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { heatClass, heatColors, heatColumn, heatRow } from "@/lib/gadews/environment/heat-grid";
import { useLocale } from "../locale-provider";

export function HeatwaveGrid({ encoded, month }: { encoded: string; month: string }) {
  const map = useMap();
  const { t } = useLocale();
  useEffect(() => {
    const values = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const palette = heatColors.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
    class HeatTiles extends L.GridLayer {
      createTile(coords: L.Coords) {
        const tile = document.createElement("canvas");
        const size = this.getTileSize().x;
        tile.width = tile.height = size;
        const origin = coords.scaleBy(this.getTileSize());
        const ctx = tile.getContext("2d")!;
        const image = ctx.createImageData(size, size);
        const cols = Array.from({length: size}, (_, x) =>
          heatColumn(map.unproject(L.point(origin.x + x + 0.5, origin.y), coords.z).lng));
        for (let y = 0; y < size; y++) {
          const row = heatRow(map.unproject(L.point(origin.x, origin.y + y + 0.5), coords.z).lat) * 360;
          for (let x = 0; x < size; x++) {
            const value = values[row + cols[x]];
            if (value > 100) continue;
            const rgba = 4 * (y * size + x);
            const color = palette[heatClass(value)];
            image.data[rgba] = color[0];
            image.data[rgba + 1] = color[1];
            image.data[rgba + 2] = color[2];
            image.data[rgba + 3] = 255;
          }
        }
        ctx.putImageData(image, 0, 0);
        return tile;
      }
    }
    const tiles = new HeatTiles({attribution: "NOAA PSL / NMME", zIndex: 3}).addTo(map);
    const popup = L.popup();
    const inspect = (event: L.LeafletMouseEvent) => {
      const row = heatRow(event.latlng.lat), col = heatColumn(event.latlng.lng);
      const v = values[row * 360 + col];
      const label = document.createElement("span");
      label.textContent = t("海洋热浪概率", "Marine heatwave probability") + " · " + month.slice(0,7) +
        " · " + (v > 100 ? t("无有效格点", "No valid cell") : v + "%") +
        " · " + (row - 90) + "°, " + (col > 180 ? col - 360 : col) + "°";
      popup.setLatLng(event.latlng).setContent(label).openOn(map);
    };
    map.on("click", inspect);
    return () => { map.off("click", inspect); popup.remove(); tiles.remove(); };
  }, [encoded, month, map, t]);
  return null;
}
