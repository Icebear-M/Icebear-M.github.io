"use strict";
// import * as Welcome from './welcome.js'

const debug = import.meta.env.VITE_DEBUG === 'true';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'; // To render clean text on top of sheep

import { MathUtils } from 'three';  // Camera math

let camera, scene, renderer, labelRenderer;
const target_fov = 50;
const planeAspectRatio = 3/3;

const updateClock = new THREE.Clock() // Controlls how far the shepherd can move per update. 
const playClock = new THREE.Clock()

playClock.autoStart = false;

const loader = new GLTFLoader(); 
var sheep_model = new THREE.Object3D();
var shepherd_model = new THREE.Object3D();

const player = {};

const raycaster = new THREE.Raycaster();    // Floor is on layer 1
raycaster.layers.set( 1 ); 
const pointer = new THREE.Vector2();

var debugCube = new THREE.Mesh();
var arrowHelper = new THREE.ArrowHelper();

let pausedTime = 0;

var elapsedPlayTime = 0;

function updateUi() {
    const elapsedTime = playClock.getElapsedTime() + elapsedPlayTime;
    document.getElementById("timer").innerHTML = "Timer: " + Math.round(elapsedTime);
}

export function playGame() {
    if (!playClock.running) {
        playClock.start();
        gameState.game_timer = playClock;

        updateUi();
    }

    updateClock.start()
    gameState.runState = "running"

    document.getElementById("game").addEventListener( 'pointermove', updatePointerPos ) 
    document.getElementById("game").addEventListener( 'click',  updatePointerAndMove)  // Click should allways update the moveTarget, but sometimes doesn't trip the event.buttons check. 

    animate()
}

export function pauseGame() {
    if (playClock && playClock.running) {
        pausedTime = playClock.getElapsedTime(); // Store the elapsed time before pausing
        playClock.stop();

    }


    updateClock.stop()
    gameState.runState = "paused"

    document.getElementById("game").removeEventListener( 'pointermove', updatePointerPos )
    document.getElementById("game").removeEventListener( 'click',  updatePointerAndMove)
}

export function resumeGame() {

    elapsedPlayTime += playClock.getElapsedTime()
    playClock.start();

    document.getElementById("game").addEventListener( 'pointermove', updatePointerPos ) 
    document.getElementById("game").addEventListener( 'click',  updatePointerAndMove)  // Click should allways update the moveTarget, but sometimes doesn't trip the event.buttons check. 

    updateClock.start()
    gameState.runState = "running"
    animate()
}

export function stopGame() {
    pauseGame()
    updateClock.stop()
    gameState.runState = "stopped"

    playClock.stop();
    playClock.elapsedTime = 0;

    elapsedPlayTime = 0;

    updateUi();
}

export var gameState = {
    game_timer: playClock,
    runState: "stopped"
};

// Game Setup
async function game_init() {

    camera = new THREE.PerspectiveCamera( target_fov, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(0, 20, 20);
    camera.layers.enableAll();  // Raycast plane on layer 1, we can make a pretty floor later and then hide layer 1. 
    camera.rotation.x = 1.762 * Math.PI;

    recalculateCameraFov();

    scene = new THREE.Scene();
    // scene.background = new THREE.Color( 0x9fe5a3 );

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: document.getElementById("game_canvas"),
        alpha: true,
    });

    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap    

    labelRenderer = new CSS2DRenderer({element: document.getElementById("game_lables_canvas")});
    labelRenderer.setSize( window.innerWidth, window.innerHeight );
    // labelRenderer.domElement.style.position = 'absolute';
    // labelRenderer.domElement.style.top = '0px';

    environment_setup()
    await loadGltfModels()

    // TODO: Make a "Start/Restart game" functions
    // They should also start and stop the main animate loop. 
    initGameState()
    initPlayer()

    updateDisplayBoard();

    console.log("done loading")
    updateClock.start()

    // TMP. Sheep spawning should be handeled by the game logic, not on world init. 
    spawnNewSheepWave();

    animate();
}

function initGameState() {
    const verseString = "In the beginning was the Word, and the Word was with God, and the Word was God. John 1:1"
    gameState.verseString = verseString;
    gameState.verse = verseString.split(" ");
    gameState.collectedSheep = [];
    gameState.lostSheep = [];
}

