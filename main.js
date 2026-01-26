import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ワールド設定パラメータ
const CONFIG = {
  gravity: -9.82, // 重力係数
  floorSize: 5, // 床のサイズ
  ballSpawnHeight: 8, // ボール生成の高さ
  wallHeight: 5, // 壁の高さ
  wallThickness: 1, // 壁の厚さ
};

// ボールパターン（半径、色）
const BALL_TYPES = [
  { radius: 0.3, color: new THREE.Color().setHSL(0.0, 0.7, 0.5) },
  { radius: 0.4, color: new THREE.Color().setHSL(0.1, 0.7, 0.5) },
  { radius: 0.5, color: new THREE.Color().setHSL(0.2, 0.7, 0.5) },
  { radius: 0.6, color: new THREE.Color().setHSL(0.3, 0.7, 0.5) },
  { radius: 0.7, color: new THREE.Color().setHSL(0.4, 0.7, 0.5) },
  { radius: 0.8, color: new THREE.Color().setHSL(0.5, 0.7, 0.5) },
  { radius: 0.9, color: new THREE.Color().setHSL(0.6, 0.7, 0.5) },
  { radius: 1.2, color: new THREE.Color().setHSL(0.9, 0.7, 0.5) }
];

// シーン設定
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

// カメラ設定
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 12, 16);
camera.lookAt(0, 4, 0);

// レンダラー設定
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 環境光設定
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// 光源設定
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

// ワールド設定
const world = new CANNON.World();
world.gravity.set(0, CONFIG.gravity, 0); // 重力ベクトル
world.broadphase = new CANNON.NaiveBroadphase(); // 幅広い衝突検出
world.solver.iterations = 10; // 物理演算の反復回数

// 物理材質
const groundMaterial = new CANNON.Material();
const ballMaterial = new CANNON.Material();

// 床とボールの衝突時設定
const groundBallContactMaterial = new CANNON.ContactMaterial(
  groundMaterial,
  ballMaterial,
  {
    friction: 0.5, // 摩擦
    restitution: 0.5, // 弾力性
  }
);
world.addContactMaterial(groundBallContactMaterial);

// ボール同士の衝突時設定
const ballBallContactMaterial = new CANNON.ContactMaterial(
  ballMaterial,
  ballMaterial,
  {
    friction: 0.5, // 摩擦
    restitution: 0.5, // 弾力性
  }
);
world.addContactMaterial(ballBallContactMaterial);

// 物理オブジェクト管理用
const objectsToUpdate = [];
// 削除予定のボール管理用
const ballsToRemove = new Set();
// 生成予定のボール管理用
const ballsToSpawn = [];

