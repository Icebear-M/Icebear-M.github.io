"use strict";

// --- Imports ---
import * as THREE from 'three'; // primary THREE JS library
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';    // To load GLB files (exported from blender)
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'; // To render clean text on top of sheep

import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'; // To place sheep randomly on the playspace. 

import { brill /*, descriptions*/ } from 'brill'; // Parts of speach lookup object. Used to build distraction words
    // Brill also has a descriptions object that converts the POS shorthand to full descriptions

// --- Globals setup ---
// Render nececities
var renderer;       // renders 3d environment to canvas
var labelRenderer;  // renders sheep text by spawning div elements
var camera, scene;  // Both renderers share the same scene and camera. 

// Clocks
const updateClock = new THREE.Clock();  // Controls update delta. DO NOT USE OUTSIDE OF `updateGame()`!
const playClock = new THREE.Clock();    // controls the user-facing timer in the UI. 
playClock.autoStart = false;
var elapsedPlayTime = 0;                // This acumulates how much time was on the timer when we stop it when pausing the game.
    // ↑ Play timer resets to 0 when stopped, and there's now way to just "pause" it. this lets us fake a pause. 

// Objects
const loader = new GLTFLoader(); 
// Objects are placed in the scene on init. These vars are shorthands. 
var sheep_model;     // Spawned with spawnSheep()
var shepherd_model;  // Controled through Player object
var floor_model;     // The entire GLTF for the grass and raycast objects
var floor_raycast;   // The "Playspace". drives sheep spawns and where player can move. Invisible to camera
var wolf_model;      // ""spawned"" with spawnWolf(). (Different from spawn sheep. see fn for details)

var playspace_group = {};   // holds the raycast playspace and the fence. Used to shrink both if game window is too narrow. 
var playspace_width_multiplier = 1; // The actual multiplier to scale the width by. Usualy ≤ 1. 

// Old debug objects
var debugCube = new THREE.Mesh();           // Visualized raycast intersection
var arrowHelper = new THREE.ArrowHelper();  // Visualized diretion to shepherd's look target

// Playspace object smarts
const raycaster = new THREE.Raycaster();    // Raycaster to translate mouse clicks to in-world positions
raycaster.layers.set( 1 );                  // Floor raycast receiver is on layer 1
const pointer = new THREE.Vector2();        // mouse/touch position on 2D screen

var playspaceSurfaceSampler = undefined;    // Gives us random positions on the playspace. Needs to be constructed after playspace is loaded. 

// Sounds
var gameAudioContext = undefined;           // Audio context. Welcome.js already has one, but to lazy to pass them arround. let's just make 2. 
var sfx = {};                               // Collection of sounds. See makeAudioContext()

// Game data
const player = {};  // Shorthand object. See initPlayer

// All the game logic data. Exported for use in welcome.js. See initGameState()
export var gameState = {
    runState: "stopped",
    gameInitialized: false,
    game_timer: playClock,
};

// --- Game Control Functions ---
const deviceIsPhone = ( // boolian. Used to control fulscreen functionality. 
    (   (navigator.userAgentData ? navigator.userAgentData.mobile : false) 
        || /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) 
            // navigator.userAgentData is not well supported yet, but should be more reliable in the long-term
    ) ? true : false
)


function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
    
    if (screen.orientation.lock) {
        // Mostly a fix for Firefox Mobile. 
        // Firefox assumes that when you fullscreen like this, you're watching a video and goes landscape.
        // This should™ force all browsers to play the game in portrait mode if they have the option. 
        // However in practice, it mostly just prevents Firefox from forcing landscape. 

        // Firefox is still goofy about this anyways :(
        screen.orientation.lock("portrait");
    }
    // document.getElementById("counter").innerHTML = "HERE"
}

