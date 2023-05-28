# IMAGE-WRAPPING
This repository contains the experimental code for "wrapping" images as documented in the demo paper:

Frode Eika Sandnes, Towards “Image Reflow” on the Web: Avoiding Excessive Panning of Magnified Images by Multiplexing Automatically Cropped Regions of Interest. In: Proceedings of INTERACT 2023, LNCS, 2023.

To apply the library to a webpage import the imageMultiplexer.js library in the heaad of the html-document. 

	<script src="imageMultiplexer.js" defer></script>

Also ensure that the breakpoints.css is also in the same directory.  The imageMultplexer library will load the tensorflow.js library that is used for detecting the regions of interrest.

to run - the multiplexer is activated in a narrow viewport only. To see the multiplexing, use a strong zoom. Then click on the images to cycle through the regions of interrest.

Note that this is work in progress.