function initPlayer() {
    // Set up player object, spawns the shepheard
    shepherd_model.rotation.set(0, 0, 0) // Sanity resets
    shepherd_model.position.set(0, 0, 0)

    player.position = shepherd_model.position; // Y should allways be 0 :)
    player.rotation = shepherd_model.rotation;
    player.model = shepherd_model;
    player.lookTarget = new THREE.Vector3(0, 0, 0);
    player.moveTarget = new THREE.Vector3(0, 0, 0);

    scene.add(shepherd_model)
}

async function loadGltfModels() {
    // Sheep. Sheep are spawned by spawnSheep()
    await loader.loadAsync( 'Sheep.glb' )
        .then(function(gltf) {
            sheep_model = gltf.scene
            sheep_model.name = 'sheep'
            sheep_model.traverse( function( node ) {
                if ( node.isMesh ) { node.castShadow = true; }
            } );
        });
    // Shepherd. Shepherd model is spawned by initPlayer. 
    await loader.loadAsync( 'Shepherd.glb' )
        .then(function(gltf) {
            shepherd_model = gltf.scene
            shepherd_model.name = 'sheep'
            shepherd_model.traverse( function( node ) {
                if ( node.isMesh ) { node.castShadow = true; }
            } );
        });

    await loader.loadAsync( 'grass.glb' )
        .then(function(gltf) {
            shepherd_model = gltf.scene
            shepherd_model.name = 'grass'
            shepherd_model.traverse( function( node ) {
                if ( node.isMesh ) { node.castShadow = true; }
            } );
    });

}

function environment_setup() {
    // lights

    const hemisphereLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, 2 );
    scene.add( hemisphereLight );
    
    const directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );
    directionalLight.position.x = 10
    directionalLight.position.y = 10
    directionalLight.position.z = 5

    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;

    directionalLight.shadow.camera.top = 16;
    directionalLight.shadow.camera.bottom = -16;
    directionalLight.shadow.camera.left = -16;
    directionalLight.shadow.camera.right = 16;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;

    scene.add( directionalLight );

    // const helper = new THREE.CameraHelper( directionalLight.shadow.camera );
    // scene.add( helper );

    const plane_geometry = new THREE.PlaneGeometry(25, 13);
    // Set the transparent property to true and adjust the opacity
    const plane_material = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0 });
    const floor = new THREE.Mesh(plane_geometry, plane_material);
    floor.rotation.x = -0.5 * Math.PI;
    floor.receiveShadow = true;
    floor.name = "floor";
    floor.layers.set(1);
    scene.add(floor);
    
    const debugCube_geometry = new THREE.BoxGeometry( 0.5, 0.01, 0.5 );
    const debugCube_material = new THREE.MeshStandardMaterial( { color: 0xff0000, transparent: true, opacity: 0 } );
    debugCube = new THREE.Mesh( debugCube_geometry, debugCube_material );
    debugCube.castShadow = true;
    if (debug) {
        scene.add( debugCube );
    }

    arrowHelper = new THREE.ArrowHelper( 
        debugCube.position, 
        new THREE.Vector3(0,0,0), 
        2, 
        0xff0000
    );
    if (debug) {
        scene.add( arrowHelper );
    }
    
}

function recalculateCameraFov() {
    camera.aspect = window.innerWidth / window.innerHeight;

    if (camera.aspect > planeAspectRatio) {
		// window too large
		camera.fov = target_fov;
	} else {
		// window too narrow
		const cameraHeight = Math.tan(MathUtils.degToRad(target_fov / 2));
		const ratio = camera.aspect / planeAspectRatio;
		const newCameraHeight = cameraHeight / ratio;
		camera.fov = MathUtils.radToDeg(Math.atan(newCameraHeight)) * 2;
	}

    camera.updateProjectionMatrix();
}

// Event listeners
function resizeCanvas() {
    recalculateCameraFov()
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resizeCanvas, false);