// ↓ THIS FUNCTION NAME IS A LIE. It does not exit full screen, but it probably should. 
function exitFullscreen(){
    // if (document.exitFullscreen) {
    //     document.exitFullscreen();
    // } else if (document.webkitExitFullscreen) { /* Safari */
    //     document.webkitExitFullscreen();
    // } else if (document.msExitFullscreen) { /* IE11 */
    //     document.msExitFullscreen();
    // }
    
    // ↑ tmp. ↑ Phone's won't unfullscreen on exit. because to reset the game, we do stop then 
    // start, which blinks the fullscreen state on the phone. 

    if (screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

// Game now takes like 1½ seconds to initilize, so a speedy user might click play before we are ready. 
// if gameState.gameInitialized is null or undefined or whatever, await this function, it will return when
// the game is ready. 
export async function waitForGameInitialization() {
    return new Promise((resolve) => {
        const checkInitialization = () => {
            if (gameState.gameInitialized) {
                resolve();
            } else {
                setTimeout(checkInitialization, 100); // Check every 100 milliseconds
            }
        };
        checkInitialization();
    });
}

export async function playGame() {
    if (!gameState.gameInitialized) {
        console.log("PlayGame was called before game was done initilizing.")
        await waitForGameInitialization()
        console.log("Game is initilized. Resuming playGame().")
    }

    if (deviceIsPhone) { enterFullscreen() }

    if (gameState.collectedSheep.length != gameState.verse.length) {
        playClock.start();
    }
    updateUi();

    updateClock.start()
    gameState.runState = "running"

    spawnNewSheepWave();

    startInputListeners()

    animate()
}

export function pauseGame() {
    playClock.stop();
    updateClock.stop()
    gameState.runState = "paused"

    pauseInputListeners()
}

export function resumeGame() {

    if (gameState.collectedSheep.length != gameState.verse.length) {
        elapsedPlayTime += playClock.getElapsedTime()
        playClock.start();
    }
    updateUi();

    startInputListeners()

    updateClock.start()
    gameState.runState = "running"
    animate()
}

export async function stopGame() {

    if (deviceIsPhone) { exitFullscreen() }

    pauseGame()
    updateClock.stop()
    gameState.runState = "stopped"

    playClock.stop();
    playClock.elapsedTime = 0;

    elapsedPlayTime = 0;

    updateUi();

    initPlayer();
    await initGameState();
    // resetScoreAndCounter();
    updateDisplayBoard();
}

// --- Game Initialization ---
async function gameInit() {
    // This function is called once at the end of this script. 

    // Set up three.js world and camera:
    camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set(0, 18, 20);
    camera.layers.disable(1);   // The raycast object is on layer 1. It should be invisable anyways, but now we won't render it at all. 
    camera.rotation.x = 1.762 * Math.PI;

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: document.getElementById("game_canvas"),
        alpha: true,
    });
    renderer.setPixelRatio( window.devicePixelRatio );              // See also: resizeCanvas()
    renderer.setSize( window.innerWidth, window.innerHeight );

    renderer.shadowMap.enabled = true;              // Individual objects need to be told to cast shadows too. See loadGltfModels(). 
    renderer.shadowMap.type = THREE.VSMShadowMap    // Other shadow maps caused artifacts with grass. 

    renderer.toneMapping = THREE.AgXToneMapping     // Same tone mapper as Blender. Works well with bright lights compared to default. 

    labelRenderer = new CSS2DRenderer({element: document.getElementById("game_labels_canvas")});
    labelRenderer.setSize( window.innerWidth, window.innerHeight ); // Again, see also: resizeCanvas()

    await loadGltfModels()
    environment_setup()
    
    playspaceSurfaceSampler = new MeshSurfaceSampler( floor_raycast ).build()   
    // Getting a strange behavior out of this with the resized playspace. Just 
    // in case, We'll build it before we do any scailing to the floor_raycast, 
    // and we'll unscale sample locations when we ask for them. 
    resizePlaySpace()

    await initGameState()
    initPlayer()

    updateDisplayBoard();
    resetScoreAndCounter();

    console.log("done loading")
    gameState.gameInitialized = true;

    // update play button
    const playGameButton = document.querySelector('.btnInstruction-popup')
    playGameButton.classList.remove("loading")
    playGameButton.textContent = "Play Game!"
    if (import.meta.env.VITE_SKIPWELCOME === 'true') { 
        console.log("Skipping welcome screen")
        playGameButton.click() 
    }
}

async function initGameState() {
    // This function is also used to reset the gamestate object when starting a new game
    if (gameState.collectedSheep) {
        for (const sheep of gameState.collectedSheep) {
            deleteSheep(sheep);
        };
    }
    
    if (gameState.lostSheep) {
        for (const sheep of gameState.lostSheep) {
            deleteSheep(sheep);
        };
    }
    
    // const passage = await passageInit();    // null or "debug" for debug message.
    // see also: `VITE_CUSTOMREFERENCE` environment var
    const passage = await passageInit("John 1:1");

    gameState.counter = 0,
    gameState.score = 0,
    gameState.passage = passage
    // const verseString = passage.passageText;
    gameState.verseString = passage.passageText;
    gameState.verse = passage.passageText.split(" ");
    gameState.collectedSheep = [];
    gameState.lostSheep = [];
}

function makeAudioContext() {
    gameAudioContext = new (window.AudioContext || window.webkitAudioContext)();

    sfx.correctGuess = new Audio("correct_sheep_sooner.mp3");
    sfx.winningGuess = new Audio("victory.mp3");
    sfx.incorrectGuess = new Audio("wolf_louder.mp3");
}