// 床の生成
const createFloor = () => {
  // Three.js
  const geometry = new THREE.PlaneGeometry(CONFIG.floorSize, CONFIG.floorSize);
  const material = new THREE.MeshStandardMaterial({
    color: 0xcfcfcf,
    metalness: 0.3,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Cannon.js
  const shape = new CANNON.Plane();
  const body = new CANNON.Body({
    mass: 0, // Static
    shape: shape,
    material: groundMaterial,
  });
  body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(body);
};

createFloor();

// 壁の生成
const createWalls = () => {
  const wallHeight = CONFIG.wallHeight;
  const wallThickness = CONFIG.wallThickness;
  const floorSize = CONFIG.floorSize;
  const halfSize = floorSize / 2;
  // 物理オフセット: 内側の面が床の端と一致するように、厚さの半分だけ外側にシフト
  const physicsOffset = halfSize + wallThickness / 2;

  // 描画用マテリアル
  const wallMaterialThree = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.5,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const wallMaterialCannon = new CANNON.Material();

  // 物理世界用
  const walls = [
    // 北 (Z-)
    {
      visualPos: [0, wallHeight / 2, -halfSize],
      visualRot: [0, 0, 0],
      visualSize: [floorSize, wallHeight],

      physicsPos: [0, wallHeight / 2, -physicsOffset],
      physicsSize: [floorSize + wallThickness * 2, wallHeight, wallThickness]
    },
    // 南 (Z+)
    {
      visualPos: [0, wallHeight / 2, halfSize],
      visualRot: [0, 0, 0],
      visualSize: [floorSize, wallHeight],

      physicsPos: [0, wallHeight / 2, physicsOffset],
      physicsSize: [floorSize + wallThickness * 2, wallHeight, wallThickness]
    },
    // 東 (X+)
    {
      visualPos: [halfSize, wallHeight / 2, 0],
      visualRot: [0, Math.PI / 2, 0],
      visualSize: [floorSize, wallHeight],

      physicsPos: [physicsOffset, wallHeight / 2, 0],
      physicsSize: [wallThickness, wallHeight, floorSize]
    },
    // 西 (X-)
    {
      visualPos: [-halfSize, wallHeight / 2, 0],
      visualRot: [0, Math.PI / 2, 0],
      visualSize: [floorSize, wallHeight],

      physicsPos: [-physicsOffset, wallHeight / 2, 0],
      physicsSize: [wallThickness, wallHeight, floorSize]
    }
  ];

  // 壁オブジェクトの生成
  walls.forEach(wallConfig => {
    // Three.js
    const geometry = new THREE.PlaneGeometry(wallConfig.visualSize[0], wallConfig.visualSize[1]);
    const mesh = new THREE.Mesh(geometry, wallMaterialThree);
    mesh.position.set(...wallConfig.visualPos);
    mesh.rotation.set(...wallConfig.visualRot);
    scene.add(mesh);

    // Cannon.js
    const shape = new CANNON.Box(new CANNON.Vec3(wallConfig.physicsSize[0] / 2, wallConfig.physicsSize[1] / 2, wallConfig.physicsSize[2] / 2));
    const body = new CANNON.Body({
      mass: 0, // Static
      shape: shape,
      material: wallMaterialCannon
    });
    body.position.set(...wallConfig.physicsPos);
    world.addBody(body);

    // ボールとの衝突判定
    const wallBallContactMaterial = new CANNON.ContactMaterial(
      wallMaterialCannon,
      ballMaterial,
      {
        friction: 0.5,
        restitution: 0.7,
      }
    );
    world.addContactMaterial(wallBallContactMaterial);
  });
};

createWalls();

/**
 * ボール生成
 * @param {X,Y,Z座標} position
 * @param {ボールタイプインデックス} typeIndex
 */
const createBallSphere = (position, typeIndex) => {
  const radius = BALL_TYPES[typeIndex].radius;
  const color = BALL_TYPES[typeIndex].color;
  // 質量は体積と比例する（重さの概念を近似）
  // 密度を1と仮定するので、質量 = 体積 * 1
  // Volume = (4/3) * PI * r^3
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const mass = volume;

  // Three.js
  const geometry = new THREE.SphereGeometry(radius, 32, 32);

  const material = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.3,
    roughness: 0.4,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.position.copy(position);
  scene.add(mesh);

  // Cannon.js
  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({
    mass: mass,
    shape: shape,
    material: ballMaterial,
  });
  body.position.copy(position);
  body.gameType = typeIndex;

  // 某果物ゲームのロジック
  // 衝突イベントリスナー
  body.addEventListener('collide', (e) => {
    // 衝突したボールと次のレベルのボールであるかチェック
    if (e.body.gameType !== undefined && typeIndex < BALL_TYPES.length - 1) {
      if (e.body.gameType === typeIndex) {
        // IDを小さい方で処理する
        if (body.id < e.body.id) {
          // 中点を計算して新しい生成位置を決定
          const pos1 = body.position;
          const pos2 = e.body.position;
          const midX = (pos1.x + pos2.x) / 2;
          const midY = (pos1.y + pos2.y) / 2;
          const midZ = (pos1.z + pos2.z) / 2;

          // 新しいボールを誕生リストに追加
          ballsToSpawn.push({
            position: { x: midX, y: midY, z: midZ },
            typeIndex: typeIndex + 1
          });

          // 削除対象リストに追加
          ballsToRemove.add(body);
          ballsToRemove.add(e.body);
        }
      }
    }
  });

  world.addBody(body);

  // 物理オブジェクトを更新用配列に追加
  objectsToUpdate.push({ mesh, body, type: typeIndex });
};

// --- 判定 ---

// ランダムな位置にランダムなタイプのボールを生成
const createRandomBall = () => {
  // 床上部のランダムな位置
  const maxRadius = 1.0;
  // 床の中心を含む範囲を確保
  const range = Math.max(0, CONFIG.floorSize - (maxRadius * 2));

  const x = (Math.random() - 0.5) * range;
  const z = (Math.random() - 0.5) * range;
  const y = CONFIG.ballSpawnHeight;

  // ボール生成
  const randLength = 3;
  const typeIndex = Math.floor(Math.random() * randLength);
  createBallSphere({ x, y, z }, typeIndex);

  // UI更新
  const spawnInfo = document.getElementById('spawn-info');
  if (spawnInfo) {
    spawnInfo.textContent = `Last Spawn: X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}, Z: ${z.toFixed(2)}, Type: ${typeIndex}`;
  }
};

// 1秒ごとにランダムなボールを生成
setInterval(createRandomBall, 1000);

// 文字表示設定
const infoDiv = document.createElement('div');
infoDiv.style.position = 'absolute';
infoDiv.style.top = '10px';
infoDiv.style.left = '10px';
infoDiv.style.color = 'white';
infoDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
infoDiv.style.padding = '10px';
infoDiv.style.borderRadius = '5px';
infoDiv.style.pointerEvents = 'none';
infoDiv.innerHTML = `
  <h3>A Fruits Game Simulation</h3>
  <p id="ball-count">Balls: 0</p>
  <p id="spawn-info" style="font-family: monospace; margin-top: 10px;">Last Spawn: -</p>
`;
document.body.appendChild(infoDiv);

// --- アニメーションループ ---
const clock = new THREE.Clock();
let oldElapsedTime = 0;

// メインループ
const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  // 衝突による削除処理
  if (ballsToRemove.size > 0) {
    ballsToRemove.forEach(bodyToRemove => {
      // 物理オブジェクトを検索する
      const index = objectsToUpdate.findIndex(obj => obj.body === bodyToRemove);
      if (index !== -1) {
        const object = objectsToUpdate[index];

        // 可視化の削除
        scene.remove(object.mesh);
        object.mesh.geometry.dispose();
        object.mesh.material.dispose();

        // 物理世界の削除
        world.removeBody(object.body);

        // 配列から削除
        objectsToUpdate.splice(index, 1);
      }
    });
    ballsToRemove.clear();
  }

  // 新しいボールの生成（融合）
  if (ballsToSpawn.length > 0) {
    ballsToSpawn.forEach(spawnData => {
      createBallSphere(spawnData.position, spawnData.typeIndex);
    });
    ballsToSpawn.length = 0; // 配列を空にする
  }

  // 物理世界の更新
  // 物理の一貫性を保つために固定時間ステップを使用
  world.step(1 / 60, deltaTime, 3);

  // 状態更新は同期処理
  for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
    const object = objectsToUpdate[i];

    // エリア外判定
    // 制限は床の半分のサイズ+壁の厚さ（外縁）
    const limit = CONFIG.floorSize / 2 + CONFIG.wallThickness;
    const pos = object.body.position;

    // 壁の外側かつ「床の上」にある（または下に落ちた）ほど低い位置にある場合
    if ((Math.abs(pos.x) > limit || Math.abs(pos.z) > limit) && pos.y < 2.0) {
      // 可視化の削除
      scene.remove(object.mesh);
      object.mesh.geometry.dispose();
      object.mesh.material.dispose();

      // 物理世界の削除
      world.removeBody(object.body);

      // 配列から削除
      objectsToUpdate.splice(i, 1);
    } else {
      // まだ生きている場合は位置を更新
      object.mesh.position.copy(object.body.position);
      object.mesh.quaternion.copy(object.body.quaternion);
    }
  }
  // ボールの個数を表示
  const ballCount = objectsToUpdate.length;
  const ballCountElement = document.getElementById('ball-count');
  if (ballCountElement) {
    ballCountElement.textContent = `Balls: ${ballCount}`;
  }

  // 描画
  renderer.render(scene, camera);

  window.requestAnimationFrame(tick);
};

tick();

// ウィンドウリサイズ時イベント
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; // アスペクト比の更新
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); // レンダラーのサイズ更新
});
