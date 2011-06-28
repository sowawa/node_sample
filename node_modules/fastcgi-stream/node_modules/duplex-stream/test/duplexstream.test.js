var vows = require("vows"),
	assert = require("assert"),
	DuplexStream = require("../lib/duplexstream"),
	stream = require("stream"),
	streamBuffers = require("stream-buffers");

var testStr = "Hello!";

var createDuplexStreamTopic = function(additional) {
	return function() {
		var readable = new streamBuffers.ReadableStreamBuffer();
		var writable = new streamBuffers.WritableStreamBuffer();
		var instance = new DuplexStream(readable, writable);
		instance._readableStream = readable;
		instance._writableStream = writable;
		var result = additional.call(this, instance);
		if(result !== undefined) return result;
	}
};

vows.describe("DuplexStream").addBatch({
	"A default DuplexStream": {
		topic: new DuplexStream(process.stdin, process.stdout),

		"is a Stream": function(instance) {
			assert.instanceOf(instance, stream.Stream);
		},

		"is readable": function(instance) {
			assert.isTrue(instance.readable);
		},

		"is writable": function(instance) {
			assert.isTrue(instance.writable);
		}
	},
	
	"A default DuplexStream passed a non-readable stream": {
		topic: function() {
			return function() { return new DuplexStream(new streamBuffers.WritableStreamBuffer(), process.stdout); };
		},
	
		"will throw an Error": function(constructor) {
			assert.throws(constructor, TypeError);
		}
	},
	
	"A default DuplexStream passed a non-writable stream": {
		topic: function() {
			return function() { return new DuplexStream(process.stdin, new streamBuffers.ReadableStreamBuffer()); };
		},
	
		"will throw an Error": function(constructor) {
			assert.throws(constructor, TypeError);
		}
	}
})
.addBatch({
	"When underlying readable has data": {
		topic: createDuplexStreamTopic(function(instance) {
			instance.on("data", this.callback.bind(this, null, instance));
			instance._readableStream.put(testStr);
		}),
		
		"data event triggers with data Buffer": function(wtf, instance, data) {
			assert.instanceOf(data, Buffer);
		},
		
		"with correct data": function(wtf, instance, data) {
			assert.equal(data.toString(), testStr);
		}
	},
	
	"When DuplexStream is paused/resumed": {
		topic: createDuplexStreamTopic(function(instance) {
			var actualPause = instance._readableStream.pause;
			instance._readableStream.pause = function() {
				this.pauseCalled = true;
				actualPause.apply(this);
			}.bind(instance._readableStream);
			
			var actualResume = instance._readableStream.resume;
			instance._readableStream.resume = function() {
				this.resumeCalled = true;
				actualResume.apply(this);
			}.bind(instance._readableStream);
			
			instance.pause();
			instance.resume();
			
			return instance;
		}),
		
		"pause is called on underlying stream": function(instance) {
			assert.isTrue(instance._readableStream.pauseCalled);
		},
		
		"resume is called on underlying stream": function(instance) {
			assert.isTrue(instance._readableStream.resumeCalled);
		}
	},
	
	"When DuplexStream is written to": {
		topic: createDuplexStreamTopic(function(instance) {
			var actualWrite = instance._writableStream.write;
			instance._writableStream._writeCalled = null;
			instance._writableStream.write = function() {
				instance._writableStream._writeCalled = arguments;
				actualWrite.call(this, arguments);
			}.bind(instance._writableStream);
			
			instance.write("Hello", "utf8");
			return instance;
		}),
		
		"underlying stream is written to": function(instance) {
			assert.isNotNull(instance._writableStream._writeCalled);
		},
		
		"with correct arguments": function(instance) {
			assert.equal(instance._writableStream._writeCalled[0], "Hello");
			assert.equal(instance._writableStream._writeCalled[1], "utf8");
		}
	},
	
	"When DuplexStream has encoding set on it": {
		topic: createDuplexStreamTopic(function(instance) {
			var actualSetEncoding = instance._readableStream.setEncoding;
			instance._readableStream.setEncoding = function(encoding) {
				instance._readableStream._encodingCalled = encoding;
				actualSetEncoding.call(this);
			}.bind(instance._readableStream);
			
			instance.setEncoding("ascii");
			return instance;
		}),
		
		"encoding is called on underlying readable": function(instance) {
			assert.isString(instance._readableStream._encodingCalled);
		},
		
		"with correct encoding identifier": function(instance) {
			assert.equal(instance._readableStream._encodingCalled, "ascii");
		}
	},
	
	"When drain is emitted on underlying writable": {
		topic: createDuplexStreamTopic(function(instance) {
			instance.on("drain", this.callback.bind(this, null, instance));
			instance._writableStream.emit("drain");
		}),

		"drain is emitted on DuplexStream": function() {
			assert.isTrue(true)
		}
	},
	
	// Pipe isn't emitted on destination stream until node 0.4.0, which makes these tests somewhat irrelevant for now.
	// TODO: should check node version and test appropriately perhaps.
	/*
	"When DuplexStream is piped *to*": {
		topic: createDuplexStreamTopic(function(instance) {
			var that = this;
			var anotherReadable = new streamBuffers.ReadableStreamBuffer();
			instance._anotherReadable = anotherReadable;
			instance.on("pipe", function(src) { that.callback(null, instance, src);});
			anotherReadable.pipe(instance);
		}),
		
		"source is correct": function(instance, src) {
			assert.equal(src, instance._anotherReadable);
		}
	},

	"When piped *from* DuplexStream": {
		topic: createDuplexStreamTopic(function(instance) {
			var anotherWritable = new streamBuffers.WritableStreamBuffer();
			anotherWritable.on("pipe", function() { anotherWritable.pipeCalled = true; });
			instance._anotherWritable = anotherWritable;
			instance.pipe(anotherWritable);
			return instance;
		}),

		"pipe event is emitted on target": function(instance) {
			assert.isTrue(instance._anotherWritable.pipeCalled);
		}
	},*/
	
	"When underlying readable ends": {
		topic: createDuplexStreamTopic(function(instance) {
			instance.on("end", this.callback.bind(this, null, instance));
			
			// We're using my readable stream buffer for testing here, which happens to call end when it is destroyed.
			instance._readableStream.destroy();
		}),
		
		"end is emitted on DuplexStream": function() {
			assert.isTrue(true);
		},
		
		"DuplexStream is no longer *readable*": function(instance) {
			assert.isFalse(instance.readable);
		}
	},
	
	"When an error occurs on underlying readable": {
		topic: createDuplexStreamTopic(function(instance) {
			instance.on("error", this.callback.bind(this, null, instance));
			var err = new Error("My Error!");
			instance._err = err;
			instance._readableStream.emit("error", err);
		}),
		
		"the correct error is thrown": function(wtf, instance, err, source) {
			assert.strictEqual(err, instance._err);
		},
		
		"the correct source is specified": function(wtf, instance, err, source) {
			assert.equal(source, "readable");
		}
	},
	
	"When an error occurs on underlying writable": {
		topic: createDuplexStreamTopic(function(instance) {
			instance.on("error", this.callback.bind(this, null, instance));
			var err = new Error("My Error!");
			instance._err = err;
			instance._writableStream.emit("error", err);
		}),
		
		"the correct error is thrown": function(wtf, instance, err, source) {
			assert.strictEqual(err, instance._err);
		},
		
		"the correct source is specified": function(wtf, instance, err, source) {
			assert.equal(source, "writable");
		}
	},
	
	"When destroying the underlying readable": {
		topic: createDuplexStreamTopic(function(instance) {
			instance._readableStream.destroy();
			return instance;
		}),
		
		"readable on Duplex is false": function(instance) {
			assert.isFalse(instance.readable);
		}
	},
	
	"When destroying the underlying writable": {
		topic: createDuplexStreamTopic(function(instance) {
			instance._writableStream.destroy();
			return instance;
		}),
		
		"readable on Duplex is false": function(instance) {
			assert.isFalse(instance.writable);
		}
	},
	
	"When destroying both underlying streams": {
		topic: createDuplexStreamTopic(function(instance) {
			instance.on("close", this.callback.bind(this, null, instance));
			
			instance._readableStream.destroy();
			instance._writableStream.destroy();
		}),
		
		"*close* is emitted on Duplex": function(instance) {
			assert.isTrue(true);
		}
	},

	"When destroySoon is called on Duplex": {
		topic: createDuplexStreamTopic(function(instance) {
			var actualDestroySoon = instance._writableStream.destroySoon;
			instance._writableStream._destroyCalled = false;
			instance._writableStream.destroySoon = function() {
				instance._writableStream._destroyCalled = true;
				actualDestroySoon.call(this);
			}.bind(instance._writableStream);

			instance.destroySoon();

			return instance;
		}),
		
		"it is also called on underlying writable": function(instance) {
			assert.isTrue(instance._writableStream._destroyCalled);
		}
	},
	
	"When destroying a Duplex": {
		topic: createDuplexStreamTopic(function(instance) {
			instance._readableStream.on("close", function() {
				instance._readableDestroyed = true;
			});
			
			instance._writableStream.on("close", function() {
				instance._writableDestroyed = true;
			});
			
			instance.destroy();
			return instance;
		}),
		
		"readable underlying is destroyed": function(instance) {
			assert.isTrue(instance._readableDestroyed);
		},
		
		"writable underlying is destroyed": function(instance) {
			assert.isTrue(instance._writableDestroyed);
		}
	}
}).export(module);