async function fetchPassageFromAPI(reference) {
    // So this project is suposed to have it's own backend. But we haven't really 
    // been given info on how to actualy interact with it. So for right now, 
    // we're using this free API provided by `https://bolls.life`. 
    // TODO: Swap this API code with _our_ api code. Talk to Dr. Drandle about this. 

    // To future developer integrating this app into the future API, Make sure
    // this function returns this object. 
    var passageObject = {
        reference: "",      // String form of reference. EG: "John 1:1-3"
        passageText: "",    // REQUIRED: Final string to test the user on
        contextText: "",    // REQUIRED: Entire chapter / surounding chapters of test verse. Used to power the distraction word chooser
        
            // ↓ built by this function. You can also pass this object to this function
            // and it should™ skip some of the processing done by this function. 
        // book: null,                  // name of book in string
        // bookId: null,                // ID of book, for use with API
        // chapterStart: null,          // The first chapter in this passage. Might be the only chapter.
        // chapterEnd: null,            // The last chapter in this passage. Can be null, where only the start chapter will be used
        // verseStart: null,            // The first verse in this passage. Might be the only verse
        // verseEnd: null,              // The last verse in this passage. Can be null, where only the start verse will be used
        // translation: null
    };

    if (import.meta.env.VITE_CUSTOMREFERENCE) { reference = import.meta.env.VITE_CUSTOMREFERENCE }

    // Figure out what to pull from the API
    if (import.meta.env.VITE_DEBUGPASSAGE === 'true' || !reference || reference == "debug") {
        // reference is unset. 
        console.log("Setting debug passage");
        passageObject.reference = "The Book of Debugging 20:24"
        passageObject.passageText = "This is the test sentence.";
        passageObject.contextText = "Here is the context to the test sentence. This is the test sentence. Did you miss it? The test sentance was right there! Well, I thought it was cool. Maybe we'll see it again.";
        return passageObject;
    };

    if (typeof reference === 'string' || reference instanceof String) {
        // build initial passage object from basic string

        passageObject.reference = reference;

        // matches strings like "Mark 5:3", "1st John 1:2-5", and "Song of Solomon 12:34-56:78 NIV"
        // Splits string it into named groups like book, startVerse, translation, etc. 
        // can break if too many spaces are in a row.
        const regex = /(?<book>.*?)\s?(?<startChapter>\d+)\s?:\s?(?<startVerse>\d+)\s?-?\s?(?<afterDash>\d+)?\s?:?\s?(?<endVerse>\d+)?\s?(?<translation>[^\s]*)?/gi ;

        const match = regex.exec(reference);
        if (match) {
            passageObject.book = match.groups.book
            passageObject.chapterStart = Number(match.groups.startChapter)
            passageObject.verseStart = Number(match.groups.startVerse)

            if (!match.groups.endVerse) {
                // if match.groups.endVerse is undefined, then there was no 2nd `:`
                // eg: `Mark 2:1-5`. This means anything after the dash is actualy 
                // our second verse marker. (if there is anything after the -)
                passageObject.verseEnd = Number(match.groups.afterDash);
            } else {
                passageObject.chapterEnd = Number(match.groups.afterDash);
                passageObject.verseEnd = Number(match.groups.endVerse);
            }

            passageObject.translation = match.groups.translation || "ESV";

        } else {
            throw new Error("Reference string did not match expected reference pattern");
        }
    } else {
        // going to just assume the reference is an object matching passageObject's format and hope it doesn't explode
        passageObject = reference
    }
    
    // We should have our target ranges set up and stored in the passageObject. 
    // const-ifying the insides to make code later smaller.
    
    const bookName     = passageObject.book;
    const chapterStart = passageObject.chapterStart;
    const chapterEnd   = passageObject.chapterEnd;  // CAN BE NULL
    const verseStart   = passageObject.verseStart;
    const verseEnd     = passageObject.verseEnd;    // CAN BE NULL
    const translation  = passageObject.translation; // Valid versions can be found here → https://bolls.life/static/bolls/app/views/languages.json

    // validation    
    if (chapterEnd != null && chapterEnd < chapterStart) { throw new Error("End chapter is earlier than start chapter. \nStart Chapter: "+chapterStart+"\nEnd Chapter: "+chapterEnd); }
    if (chapterEnd == null && verseEnd < verseStart) { throw new Error("End verse is earlier than start verse. \nStart Verse: "+verseStart+"\nEnd Verse: "+verseEnd); }
    if (!chapterStart) { throw new Error("chapterStart not set") }
    if (!verseStart) { throw new Error("verseStart not set") }
    if (chapterEnd != null && verseEnd == null) { throw new Error("verseEnd not set (Even though endChapter is set to "+chapterEnd+").") }
    
    var bookId = passageObject.bookId;  // very likely to be null
    var numChaptersInBook = null;

    // Check if API has selected translation, and if translation has selected Book. 
    const translationsListPromise = fetch('https://bolls.life/static/bolls/app/views/translations_books.json', {
        method: 'GET',
        // headers: {
        //     'Cache-Control': 'max-age=86400', // 86400 seconds = 24 hours
        // },
        cache: "force-cache",
    })
        .then((response) => { return response.json() })
        .then((translationsList) => {
            if (!translationsList[translation]) { throw new Error("No treanslation "+translation) }
            return translationsList;
        })

    if (!bookId) {
        // book ID not set. Wait for the translations test to come back
        // and find out what bookId we need to get
        const translationList = await translationsListPromise;

        for (const book of translationList[translation] ) {
            if (book.name == bookName) {
                bookId = book.bookid;
                numChaptersInBook = book.chapters;
                break;
            }
        }
        if (!bookId) { throw new Error("Book ID not found for book `"+bookName+"` in translation `"+translation+"`."); }
        
        passageObject.bookId = bookId;
    }

    // By now, bookId is valid, and number of chapters is valid. 
    // Validate chapters fit in book
    //TODO NUMBER OF CHAPTERS SET INSIDE BOOK ID GETTER SO IF ID IS GIVER, THIS WILL BE NULL FIXME PLZ kthxbai :)
    if (chapterStart <= 0 || chapterStart > numChaptersInBook || (chapterEnd != null && (chapterEnd <= 0 || chapterEnd > numChaptersInBook))) { 
        throw new Error("Chapter selection out of range. (asked for "
            +chapterStart+(chapterEnd != null ? ("-"+chapterEnd) : "") 
            +". There are "+numChaptersInBook+" chapters in book ID "+bookId+")"
        ); 
    }

    // Request passage from API
    var mainPassageFetchPromises = [];
    // var contextPassageFetchPromises = [];
    for ( var chapterNumber = chapterStart; chapterNumber < (!chapterEnd? chapterStart : chapterEnd)+1; chapterNumber++) {
        const chapterPromise = fetch("https://bolls.life/get-text/"+translation+"/"+bookId+"/"+chapterNumber+"/", {
            // headers: {
            //     'Cache-Control': 'max-age=86400', // 86400 seconds = 24 hours
            // },
            cache: "force-cache",
        })
            .then((response) => { return response.json() })
        mainPassageFetchPromises.push( chapterPromise );
        // contextPassageFetchPromises.push( chapterPromise );
    }
    
    // Helper function :)
    function chapterArrayToString(chapters) {
        // boils down the chapters[chapter[verse{text}]] mess into one string. 
        const text = chapters
            .map( (chapter) => { 
                const verseText = chapter.map( (verse) => verse.text);
                return verseText.join(" ");
            })
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(); 
        return text;
    }

    // ↓ Removed! -- We Really don't need _this_ much extra context in most situations. ↓
    //                    But… we could set it up in a promise and just set-and-forget…

    // // Since we're here, Queue some extra data for the context passages too. 
    // if (chapterStart > 1) {
    //     contextPassageFetchPromises.push( 
    //         fetch("https://bolls.life/get-text/"+translation+"/"+bookId+"/"+(chapterStart-1)+"/")
    //             .then((response) => { return response.json() })
    //     );
    // }
    // if ((!chapterEnd ? chapterStart : chapterEnd) < numChaptersInBook) {
    //     contextPassageFetchPromises.push( 
    //         fetch("https://bolls.life/get-text/"+translation+"/"+bookId+"/"+((!chapterEnd ? chapterStart : chapterEnd)+1)+"/")
    //             .then((response) => { return response.json() })
    //     );
    // }

    // we queued up all the fetches, now let's wait for the important ones to finish. 
    const passageData = await Promise.all(mainPassageFetchPromises)

    // Turn incomming data into one big string. This will be used as 
    // context for the distraction words. 
    const contextPassageText = chapterArrayToString(passageData);

    // With the context data preserverd, let's get the part of the verse we actualy want to test the user on.
    // For multi-chapter passages, we can assume the start/end verses are in the start/end chapters. The
    // Chapters are stored in order, so we can just filter on the first and last chapter. 
    // This also works on single chapter passages, as the first and last chapter will be the same. 
    passageData[0] = passageData[0].filter((verse) => verse.verse >= verseStart);
    passageData[passageData.length-1] = passageData[passageData.length-1]
        .filter((verse) => verse.verse <= (!verseEnd? verseStart : verseEnd));

    // Textify!
    const passageText = chapterArrayToString(passageData);

    passageObject.passageText = passageText;
    passageObject.contextText = contextPassageText;

    return passageObject
}

