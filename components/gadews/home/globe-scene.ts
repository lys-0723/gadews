import * as THREE from "three";
import {
  globeLocation,
  type GlobeReportGroup,
} from "@/lib/gadews/globe-reports";

export interface GlobeAnchor {
  id: string;
  x: number;
  y: number;
  front: boolean;
}
export interface GlobeScene {
  setGroups: (groups: GlobeReportGroup[]) => void;
  setPaused: (paused: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  redraw: () => void;
  dispose: () => void;
}
interface Callbacks {
  onProject: (anchors: GlobeAnchor[]) => void;
  onSelect: (id: string) => void;
  onReady: () => void;
  onError: () => void;
}
type CountryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

/** Kept in its own lazy chunk: no Three code enters the initial React component bundle. */
export function createGlobeScene(
  mount: HTMLElement,
  callbacks: Callbacks,
): GlobeScene {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true"); // The complete keyboard equivalent is the report dialog.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 50);
  camera.position.set(0, 0.34, 5.65);
  camera.lookAt(0, 0, 0);
  const earthGroup = new THREE.Group();
  earthGroup.rotation.y = Math.PI;
  scene.add(earthGroup);
  scene.add(new THREE.HemisphereLight(0xe1f5ff, 0x152b48, 2.25));
  const sun = new THREE.DirectionalLight(0xfffaf0, 2.8);
  sun.position.set(-3.8, 3, 5.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6bcde5, 0.55);
  fill.position.set(3, -2, -2);
  scene.add(fill);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 96, 64),
    new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 11,
      specular: 0x264946,
    }),
  );
  earthGroup.add(earth);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.66, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(0x9de1f6) } },
      vertexShader:
        "varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}",
      fragmentShader:
        "uniform vec3 tint;varying vec3 n;varying vec3 v;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(tint,a*.42);}",
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  earthGroup.add(atmosphere);
  const ambientCoordinates: number[] = [];
  for (let i = 0; i < 360; i++) {
    const t = i * 2.3999632297;
    const r = 2.1 + (i % 17) * 0.08;
    ambientCoordinates.push(
      Math.cos(t) * r,
      Math.sin(t * 0.61) * 2.6,
      Math.sin(t) * 1.1 - 1.6,
    );
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(ambientCoordinates, 3),
  );
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0x8fd7e8,
      size: 0.012,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  scene.add(particles);
  const markerGroup = new THREE.Group();
  earthGroup.add(markerGroup);
  let markers: { id: string; point: THREE.Mesh; ring: THREE.Mesh }[] = [];
  const controller = new AbortController();
  let disposed = false;
  let ready = false;
  let renderFailed = false;
  renderer.debug.onShaderError = () => {
    renderFailed = true;
  };
  let visible = true;
  let paused = false;
  let reduced = false;
  let hovered = false;
  let frameId = 0;
  let previous = 0;
  let drag: {
    x: number;
    y: number;
    rotation: number;
    moved: boolean;
    pointer: number;
  } | null = null;
  const automatic = () => !paused && !reduced && !hovered && !drag;
  const vector = (lat: number, lon: number, radius: number) => {
    const p = globeLocation(lat, lon, radius);
    return new THREE.Vector3(p.x, p.y, p.z);
  };
  const releaseObject = (object: THREE.Object3D) =>
    object.traverse((node) => {
      if (
        node instanceof THREE.Mesh ||
        node instanceof THREE.LineSegments ||
        node instanceof THREE.Points
      ) {
        node.geometry.dispose();
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshPhongMaterial)
            material.map?.dispose();
          material.dispose();
        });
      }
    });
  const cameraDirection = camera.position.clone().normalize();
  const world = new THREE.Vector3();
  function draw(now: number) {
    frameId = 0;
    if (disposed || !visible || document.hidden || !ready) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    if (automatic()) {
      earthGroup.rotation.y += dt * 0.035;
      particles.rotation.z += dt * 0.005;
    }
    earthGroup.updateMatrixWorld();
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    callbacks.onProject(
      markers.map((marker) => {
        world.setFromMatrixPosition(marker.point.matrixWorld);
        const front = world.dot(cameraDirection) > 0.38 * world.length();
        const projected = world.project(camera);
        return {
          id: marker.id,
          x: (projected.x * 0.5 + 0.5) * width,
          y: (-projected.y * 0.5 + 0.5) * height,
          front,
        };
      }),
    );
    try {
      renderer.render(scene, camera);
    } catch {
      renderFailed = true;
    }
    // Drivers can fail after context creation. Leave "ready" and release the
    // renderer only after render() returns, including shader compilation faults.
    if (renderFailed) {
      callbacks.onProject([]);
      callbacks.onError();
      dispose();
      return;
    }
    if (automatic()) frameId = requestAnimationFrame(draw);
  }
  function redraw() {
    if (!disposed && !frameId && visible && !document.hidden)
      frameId = requestAnimationFrame(draw);
  }
  function resize() {
    const width = Math.max(mount.clientWidth, 1);
    const height = Math.max(mount.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = 5.65;
    camera.updateProjectionMatrix();
    redraw();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  resize();
  const visibilityObserver = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? false;
    if (!visible) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previous = 0;
      callbacks.onProject([]);
    } else redraw();
  });
  visibilityObserver.observe(mount);
  const pageVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previous = 0;
    } else redraw();
  };
  document.addEventListener("visibilitychange", pageVisibility);
  window.addEventListener("scroll", redraw, { passive: true });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hit(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const found = raycaster.intersectObjects(
      [earth, ...markers.map((marker) => marker.point)],
      false,
    )[0];
    return found?.object.userData.groupId as string | undefined;
  }
  const hoverTarget = mount.parentElement ?? mount;
  const enter = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      hovered = true;
      redraw();
    }
  };
  const leave = () => {
    hovered = false;
    previous = 0;
    redraw();
  };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      rotation: earthGroup.rotation.y,
      moved: false,
      pointer: event.pointerId,
    };
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    // Native vertical touch scrolling remains available (touch-action: pan-y).
    if (Math.abs(dx) >= Math.abs(dy)) {
      earthGroup.rotation.y = drag.rotation + dx * 0.006;
      redraw();
    }
  };
  const up = (event: PointerEvent) => {
    if (!drag) return;
    const select = !drag.moved;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (select) {
      const id = hit(event);
      if (id) callbacks.onSelect(id);
    }
    redraw();
  };
  const cancel = () => {
    drag = null;
    redraw();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    callbacks.onError();
    dispose();
  };
  hoverTarget.addEventListener("pointerenter", enter);
  hoverTarget.addEventListener("pointerleave", leave);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("webglcontextlost", contextLost);

  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    document.removeEventListener("visibilitychange", pageVisibility);
    window.removeEventListener("scroll", redraw);
    hoverTarget.removeEventListener("pointerenter", enter);
    hoverTarget.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", cancel);
    canvas.removeEventListener("webglcontextlost", contextLost);
    releaseObject(scene);
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  Promise.all([
    new THREE.TextureLoader()
      .loadAsync("/globe/earth-blue-marble.png")
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          throw new Error("Scene disposed");
        }
        earth.material.map = texture;
        return texture;
      }),
    fetch("/globe/countries.json", { signal: controller.signal }).then(
      (response) => {
        if (!response.ok) throw new Error("Boundary resource unavailable");
        return response.json() as Promise<{
          features: { geometry: CountryGeometry | null }[];
        }>;
      },
    ),
  ])
    .then(([texture, geo]) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        renderer.capabilities.getMaxAnisotropy(),
        4,
      );
      earth.material.map = texture;
      earth.material.needsUpdate = true;
      const segments: number[] = [];
      for (const feature of geo.features) {
        if (!feature.geometry) continue;
        const polygons =
          feature.geometry.type === "MultiPolygon"
            ? feature.geometry.coordinates
            : [feature.geometry.coordinates];
        for (const polygon of polygons)
          for (const ring of polygon)
            for (let i = 1; i < ring.length; i++) {
              const a = ring[i - 1];
              const b = ring[i];
              // Subdivide long border segments along the surface, including the dateline.
              const lonDelta = ((b[0] - a[0] + 540) % 360) - 180;
              const steps = Math.max(
                1,
                Math.ceil(
                  Math.max(Math.abs(lonDelta), Math.abs(b[1] - a[1])) / 2,
                ),
              );
              for (let step = 0; step < steps; step++) {
                const p = vector(
                  a[1] + ((b[1] - a[1]) * step) / steps,
                  a[0] + (lonDelta * step) / steps,
                  1.608,
                );
                const q = vector(
                  a[1] + ((b[1] - a[1]) * (step + 1)) / steps,
                  a[0] + (lonDelta * (step + 1)) / steps,
                  1.608,
                );
                segments.push(p.x, p.y, p.z, q.x, q.y, q.z);
              }
            }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(segments, 3),
      );
      earthGroup.add(
        new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({
            color: 0xaedbcf,
            transparent: true,
            opacity: 0.38,
          }),
        ),
      );
      ready = true;
      callbacks.onReady();
      redraw();
    })
    .catch(() => {
      if (!disposed) {
        callbacks.onError();
        dispose();
      }
    });

  return {
    setGroups(groups) {
      releaseObject(markerGroup);
      markerGroup.clear();
      markers = groups.map((group) => {
        const color = group.reports.some(
          (report) => report.disease_id === "WSD",
        )
          ? 0xf0ba6d
          : 0x9ce9d7;
        const point = new THREE.Mesh(
          new THREE.SphereGeometry(0.027, 10, 8),
          new THREE.MeshBasicMaterial({ color }),
        );
        point.position.copy(vector(group.latitude, group.longitude, 1.637));
        point.userData.groupId = group.id;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.044, 0.053, 24),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.65,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.position.copy(vector(group.latitude, group.longitude, 1.63));
        ring.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          point.position.clone().normalize(),
        );
        ring.visible = !reduced;
        markerGroup.add(point, ring);
        return { id: group.id, point, ring };
      });
      redraw();
    },
    setPaused(value) {
      paused = value;
      redraw();
    },
    setReducedMotion(value) {
      reduced = value;
      particles.visible = !value;
      markers.forEach((marker) => {
        marker.ring.visible = !value;
      });
      redraw();
    },
    redraw,
    dispose,
  };
}
