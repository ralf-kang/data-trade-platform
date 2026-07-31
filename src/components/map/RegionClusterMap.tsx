'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// CSS는 패키지의 dist/assets 아래에 있다 (v4는 CSS를 자동 주입하지 않아 직접 import해야 한다).
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

export interface MapPoint {
  code: string;
  name: string;
  count: number;
  lat: number;
  lon: number;
}

/**
 * 지역 클러스터 지도 (docs/주소입력-지도분포-설계.md §4·§5).
 *
 * 🔴 이 컴포넌트에 넘어오는 점은 **이미 k 게이트를 통과한 집계 단위**여야 한다.
 * `react-leaflet-cluster`는 클라이언트에서 마커를 묶어 주는 렌더링 라이브러리일 뿐이므로,
 * 개별 응답 좌표를 넘기고 라이브러리에게 프라이버시를 맡기면 안 된다 — 화면에 클러스터만
 * 보여도 원본 좌표가 네트워크 응답과 메모리에 그대로 남기 때문이다.
 */
export default function RegionClusterMap({
  points,
  tileTemplate,
}: {
  points: MapPoint[];
  tileTemplate: string;
}) {
  // 건수에 따라 크기가 커지는 원형 마커 — 기본 핀 아이콘은 이미지 에셋 경로 문제가 있어 쓰지 않는다.
  const iconFor = (count: number) => {
    const size = Math.min(56, 24 + Math.round(Math.sqrt(count) * 4));
    return L.divIcon({
      html: `<div style="width:${size}px;height:${size}px;line-height:${size}px;border-radius:50%;background:rgba(79,70,229,.85);color:#fff;text-align:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${count}</div>`,
      className: '',
      iconSize: [size, size],
    });
  };

  return (
    <MapContainer
      center={[36.5, 127.8]}
      zoom={7}
      style={{ height: 520, width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url={tileTemplate}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MarkerClusterGroup chunkedLoading>
        {points.map((p) => (
          <Marker key={p.code} position={[p.lat, p.lon]} icon={iconFor(p.count)}>
            <Popup>
              {/* 개별 레코드는 절대 노출하지 않는다 — 지역명과 건수만(§1-3) */}
              <strong>{p.name}</strong>
              <br />
              {p.count.toLocaleString()}건
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