function getBrillSafeWord(word) {
    const returnObj = {
        word: word,
        parts: []
    }
    
    returnObj.parts = brill[word]
    if (returnObj.parts) { return returnObj; };

    // Base word didn't appear in list. remove non-word punctuation and try again
    returnObj.word = word
        .replace(/[.,\/#!\?$%\^&\*;:{}=\_`~()“”‘’]/g,"")  // delete non-word punctuation
        .replace(/\s/g, "");    // delete spaces
    returnObj.parts = brill[returnObj.word]
    if (returnObj.parts) { return returnObj; };

    // Still didn't exit. Try removing like everything that isn't letters or numbers
    returnObj.word = word
        .replace(/[^\w\d]/g,"")
        .replace(/\s/g, "");  // delete spaces
    returnObj.parts = brill[returnObj.word]
    if (returnObj.parts) { return returnObj; };

    // Go back to first check, but also lowercase the whole thing
    returnObj.word = word
        .replace(/[.,\/#!\?$%\^&\*;:{}=\_`~()“”‘’]/g,"")  // delete non-word punctuation
        .replace(/\s/g, "")
        .toLowerCase();
    returnObj.parts = brill[returnObj.word]
    if (returnObj.parts) { return returnObj; };

    // Last try: do case 2 but also lowercase
    returnObj.word = word
        .replace(/[^\w\d]/g,"")
        .replace(/\s/g, "")
        .toLowerCase();
    returnObj.parts = brill[returnObj.word]
    if (returnObj.parts) { return returnObj; };

    // If none of these worked: This may be a proper noun or some other strage case
    returnObj.word = word
        .replace(/[^\w\d]/g,"")
        .replace(/\s/g, "");
    returnObj.parts = ["PROBLEM_CASE"];
    return returnObj;
}

async function passageInit(reference) {
    const passage = await fetchPassageFromAPI(reference);

    // build word to POS lookup
    passage.wordToPOSLookup = {};
    for (const contextWord of passage.contextText.split(" ")) {
        const wordAndParts = getBrillSafeWord(contextWord)
        if (!wordAndParts.word) { continue; }
        passage.wordToPOSLookup[wordAndParts.word] = wordAndParts.parts
    }
    
    // {Word = ["POS1", "POS2"]} → {POS → ["Word1", "Word2"]}
    passage.posToWordLookup = {};
    for (const word in passage.wordToPOSLookup) {
        if (!word) { continue; }
        for (const pos of passage.wordToPOSLookup[word]) {
            if (!passage.posToWordLookup[pos]) {
                passage.posToWordLookup[pos] = new Set();
            }
            passage.posToWordLookup[pos].add(word);
        }
    }

    return passage
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
            shepherd_model.name = 'shepherd'
            shepherd_model.traverse( function( node ) {
                if ( node.isMesh ) { node.castShadow = true; }
            } );
        });
    // Floor. Includes fence grass, and the playspace raycast object. 
    await loader.loadAsync( 'Floor.glb' )
        .then(function(gltf) {
            floor_model = gltf.scene
            floor_model.name = 'floor'
            floor_model.traverse( function( node ) {
                if ( node.isMesh ) { node.castShadow = true; node.receiveShadow = true; }
                if (node.name == "PlayspaceRaycast") {
                    floor_raycast = node; 
                    floor_raycast.layers.set(1);
                    node.castShadow = false;
                    node.receiveShadow = false;
                    playspace_group.raycaster = node;
                }
                if (node.name == "Fence") {
                    playspace_group.fence = node;
                    // node.scale.set(0.75, 1, 1)
                }
            } );
        });

    await loader.loadAsync('wolf.glb')
        .then(function(gltf) {
            wolf_model = gltf.scene;

            wolf_model.name = 'wolf'
            wolf_model.traverse( function( node ) {
                if ( node.isMesh ) { node.castShadow = true; node.receiveShadow = true; }
            } );
            // wolf_animations = gltf.animations;
        
            wolf_model.scale.set(1.6, 1.6, 1.6);
            wolf_model.position.y = -5;
        
            scene.add(wolf_model);
        
            wolf_model.userData.animationMixer = new THREE.AnimationMixer(wolf_model);
            wolf_model.userData.animationClips = gltf.animations
            wolf_model.userData.actions = {}

            // Play all animations at the same time
            gltf.animations.forEach(function(clip) {
                wolf_model.userData.actions[clip.name] = wolf_model.userData.animationMixer.clipAction(clip);
            });
        });
}

function environment_setup() {
    // lights

    const hemisphereLight = new THREE.HemisphereLight( 0xc2e3ff, 0x4f5fae, 2 );
    scene.add( hemisphereLight );
    
    const directionalLight = new THREE.DirectionalLight( 0xffbbdd, 5 );
    directionalLight.position.x = 10
    directionalLight.position.y = 10
    directionalLight.position.z = 5

    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 512;
    directionalLight.shadow.mapSize.height = 512;

    directionalLight.shadow.camera.top = 28;
    directionalLight.shadow.camera.bottom = -28;
    directionalLight.shadow.camera.left = -28;
    directionalLight.shadow.camera.right = 28;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;

    scene.add( directionalLight );

    // const helper = new THREE.CameraHelper( directionalLight.shadow.camera );
    // scene.add( helper );

    floor_raycast.layers.set(1);
    scene.add(floor_raycast)

    // scene.add(floorRaycastTarget);

    scene.add(floor_model);
    // scene.add(wolf_model);

    // wolf_model.position.set(0,2,0);
    // wolf_model.scale.set(1.5, 1.5, 1.5);

    const debugCube_geometry = new THREE.BoxGeometry( 0.5, 0.01, 0.5 );
    const debugCube_material = new THREE.MeshStandardMaterial( { color: 0xff0000, transparent: true, opacity: 0 } );
    debugCube = new THREE.Mesh( debugCube_geometry, debugCube_material );
    debugCube.castShadow = true;
    if (import.meta.env.VITE_DEBUGOBJECTS === 'true') {
        scene.add( debugCube );
    }

    arrowHelper = new THREE.ArrowHelper( 
        debugCube.position, 
        new THREE.Vector3(0,0,0), 
        2, 
        0xff0000
    );
    if (import.meta.env.VITE_DEBUGOBJECTS === 'true') {
        scene.add( arrowHelper );
    }
    
}

function resizePlaySpace() {
    const aspect = window.innerWidth / window.innerHeight;

    // squish playspace
    const oldMultiplier = playspace_width_multiplier
    playspace_width_multiplier = (aspect < 1 ? aspect : 1)
    for (const key in playspace_group) {
        playspace_group[key].scale.set(playspace_width_multiplier, 1,1)
    }

    if (!gameState.gameInitialized) {return;}

    // Slide entities back into the playspace. 
    const correctionVector = new THREE.Vector3(1,1,1)
        .divide(new THREE.Vector3(oldMultiplier, 1,1))
        .multiply(new THREE.Vector3(playspace_width_multiplier,1,1));   
        // Turns out the ; in the above line is actualy manditory. Otherwise
        // the next line looks like an index into correctionVector. (probably?)

    [player.position, player.moveTarget, player.lookTarget, wolf_model.position].forEach((pos) => {
        pos.multiply(correctionVector)
    })

    gameState.collectedSheep.forEach((sheep) => {
        sheep.position.multiply(correctionVector)
    })

    gameState.lostSheep.forEach((sheep) => {
        sheep.position.multiply(correctionVector)

        var doRespawn = false
        for (const other_sheep of gameState.lostSheep) {
            if (other_sheep === sheep) {continue;}
            if (sheep.position.distanceToSquared(other_sheep.position) < 2**2) {
                doRespawn = true; 
                break;
            }
        }
        if (doRespawn || sheep.position.distanceToSquared(player.position) < 2**2) {
            sheep.position.copy(getValidSpawnPosition())
        }
    })
}

// --- Event listeners and Input Handeling ---
function resizeCanvas() {
    resizePlaySpace()

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);

    renderer.render( scene, camera );
    labelRenderer.render( scene, camera );
}

window.addEventListener('resize', resizeCanvas, false);

function pauseInputListeners() {
    document.getElementById("game").removeEventListener( 'pointermove', updatePointerPos ) 
    document.getElementById("game").removeEventListener( 'click',  updatePointerAndMove) 
}

function startInputListeners() {
    document.getElementById("game").addEventListener( 'pointermove', updatePointerPos ) 
    document.getElementById("game").addEventListener( 'click',  updatePointerAndMove) 
}

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
        setmoveTarget()
    }
}

