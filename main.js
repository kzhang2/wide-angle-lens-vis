import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "lil-gui";

const gui = new GUI();

class MeshHelperOptions {
  constructor(mesh) {
    this.mesh = mesh;
    this.visible = true;
  }

  get visible() {
    return this._visible;
  }

  set visible(v) {
    this._visible = v;
    this.mesh.visible = v;
  }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const texture_canvas = document.createElement("canvas");
const texture_ctx = texture_canvas.getContext("2d");
texture_ctx.canvas.width = 256;
texture_ctx.canvas.height = 256;
texture_ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
texture_ctx.fillRect(0, 0, texture_ctx.canvas.width, texture_ctx.canvas.height);
// make wireframe
let num_grid_lines = 16;
texture_ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx.fillRect(
    Math.floor((i * texture_ctx.canvas.width) / num_grid_lines),
    0,
    1,
    texture_ctx.canvas.height,
  );
}
for (let i = 0; i < num_grid_lines; i++) {
  texture_ctx.fillRect(
    0,
    Math.floor((i * texture_ctx.canvas.height) / num_grid_lines),
    texture_ctx.canvas.width,
    1,
  );
}

// texture_ctx.fillStyle = "#00FF00";
// texture_ctx.fillRect(0, 0, 100, 100);
const texture = new THREE.CanvasTexture(texture_ctx.canvas);

const geometry = new THREE.SphereGeometry(1, 100, 100);
const material = new THREE.MeshBasicMaterial({ map: texture });
const sphere = new THREE.Mesh(geometry, material);

const controls = new OrbitControls(camera, renderer.domElement);

const axes = new THREE.AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 2; // after the grid

let units = 10;
const grid = new THREE.GridHelper(units, units);
grid.material.depthTest = false;
grid.renderOrder = 1;

const loader = new GLTFLoader();
loader.load(
  // resource URL
  "static/models/scene.gltf",
  // called when the resource is loaded
  function (gltf) {
    let mesh = gltf.scene.children[0].children[0].children[0]; // hardcoded for reimu
    mesh.rotation.z = Math.PI;
    mesh.position.z = -15;
    mesh.updateMatrixWorld();
    scene.add(mesh);

    let mho = new MeshHelperOptions(scene.children[0]);
    gui.add(mho, "visible").name("mesh visibility");

    const texture = mesh.material.map;
    const textureWidth = texture.image.width;
    const textureHeight = texture.image.height;
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set the canvas size to match the ImageBitmap
    let imageBitmap = texture.source.data;
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    // Draw the ImageBitmap onto the canvas
    ctx.drawImage(imageBitmap, 0, 0);
    // document.body.appendChild(canvas);

    // Get the pixel data of the entire canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let positions = geometry.getAttribute("position");
    let uvs = geometry.getAttribute("uv");
    let positions_arr = positions.array;
    let uvs_arr = uvs.array;
    console.log(positions);
    console.log(uvs);
    console.log(uvs_arr);
    let origin = new THREE.Vector3(0, 0, 0);
    let line_debug_group = new THREE.Group();
    for (let i = 0; i < positions_arr.length; i += 3) {
      let curr_pos = new THREE.Vector3(
        positions_arr[i],
        positions_arr[i + 1],
        positions_arr[i + 2],
      );
      let dir = curr_pos.sub(origin).normalize();

      let rc = new THREE.Raycaster(origin, dir);
      const intersects = rc.intersectObject(scene.children[0]);
      // debug visualization
      if (intersects.length > 0) {
        let isect_pt = intersects[0].point;

        // make line vis
        const line_material = new THREE.LineBasicMaterial({ color: 0x0000ff });
        const points = [];
        points.push(origin);
        points.push(isect_pt);
        // points.push(dir.multiplyScalar(intersects[0].distance));
        const line_geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(line_geometry, line_material);
        line_debug_group.add(line);

        // get hitpoint color
        // Sample the texture map using the UV coordinates
        let uvX = intersects[0].uv.x;
        let uvY = intersects[0].uv.y;
        const pixelX = Math.floor(uvX * textureWidth);
        const pixelY = Math.floor(uvY * textureHeight);
        const index = (pixelY * textureWidth + pixelX) * 4; // 4 components per pixel (R, G, B, A)
        // Retrieve RGB values from the sampled texture
        // const data = texture.image.data; // Assuming the texture is loaded as an ImageData
        const r = data[index] / 255; // Normalize to range [0, 1]
        const g = data[index + 1] / 255;
        const b = data[index + 2] / 255;

        // console.log(r, g, b);
        const curr_color = new THREE.Color();
        curr_color.r = r;
        curr_color.g = g;
        curr_color.b = b;
        curr_color.convertSRGBToLinear();

        // make hitpoint vis
        const geometry = new THREE.SphereGeometry(0.25, 25, 25);
        const material = new THREE.MeshBasicMaterial({ color: curr_color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(isect_pt.x, isect_pt.y, isect_pt.z);
        scene.add(sphere);

        // color texture on view sphere
        let real_ind = Math.floor((i / 3) * 2); // forgot the *2
        let ctx_x = Math.floor(uvs_arr[real_ind] * texture_ctx.canvas.width);
        let ctx_y =
          texture_ctx.canvas.height -
          Math.floor(uvs_arr[real_ind + 1] * texture_ctx.canvas.height);
        texture_ctx.fillStyle = "#" + curr_color.getHexString(); // need hashtag!!!
        // texture_ctx.fillStyle = "00FF00";
        texture_ctx.fillRect(ctx_x, ctx_y, 3, 3);
        console.log(ctx_x, ctx_y, curr_color.getHexString());

        // break;
      }
    }
    let lho = new MeshHelperOptions(line_debug_group);
    gui.add(lho, "visible").name("debug ray visibility");
    scene.add(line_debug_group);
    scene.add(sphere);
    scene.add(axes);
    scene.add(grid);
    document.body.appendChild(texture_canvas);
  },
  // called while loading is progressing
  function (xhr) {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  // called when loading has errors
  function (error) {
    console.log(error);
    console.log("An error happened");
  },
);

camera.position.z = 5;
controls.update();

function animate() {
  texture.needsUpdate = true;

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
