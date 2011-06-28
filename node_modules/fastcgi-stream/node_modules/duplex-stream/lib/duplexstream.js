var stream = require("stream"),
	util = require("util");

var DuplexStream = module.exports = function(readableStream, writableStream) {
	if(!readableStream.readable) {
		throw new TypeError("Invalid readable stream provided.");
	}
	if(!writableStream.writable) {
		throw new TypeError("Invalid writable stream provided.");
	}

	stream.Stream.call(this);
	
	var that = this;

	this.readable = true;
	this.writable = true;

	var closeEmitted = false;
	var checkClose = function() {
		if(!that.readable && !that.writable && !closeEmitted) {
			closeEmitted = true;
			that.emit("close");
		}
	};
	
	readableStream.on("data", function(data) {
		that.emit("data", data);
	});
	
	readableStream.on("fd", function(fd) {
		that.emit("fd", fd);
	});
	
	readableStream.on("end", function() {
		that.emit("end");
	});
	
	readableStream.on("close", function() {
		that.readable = false;
		checkClose();
	});
	
	readableStream.on("error", function(ex) {
		that.emit("error", ex, "readable");
	});
	
	this.setEncoding = function(encoding) {
		readableStream.setEncoding(encoding);
	};
	
	this.pause = function() {
		readableStream.pause();
	};
	
	this.resume = function() {
		readableStream.resume();
	};

	writableStream.on("drain", function() {
		that.emit("drain");
	});
	
	writableStream.on("error", function(ex) {
		that.emit("error", ex, "writable");
	});
	
	writableStream.on("close", function() {
		that.writable = false;
		checkClose();
	});

	this.on("pipe", function(src) {
		writableStream.emit("pipe", src);
	});
	
	this.write = function(data, encoding) {
		if(encoding) {
			writableStream.write(data, encoding);
		}
		else {
			writableStream.write(data);
		}
	};
	
	this.end = function(data, encoding) {
		if(encoding) {
			writableStream.end(data, encoding);
		}
		else if(data) {
			writableStream.end(data);
		}
		else {
			writableStream.end();
		}
	};
	
	this.destroy = function() {
		readableStream.destroy();
		writableStream.destroy();
	};
	
	this.destroySoon = function() {
		readableStream.destroy();
		writableStream.destroySoon();
	};
};
util.inherits(DuplexStream, stream.Stream);