function setmoveTarget( target ) {
    if (!target) {
        player.moveTarget = player.lookTarget.clone()
    } else {
        player.moveTarget = target.clone()
    }
    // debugCube.position.setX(player.lookTarget.x);
    // debugCube.position.setZ(player.lookTarget.z);
}

function updatePointerAndMove(event) {
    updatePointerPos(event); 

    // test if we clocked on a sheep label
    const clicked_element = document.elementFromPoint(event.clientX, event.clientY)
    if (clicked_element.classList.contains("game_sheep_label") ) {
        // Looks like we clicked on a sheep! Let's figure out which sheep and move the player to that sheep. 
        var matchSheep; 
        gameState.lostSheep.forEach((sheep) => {
            if (sheep.userData.CSS2DObject.element === clicked_element) { matchSheep = sheep }
        })
        if (matchSheep) {
            // One of the lost sheep matches the clicked sheep. 
            setmoveTarget(matchSheep.position)
            return;
        }
    }

    setmoveTarget();
}

function pointerToFloorPos() {
    raycaster.setFromCamera( pointer, camera );
    const intersects = raycaster.intersectObjects( scene.children );

    // console.log("intersections")
    
    for ( let i = 0; i < intersects.length; i ++ ) {
        
        // if (intersects[i].object.name == "floor") {
            // console.log(intersects[i].point)
            const floor_point = intersects[i].point
            floor_point.setY(0)
            return floor_point
        // }
	}
    return null
}


