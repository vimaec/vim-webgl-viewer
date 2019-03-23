# An Introduction to 3D Graphics for Web Developers

This article introduces the key concepts of 3D graphics for web developers using a very simple open-source
online 3D model viewer that you can use to quickly get started integrating WebGL and Three.JS into your web pages. 

## WebGL

WebGL is a JavaScript 3D graphics API, built on top of a 3D standard called "OpenGL", that is supported by most 
major browsers on a wide range of platforms. It is a surprisingly efficient library that can draw sophisticated
3D graphics on even relatively low power devices like mobile phones. 

WebGl was designed to allow web developers to move data to the GPU (Graphics Processing Unit)
so that your video display can draw it efficiently. As a result, it is a very low level library, that requires 
a relatively deep understanding of 3D graphics systems to get started. 

Luckily there is a very mature and widely used library called Three.JS that provides an easy to use wrapper that 
hides a lot of the complexity of WebGL. 

## Three.JS 

Three JS is an incredible library, but is designed for production use. To assure that your web applications don't bring in more 
dependencies than you might need, the core distribution only contains a small core library. This means that if you want to load a 3D model into a web-page and have basic camera controls, you will need some additional helper libraries that are not part of the main Three.JS distribution and you will to write some boilerplate code to handle model loading, animation rendering loop, and setting up the 3D scene. 

## Reducing Three.JS Boilerplate

Three.JS provides a great abstraction layer around WebGL that removes a lot of the complexity, but can still presents
a substantial learning curve for web developers without a lot of 3D or JavaScript expertise. It also requires 
a significant amount of boilerplate if you just want to render a 3D model in a web-page 

At Ara3D.com we developed an open-source 3D web-viewer based on Three.JS that makes it possible to add 
a configruable and extendible 3D viewer in your web-page by including only one library, and adding just one line of code
to your application.

This viewer can help you integrate 3D content into your web-pages, and can also serve as a launching point to learn more 
about leverageing 3D technologies on the web. 

## How we did it

Show me source! 

* Gulpfile - to concatenate all of the libraries we want together 
* TypeScript - because it helps us code faster

## Drawing a 3D Scene 

Displaying one or more 3D objects in a manner that conveys the 3D nature of the objects on a 2D medium (e.g. a web page) is called rendering. 

To render a 3D object in a web page, we require the following elements 

1. One or more 3D models (aka geometries) represented as a collection of triangles (called meshes)
2. The point of view and perspective from which to draw the image, also known as the camera
3. The position and properties of lights in the scene (e.g. sunlight, spot-lights, ambient light, light-emitting surfaces)
4. How does the surface of the object (called the material) interact with light (e.g. primary color, highlights reflection, shadows, bumpiness, shininess)
5. An update loop, so that when something changes (like the camera position) the 3D image is updated.

We use the term "scene" to describe all of these elements, their properties, and their relationships. 

Because different elements in a scene may have positional relationships (e.g. ) we often talk about a 3D scene as being a graph (more specifically the scene graph is usually a tree). 

