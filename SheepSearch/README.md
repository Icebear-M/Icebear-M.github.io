# Sheep Search

Help the shepherd find his sheep, but watch out for the wolves! 

## Build / Run instructions 

While the app so far doesn't do any server-side logic, we will use some libraries that expect some server-side privlages.

1. Install [Node.js](https://nodejs.org/en) on your computer. 
2. Open a terminal to this directory. 
3. Run `npm install`. This will refetch all the node modules required for this app. 
4. Run `npx vite` to build and start the server. 
    - The terminal should say something like ` ➜  Local:   http://localhost:5173/` . Put this address into a browser to run the app. 
    - While the server is running, you can edit the app's HTML and JS files and the server will automaticly re-server the changes. Great for development. 

[THREE.js's Instalation page](https://threejs.org/docs/#manual/en/introduction/Installation) says it doesn't need build step, and this entire folder can be sent to a production server for hosting. But vite does have a build tool. Run `npx vite build` to create the `dist` directory. Upload that folder to the final production location. (`npx vite preview` will host the last built website in the dist dir.)