// --- Sheep and Wolves
function getValidSpawnPosition() {
    const spawnLocation = new THREE.Vector3()
    var attempts = 16

    const minDistToPlayerSquared = ( deviceIsPhone? 5^2 : 4^2);
    const minDistToLostSheepSquared = 5^2;
    const minDistToCollectedSheepSquared = 4^2;

    while (attempts > 0) {
        attempts--;

        // Ask the playspace for a random location. 
        playspaceSurfaceSampler.sample( spawnLocation ) 
        spawnLocation.multiply( new THREE.Vector3( playspace_width_multiplier, 1, 1 ))  // Fit location inside narrow playspace
        spawnLocation.multiplyScalar(0.75)  // Sheep still spawn too close to the fence. Push them inword a little

        // If location too close to player, try again. We don't want the player to accidentaly get a sheep they didn't intend.
        if (player.position.distanceToSquared( spawnLocation ) < minDistToPlayerSquared ) {
            if (attempts < 1) { attempts++; }
            // console.log("Too Close to Player")
            continue; 
        }

        var tooCloseToNearbySheep = false

        // If location too close to other lost sheep, try again. It can be dificult to aim if the correct answer is too close to a wrong one.
        for (const sheep of gameState.lostSheep) {
            if (sheep.position.distanceToSquared( spawnLocation ) < minDistToLostSheepSquared ) {
                tooCloseToNearbySheep = true;
                if (attempts < 1) { attempts++; }
                // console.log("Too Close to Lost Sheep")
                break;
            }
        } 
        if (tooCloseToNearbySheep) { continue; }

        // Try again if location is too close to collected sheep. (Low priority)
        for (const sheep of gameState.collectedSheep) {
            if (sheep.position.distanceToSquared( spawnLocation ) < minDistToCollectedSheepSquared ) {
                tooCloseToNearbySheep = true;
                // console.log("Too Close to Collected Sheep")
                // We're not going to bump up the attemps for this case.
                // Collected sheep are already styled to be less visible than lost sheep already, 
                // and there could be LOTS of collected sheep. which can really bog down the 
                // spawning system if left unchecked. 
                break;
            }
        }
        if (tooCloseToNearbySheep) { continue; }

        // If we're here, then the above tests did not quit on us. So we must have a valid spot.
        break;
    }   
    // spawnLocation should now be a valid location away from the player and 
    // other lost sheep. But may be close to collected sheep.

    return spawnLocation
}

function deleteWolf() {
    // NOT ACTUALY DELETING. See spawnWolf comment. 
    wolf_model.position.copy( new THREE.Vector3(0, -5, 0));
    wolf_model.userData.actions.idle.stop();
}