function updatePointerPos( event ) {
	pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    const target = pointerToFloorPos() // can be null
    
    if (target) {
        player.lookTarget.setX(target.x);
        player.lookTarget.setY(0);
        player.lookTarget.setZ(target.z);
    }

    if (event.buttons % 2 == 1) {  // Buttons is odd, so M1 is pressed. (or finger is down.)
        setmoveTarget(event)
    }
}
function setmoveTarget() {
    player.moveTarget = player.lookTarget.clone()
    debugCube.position.setX(player.lookTarget.x);
    debugCube.position.setZ(player.lookTarget.z);
}

function updatePointerAndMove(event) {
    updatePointerPos(event); 
    setmoveTarget();
}


// Spawners
function spawnSheep(position, text = "Sheep #" + Math.round(Math.random()*100)) {
    // TODO: Turn sheep into an object or whatever and put into a list of "loose sheep" or
    // whatever so that we can keep track of it later. When shepherd collects the sheep, move
    // sheep to a "found" list, so that we can keep track of them all. 
    const newSheep = sheep_model.clone(); 

    newSheep.userData.text = text;

    const sheepLabelDiv = document.createElement( 'div' );
    sheepLabelDiv.className = 'game_sheep_label';
    sheepLabelDiv.textContent = newSheep.userData.text;

    const sheepLabel = new CSS2DObject( sheepLabelDiv );
    sheepLabel.position.set( 0, 0.5, 0 );
    sheepLabel.center.set( 0.5, 1 );
    newSheep.add( sheepLabel );
    sheepLabel.layers.set( 0 );
    
    newSheep.userData.CSS2DObject = sheepLabel

    if (!position) {
        // Gives the sheep a random position, Centered at 0,0,0, and then multiplied by 20, 0, 20 to scatter accrost the board. 
        newSheep.position.random().addScalar(-0.5).setY(0).multiplyScalar(13)
    }

    newSheep.rotation.y = (2*Math.PI)*Math.random()

    scene.add(newSheep)

    // console.log(newSheep)
    return newSheep
}

function deleteSheep(sheep) {
    sheep.remove(sheep.userData.CSS2DObject)
    scene.remove(sheep)
}

function spawnNewSheepWave() {
    gameState.lostSheep.forEach(sheep => {
        // deconstruct all currently on screen sheep. 
        deleteSheep(sheep)
        // TODO! Double check this isn't leaving oodles of loose sheep in memory. 
    });

    gameState.lostSheep = []
    
    if (!(gameState.collectedSheep.length == gameState.verse.length)) {
        //TMP: don't spawn more sheep if there are no more words to find. 
        // This should probably be handled by some win condition checker. and just don't 
        // spawn a next wave if there's no next wave to spawn
        
        const numSheepPerWave = 3 

        // initial correct sheep. 
        gameState.lostSheep.push( spawnSheep(null, gameState.verse[gameState.collectedSheep.length] ) )

        // Spawn distraction sheep. 
        for (var i = 1; i < numSheepPerWave; i++) {
            gameState.lostSheep.push(spawnSheep())
        }
    }
}


function moveObjTowardsPoint(delta, obj, moveTarget, lookTarget, followDistanceSquared) {  // returns if object moved
    const maxSpeed = 5;
    // TODO: Keep tack of accelaration for smoother motion. 
    const distToMoveTarget = obj.position.distanceToSquared( moveTarget )
    if ( distToMoveTarget > followDistanceSquared) {

        // player.rotation.y = player.position.angleTo(new THREE.Vector3(30, 0, 0))
        // console.log(player.position.angleTo(new THREE.Vector3(1, 0, 0)))

        obj.lookAt(moveTarget)

        const deltaAjustedSpeed = maxSpeed * Math.min(delta, 1) // Maximum distance to move this update. ≈ 10 units per second. 

        const moveVec = moveTarget.clone();  // Gotta clone this, or else we modify moveTarget. 
        moveVec.sub(obj.position);               // make reletive to player position. (player is effectively at 0,0)
        moveVec.clampLength(0, deltaAjustedSpeed);  // Shrink movement vector to fit within max speed. 
        obj.position.add(moveVec);               // Apply to player pos

        // Move sheep to follow shepherd (or parrent sheep. )

        return true
    } else { 
        // Shepherd is not moving. 
        obj.lookAt(lookTarget)
        return false
    }
}

