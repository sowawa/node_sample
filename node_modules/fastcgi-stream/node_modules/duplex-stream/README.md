# Duplex Stream

Composes two distinct readable and writable streams into one cohesive Stream. Why would you want to do this? I honestly have no idea. You'd have to be really stupid or something.

## Installation

	npm install duplex-stream
	
## Usage

	var DuplexStream = require("duplex-stream");

	var myDuplexStream = new DuplexStream(aReadableStream, aWritableStream);
	
	
The DuplexStream should behave exactly how you'd expect.

	// Probably because of this:
	console.log((new DuplexStream()) instanceof Stream);	// -> true

That is, when events occur on the underlying streams, they occur on the DuplexStream.
 
* When data is on the line from the underlying readable stream, the `data` event is emitted on DuplexStream
* Writing to DuplexStream will write to the underlying writable stream.
* Pausing/Resuming the DuplexStream will pause/resume the underlying readable stream.
* Ending the DuplexStream will end the underlying writable, readable will still be available.
* Setting encoding on DuplexStream will set encoding on underlying readable.
* When `end` event occurs on underlying readable, DuplexStream marks itself as unreadable but can still be written to (if it's not already been ended).
* Destroying the duplex stream will destroy both underlying streams.
* Calling `destroySoon()` on the duplex stream will destroy readable stream immediately and tell writable stream to destroy as soon as it can.

One little "gotcha" though, `close` won't be emitted on the DuplexStream until both underlying streams are closed.

## Derp?

DuplexStream is just a silly little convenience. An (unnecessary) abstraction. I use it for composing automated tests that deal with Streams, along with my [node-stream-buffer](https://github.com/samcday/node-stream-buffer) project.