function spawnWolf(position, rotationY) {
    // FOR whatever reason, the spawn_sheep workflow of copying the wolf_model and placing it somewhere in 
    // the world, doesn't work for the wolf model. (Very confusing. Might be related to animations?)
    // That said, since there's only suposed to be one wolf on screen at a time, we can actualy fake it by 
    // reusing the same wolf model, and just hiding it somewhere when not in use. 

    // part of the problem is that we can't store the animation mixer inside the wolf_model userData. We can, 
    // but if we do we can't use clone() to make a new wolf. But because I want to keep the animation stuff with
    // the thing that's being animated, I'm doing it anyways. 

    // const newWolf = wolf_model.clone()

    if (!position) {
        // Gives the sheep a random position, Centered at 0,0,0, and then multiplied by 20, 0, 20 to scatter accrost the board. 
        wolf_model.position.copy( getValidSpawnPosition() )
    } else { wolf_model.position.copy(position) }

    if (!rotationY) { wolf_model.rotation.y = (2*Math.PI)*Math.random() }
    else { wolf_model.rotation.y = rotationY }

    wolf_model.userData.actions.idle.reset().play().setLoop(THREE.LoopOnce);
}

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
    sheepLabel.position.set( 0, 0, 0 );
    sheepLabel.center.set( 0.5, 1 );
    newSheep.add( sheepLabel );
    sheepLabel.layers.set( 0 );
    
    newSheep.userData.CSS2DObject = sheepLabel

    const newPosition = (position? position : getValidSpawnPosition())
    newSheep.position.copy( newPosition )

    // sheepLabel.addEventListener('click', (event) => {
    //     console.log("CLICK")
    //     setmoveTarget(newSheep.position)
    // });
    
    // ↑ Really not sure why this doesn't work. 
    // Instead, go to the normal updatePointerAndMove


    newSheep.rotation.y = (2*Math.PI)*Math.random()

    scene.add(newSheep)

    // console.log(newSheep)
    return newSheep
}

function deleteSheep(sheep) {
    sheep.remove(sheep.userData.CSS2DObject)
    scene.remove(sheep)
}

function collectSheep(sheep) {
    // This function should totaly remove the selected sheep from the lost 
    // sheep list for you. But for now, remember to remove the sheep from 
    // the lost sheep list manualy either before or after you collect it. 
    gameState.collectedSheep.push(sheep);
    sheep.userData.CSS2DObject.element.classList.add("game_colected_sheep_label")
    // sheepLabelDiv.className = 'game_sheep_label';
    updateDisplayBoard();
}

function clearLostSheep() {
    gameState.lostSheep.forEach(sheep => {
        // deconstruct all currently on screen sheep. 
        deleteSheep(sheep)
        // TODO! Double check this isn't leaving oodles of loose sheep in memory. 
    });
    gameState.lostSheep = []
}

function spawnNewSheepWave() {
    clearLostSheep();

    gameState.lostSheep = []
        
    // initial correct sheep. 
    const correctWord = gameState.verse[gameState.collectedSheep.length]
    const safeCorrectWord = getBrillSafeWord(correctWord).word 
    gameState.lostSheep.push( spawnSheep(null, correctWord ) )

    // generate distraction words
    const possibleDistractionWords = new Set();
    const targetPOS = (gameState.passage.wordToPOSLookup[safeCorrectWord]);
    // if (safeCorrectWord[0].toLowerCase() != safeCorrectWord[0]) {}
    targetPOS.forEach((pos) => {
        gameState.passage.posToWordLookup[pos].forEach((possibleWord) => {
            // Do tests on word candidates here. 

            // ignore words that are basicly the same as this word
            if (
                possibleWord.toLowerCase() == safeCorrectWord.toLowerCase()
                || possibleWord.toLowerCase() == correctWord.toLowerCase()
            ) {return;}


            possibleDistractionWords.add(possibleWord);
        })
    });

    function getNewDistraction() {
        const items = Array.from(possibleDistractionWords);
        const chosenIndex = Math.floor(Math.random() * items.length);
        possibleDistractionWords.delete(items[chosenIndex]);
        return items[chosenIndex];
    }

    // Spawn distraction sheep. 
    // should be nearly imposible for the destraction list to be shorter than 3,
    // but everything should™ work on the first try, right?
    const numSheepPerWave = Math.min(possibleDistractionWords.size, 3)

    for (var i = 1; i < numSheepPerWave; i++) {
        gameState.lostSheep.push(spawnSheep(null, getNewDistraction()))
    }
}


// --- Update / animate loop ---
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

function animate( time ) {
    if (gameState.runState != "running") {
        return
    }

    updateGame()

	renderer.render( scene, camera );
    labelRenderer.render( scene, camera );

    requestAnimationFrame( animate );   // re-call animate every (animatable) frame. Logic shouldn't go here, since it'll run faster or slower of different devices
}

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
                if (player.position.distanceToSquared(sheep.position) < ( deviceIsPhone? 1.25 : 0.75 )) {
                    if (sheep.userData.text == nextCorrectWord) {
                        // Oh hey, this is the correct sheep
                        correctSheep = sheep; 
                        gameState.lostSheep.splice(i,1) // remove correct from lost sheep. 
                        collectSheep(sheep);

                        updateScore(1);
                        updateCounter(1); // Increment counter for correct sheep

                        // check if end-of-game
                        if (gameState.collectedSheep.length == gameState.verse.length) {
                            console.log("win state!")
                            // new class in case we want to restyle the colected sheep again. 
                            for (const sheep of gameState.collectedSheep) {
                                sheep.userData.CSS2DObject.element.classList.add("game_winning_sheep_label")
                            }
                            clearLostSheep();

                            pauseGame();
                            showEndGamePopup();

                            if (!(localStorage.getItem("userPausedSound") == "true")) {
                                if (!gameAudioContext) { makeAudioContext() }
                                sfx.winningGuess.play()
                            }
                        } else {
                            spawnNewSheepWave();

                            if (!(localStorage.getItem("userPausedSound") == "true")) {
                                if (!gameAudioContext) { makeAudioContext() }
                                sfx.correctGuess.play();
                            }
                        }
                        break; 
                    }
                    nearbySheep.push(sheep)
                }
            }
            if (!nearbySheep.length == 0 && correctSheep == null) {
                // We're near sheep, but we did not find the correct one. So we must be near a wolf. 
                // Pick a random nearby sheep to be the wolf
                
                const wolfSheep = nearbySheep [Math.floor(Math.random() * nearbySheep.length)];
                
                wolfSheep.userData.CSS2DObject.element.classList.add("game_wolf_label")

                spawnWolf(wolfSheep.position.clone())
                clearLostSheep();
                updateScore(1);

                if (gameState.collectedSheep.length > 0) {
                    const spooked_sheep = gameState.collectedSheep.pop();
                    deleteSheep(spooked_sheep);
                    updateDisplayBoard();
                    updateCounter(-1);
                }else{
                    gameState.waitForFirstCorrectSheep = true;
                }

                wolf_model.userData.animationMixer.addEventListener( 'finished', function( _ ) {
                    spawnNewSheepWave();

                    deleteWolf();
                }, { once: true });

                if (!(localStorage.getItem("userPausedSound") == "true")) {
                    if (!gameAudioContext) { makeAudioContext() }
                    sfx.incorrectGuess.play();
                }
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

    // point wolf at shepherd
    moveObjTowardsPoint(delta, wolf_model, wolf_model.position, player.position) // Moves to it's current position and looks at shepherd. 

    // Wolf Animations 
    wolf_model.userData.animationMixer.update(delta);
    updateUi();
}