// Game logic / animation
function updateGame() {
    // GAME UPDATE IS NOT CALLED AT A REGULAR INTERVAL. 
    // Use updateClock to see how much time has passed since last update.
    // Use playClock for on screen timers and whatever. 

    const delta = updateClock.getDelta() // time since last update call in seconds. 

    arrowHelper.position.set(player.position.x, player.position.y, player.position.z)
    arrowHelper.setDirection(player.lookTarget.clone().sub(player.position))
    arrowHelper.setLength( Math.min(2, player.position.distanceTo( player.lookTarget )) ,0.5 , 0.2);

    const shepherdMoved = moveObjTowardsPoint(delta, player.model, player.moveTarget, player.lookTarget, 0.1);
    if (!shepherdMoved) { // Shepherd is not moving. 
        
        // See if we stopped on a sheep. 
        if (gameState.lostSheep.length != 0) {
            var nearbySheep = [];
            var correctSheep = null;

            const nextCorrectWord = gameState.verse[gameState.collectedSheep.length]
            for (var i in gameState.lostSheep) {
                const sheep = gameState.lostSheep[i]
                if (player.position.distanceToSquared(sheep.position) < (0.75)) {
                    if (sheep.userData.text == nextCorrectWord) {
                        // Oh hey, this is the correct sheep
                        console.log("NEAR RIGHT SHEEP")
                        correctSheep = sheep; 
                        gameState.lostSheep.splice(i,1) // remove correct from lost sheep. 
                        collectSheep(sheep)
                        spawnNewSheepWave();
                        break; 
                    }
                    nearbySheep.push(sheep)
                }
            }
            if (!nearbySheep.length == 0 && correctSheep == null) {
                // We're near sheep, but we did not find the correct one. So we must be near a wolf. 
                // Pick a random nearby sheep and 
                // 
                // var correctSheep = null;
                // for (var sheep of nearbySheep) {
                //     if (sheep.userData.text == nextCorrectWord) {
                //         correctSheep = sheep
                //         break; 
                //     }
                // }
                // if (correctSheep != null) {
                //     console.log("CORRECT SHEEP")
                // } else {
                    console.log("None of the nearby sheep are correct")
                // }
            }
        }
    }

    // Move collected sheep to shepherd
    for (const i in gameState.collectedSheep) {
        const sheep = gameState.collectedSheep[i]

        const targetPos = ((i == 0) ? player.position : gameState.collectedSheep[i-1].position)
        // console.log(sheep.userData.text)
        // console.log(targetPos)

        moveObjTowardsPoint(delta, sheep, targetPos, targetPos, 2);
        // console.log(sheep.position)

    }
}

function collectSheep(sheep) {
    gameState.collectedSheep.push(sheep);
    updateDisplayBoard();
}

// This is the display board function
function updateDisplayBoard(){
    const displayBoard = document.querySelector('.displayBoard');
    displayBoard.innerHTML = ''; // Clear previous content

    for (const sheep of gameState.collectedSheep) {
        const sheepWord = sheep.userData.text;
        const sheepElement = document.createElement('div');
        sheepElement.classList.add('displayedSheep');
        sheepElement.textContent = sheepWord;

        displayBoard.appendChild(sheepElement);
    }
}

// Controls
function pointerToFloorPos() {
    raycaster.setFromCamera( pointer, camera );
    const intersects = raycaster.intersectObjects( scene.children );

    // console.log("intersections")
    
    for ( let i = 0; i < intersects.length; i ++ ) {
        
        if (intersects[i].object.name == "floor") {
            // console.log(intersects[i].point)
            const floor_point = intersects[i].point
            floor_point.setY(0)
            return floor_point
        }
	}
    return null
}


function animate( time ) {
    if (gameState.runState != "running") {
        return
    }

    updateGame()
    updateUi()

	renderer.render( scene, camera );
    labelRenderer.render( scene, camera );

    requestAnimationFrame( animate );   // re-call animate every (animatable) frame. Logic shouldn't go here, since it'll run faster or slower of different devices
}
game_init();