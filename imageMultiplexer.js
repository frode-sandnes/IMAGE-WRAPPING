"use strict"

// Intelligent multiplexing of images on web pages
// By Frode Eika Sandnes, OsloMet, March 2023.

// using tensorflow coco-library for finding regions of interest
//https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd

// must match css
const viewport = 320;

// Bootstrapping: The following code is called on startup.        
window.addEventListener('DOMContentLoaded', (event) => start());

// add javascript libraries dynamically
function loadJSfile(url, callback)
    {
    let script = document.createElement("script");
    script.type = 'text/javascript';
    script.src = url;
    script.onreadystatechange = callback;   // backwards compatability
    script.onload = callback;  
    document.head.appendChild(script);
    }

function start()
    {
    loadJSfile("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs", stepTwo);
    }
function stepTwo()
    {
    loadJSfile("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd", stepThree);
    }
function stepThree()
    {
    // load stylesheet with narrow viewport breakpoints
    var styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.type = 'text/css';
    styles.media = 'screen';
    styles.href = 'breakpoints.css';
    document.getElementsByTagName('head')[0].appendChild(styles);   
    // move onto next phase
    analyzeImages();
    }

let progressQueue = 0;  // Global
function startProgressBar(max)
    {
    if (progressQueue == 0)
        {
        let div = document.createElement("div");
        div.id = "progressbar";
        div.classList.add("progressStyle");
        div.innerText = "Processing images ...";
        document.body.appendChild(div);
        }
    progressQueue++;
    }
function stopProgressBar()
    {
    progressQueue--;    
    if (progressQueue == 0)
        {
        document.getElementById("progressbar").remove();
        }      
    }

// map containing cycling sequence of id's. Going from image A -> B.
let idMap = {};

function analyzeImages()  
    {
    const images = [ ...document.getElementsByTagName('img')];
    images.forEach((img, imageNo) => 
        {
        startProgressBar(images.length);
        // set a reference so that we can access the image later
        img.id = imageNo;
        img.classList.add("wide");
        // set upt he canvas and draw the image in original size
        let c = document.createElement("canvas");
        var ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.canvas.width  = img.naturalWidth;
        ctx.canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        let xScaling = img.naturalWidth / img.width;
        let yScaling = img.naturalHeight / img.height;

        // Load the model.
        cocoSsd.load().then(model => 
            {
            // detect objects in the image. use the canvas to prevent cors problems
            model.detect(c).then(predictions => 
                {
                let rootId = (imageNo + 1) + ".";   // previous id used to map previous
                let prevId = rootId;
                // insert new cropped images  
                predictions.sort((a, b) => Math.hypot(b.bbox[2], b.bbox[3]) - Math.hypot(a.bbox[2], a.bbox[3]))  // go from wider to narrow.
                   .sort((a, b) => 
                        {
                        if (Math.abs(b.bbox[2] - a.bbox[2]) > b.bbox[2] / 3)    
                            {
                            return 0;   // unsimilar widths, keep size based order
                            }
                        return a.bbox[0] - b.bbox[0];   // otherwise, organize with the leftmost first
                        }) // for boxes with similar widths, place from left to right
                  .map((prediction, imagePartNo) => 
                        {     // make label
                        let id = (imageNo + 1) + "." + (imagePartNo + 1);
                        idMap = { ...idMap, [prevId]: id};  // update the global id structure
                        prevId = id;
                        let caption = "Cropped image "+ id + " (" + prediction.class +"):";
                        let canvasPart = addFigure(id, caption, img);
                        return { ...prediction, canvas: canvasPart};  // just pass on the bounding box
                        })
                  .map(({bbox, canvas}) => 
                        ({bbox: [bbox[0] * xScaling, bbox[1] * yScaling, bbox[2] * xScaling, bbox[3] * yScaling], canvas: canvas}))  // scale from image to canvas coordinate systems
                  .map(({bbox, canvas}) => 
                      {                  // crop each area to get even "closer"
                      const magicCrop = 10;
                      let dx = Math.round(bbox[2]/magicCrop);
                      let dy = Math.round(bbox[3]/magicCrop);
                      // adjustment - not cropping top as usually too narrow with people
                      return ({bbox: [bbox[0] + dx, bbox[1], bbox[2] - 2*dx, bbox[3] - dy], canvas: canvas});
                      })
                  .forEach(({bbox, canvas}) => 
                      {
                      let imageData = ctx.getImageData( ...bbox );
                      let ctx2 = canvas.getContext("2d");
                      let aspectRatio = bbox[2] / bbox[3];  // width / height
                      let croppedWidth = viewport;  // scale the image to viewport width while keeping aspect ratio
                      let croppedHeight = Math.round(croppedWidth  / aspectRatio);
                      canvas.width = croppedWidth;
                      canvas.height = croppedHeight;
                      // create temporary canvas to draw on
                      let sketchCanvas = document.createElement("canvas");     
                      let sketchCtx = sketchCanvas.getContext("2d"); 
                      sketchCanvas.width = imageData.width;
                      sketchCanvas.height = imageData.height;
                      // trick is to first paint the image into the canvas, and repaint the canvas scaled up
                      sketchCtx.putImageData(imageData, 0, 0); 
                      ctx2.drawImage( sketchCanvas, 0, 0, imageData.width, imageData.height, 0, 0, croppedWidth, croppedHeight);
                      });
                
                // complete the id cycle
                idMap = { ...idMap, [prevId]: rootId};  // update the global id structure
                // insert the overall image to fit viewport with - inserted last to appear on top
                let canvasFull = addFigure(rootId, "Full image "+ (imageNo + 1) + ": \"" + (img.alt ?? "") + "\" ("+predictions.length+" views)", img);
                let ctx2 = canvasFull.getContext("2d");      
                let resizeWidth = viewport;  // scale the image to viewport width while keeping aspect ratio
                let resizeHeight = Math.round(resizeWidth * img.height / img.width);
                canvasFull.width = resizeWidth
                canvasFull.height = resizeHeight;
                ctx2.drawImage(img, 0, 0, resizeWidth, resizeHeight);
                document.getElementById(rootId).classList.remove("hideNarrow");
                document.getElementById(rootId).classList.add("showNarrow");
                      
                // We are done - indicate finish
                stopProgressBar();
                });
            });
        })
    }

function addFigure(id, caption, insertionPoint)
    {
    let figure = document.createElement("figure"); 
    figure.id = id;
    figure.onclick = imageClickHandler;
    figure.classList.add("hideNarrow");
    let figCaption = document.createElement("figcaption");
    figCaption.innerText = caption;
    let canvas = document.createElement("canvas");
    figure.appendChild(figCaption);
    figure.appendChild(canvas);
    insertionPoint.parentNode.insertBefore(figure, insertionPoint.nextSibling);
    return canvas;        
    }

function imageClickHandler(e)
    {
    let clickedId = e.target.parentElement.id;
    let nextId = idMap[clickedId];
    document.getElementById(clickedId).classList.remove("showNarrow");
    document.getElementById(clickedId).classList.add("hideNarrow");
    document.getElementById(nextId).classList.remove("hideNarrow");
    document.getElementById(nextId).classList.add("showNarrow");
    }