// --- UI Control ---
function updateDisplayBoard(){
    const displayBoard = document.querySelector('.displayBoard');
    displayBoard.innerHTML = ''; // Clear previous content

    gameState.collectedSheep.forEach((sheep, index) => {
        const sheepWord = sheep.userData.text;
        const sheepElement = document.createElement('div');
        sheepElement.classList.add('displayedSheep');
        sheepElement.textContent = sheepWord;

        // Generate a unique animation name for each sheep
        const animationName = `scaleUpDown_${index}`;

        // Apply scaling animation only to the latest sheep
        if (index === gameState.collectedSheep.length - 1) {
            sheepElement.style.animation = `${animationName} 0.5s ease-in-out forwards`;
        }

        // Define keyframes for each unique animation
        const keyframes = `@keyframes ${animationName} {
            0% {
                transform: scale(0.5);
            }
            100% {
                transform: scale(1);
            }
        }`;

        // Create a style element for the keyframes
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(keyframes));
        document.head.appendChild(style);

        displayBoard.appendChild(sheepElement);
    });
}

function updateUi() {
    const elapsedTime = playClock.getElapsedTime() + elapsedPlayTime;
    document.getElementById("timer").innerHTML = "Timer: " + Math.round(elapsedTime);
}


// Score control
function updateScore(delta) {
    gameState.score += delta;

    // If all words are collected, update the score format
    if (gameState.collectedSheep.length == gameState.verse.length) {
        const ratio = gameState.verse.length / gameState.score;
        const roundedRatio = ratio.toFixed(2);
        document.getElementById("score").innerHTML = "Score: " + roundedRatio*100 + "%";
    } else {
        // Update the displayed score in the HTML
        document.getElementById("score").innerHTML = "Score: " + gameState.score + "/" + gameState.verse.length;
    }
}

function updateCounter(delta) {
    if (gameState.waitForFirstCorrectSheep) {
        // If waiting for the first correct sheep, do not subtract from counter
        gameState.waitForFirstCorrectSheep = false;
        gameState.counter = 1;
    } else {
        gameState.counter += delta;
    }

    // Update the displayed counter in the HTML
    document.getElementById("counter").innerHTML = "Sheep: " + gameState.counter + "/" + gameState.verse.length;
}

export function resetScoreAndCounter() {
    gameState.score = 0;
    gameState.counter = 0;

    updateScore(0);
    updateCounter(0);
}

// End game screen. 
function showEndGamePopup (){
    var endGame = document.getElementById("finishGame");
    var confetti = document.getElementById("confetti-l");

    endGame.style.display = 'block';
    confetti.style.display = 'block';

    makeItConfetti();

}

// This is teh confetti javascript
var confettiPlayers = [];

export function makeItConfetti() {
    var confetti = document.querySelectorAll('.confetti');

    if (!confetti[0].animate) {
        return false;
    }

    for (var i = 0, len = confetti.length; i < len; ++i) {
        var candycorn = confetti[i];
        candycorn.innerHTML = '<div class="rotate"><div class="askew"></div></div>';
        var scale = Math.random() * .7 + .3;
        var player = candycorn.animate([
        { transform: `translate3d(${(i/len*100)}vw,-5vh,0) scale(${scale}) rotate(0turn)`, opacity: scale },
        { transform: `translate3d(${(i/len*100 + 10)}vw,105vh,0) scale(${scale}) rotate(${ Math.random() > .5 ? '' : '-'}2turn)`, opacity: 1 }
        ], {
        duration: Math.random() * 3000 + 4000,
        iterations: Infinity,
        delay: -(Math.random() * 7000)
        });
        
        confettiPlayers.push(player);
    }
}

export function awayEndGamePopup (){
    var endGame = document.getElementById("finishGame");
    var confetti = document.getElementById("confetti-l");

    endGame.style.display = 'none';
    confetti.style.display = 'none';
}

// --- gametime started ---
gameInit();