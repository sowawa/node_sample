var fcgi = require("fastcgi-stream"),
	fs = require("fs"),
	util = require("util"),
	net = require("net"),
	http = require("http"),
	IOWatcher = process.binding("io_watcher").IOWatcher,
	
	netBindings = process.binding("net"),
	_net_accept = netBindings.accept;

var FCGI_LISTENSOCK_FILENO = process.stdin.fd;

var activeRequests = 0;
var shuttingDown = false;

var closeConnection = function(socket) {
	socket.destroy();
	socket = null;
	activeRequests--;

	console.error("closedconn.", activeRequests);
	if((activeRequests == 0) && shuttingDown) {
		console.error("All done!");
		process.exit(-1);
	}
}

var handleConnection = function(result, server) {
	var socket = new net.Socket(result.fd);
	socket.setNoDelay(true);
	var fastcgiStream = new fcgi.FastCGIStream(socket);
	
	activeRequests++;

	var requests = {};
	
	fastcgiStream.on("record", function(requestId, record) {
		var request = requests[requestId];
			
		if(record instanceof fcgi.records.BeginRequest) {
			if(request) {
				closeConnection(socket);
			}
			
			requests[requestId] = {
				req: new http.IncomingMessage(null)
			};
		}
	
		else if(record instanceof fcgi.records.Params) {
			record.params.forEach(function(paramPair) {
				request.req._addHeaderLine(paramPair[0].toLowerCase(), paramPair[1]);
			});
			
			if(record.params.length == 0) {
				var httpVersionStr = request.req.headers.server_protocol || "HTTP/1.1";
				var httpVersionParts = httpVersionStr.replace(/^HTTP\//, "").split(".");
				if(httpVersionParts.length != 2) httpVersionParts = [1, 1];
				request.req.httpVersionMajor = httpVersionParts[0];
				request.req.httpVersionMinor = httpVersionParts[1];
				request.req.httpVersion = request.req.httpVersionMajor + "." + request.req.httpVersionMinor;
	
				request.req.url = request.req.headers.request_uri;
				request.req.method = request.req.request_method;
				
				request.res = new http.ServerResponse(request.req);
				
				request.res.assignSocket({
					writable: true,
					write: function(data, encoding) {
						var stdOutRecord = new fcgi.records.StdOut(data);
						stdOutRecord.encoding = encoding;
						fastcgiStream.writeRecord(requestId, stdOutRecord);
					}
				});
				
				request.res.useChunkedEncodingByDefault = false;

				request.res._storeHeader = function(statusLine, headers) {
					var matches = statusLine.match(/^HTTP\/[0-9]\.[0-9] (.+)/);
					headers["Status"] = matches[1];
					http.OutgoingMessage.prototype._storeHeader.apply(this, ["", headers]);
				};
				
				request.res.on("finish", function() {								
					var end = new fcgi.records.EndRequest(0, fcgi.records.EndRequest.protocolStatus.REQUEST_COMPLETE);
					fastcgiStream.writeRecord(requestId, end);

					closeConnection(socket);
				});
				
				try {
					server.emit("request", request.req, request.res);
				}
				catch(e) {
					console.error(e);
					
					var end = new fcgi.records.EndRequest(-1, fcgi.records.EndRequest.protocolStatus.REQUEST_COMPLETE);
					fastcgiStream.writeRecord(requestId, end);
					closeConnection(socket);
				}
			}
		}

		else if(record instanceof fcgi.records.StdIn) {
			if(record.data.length == 0) {
				request.req.emit("end");
			}
			else {
				request.req.emit("data", record.data);
			}
		}
	});
	
	socket.resume();
};

module.exports.handle = function(server) {
	var initiateShutdown = function() {
		console.error("Initiating shutdown.");
		shuttingDown = true;
		console.error(activeRequests);
		if(activeRequests == 0) {
			console.error("Shutting down.");
			watcher.stop();
			process.exit(0);
		}
	};

	var watcher = new IOWatcher();
	watcher.set(FCGI_LISTENSOCK_FILENO, true, false);
	
	watcher.callback = function() {
		var result = _net_accept(FCGI_LISTENSOCK_FILENO);
		handleConnection(result, server);
	};
	
	watcher.start();

	process.on("SIGUSR1", initiateShutdown);
	process.on("SIGTERM", initiateShutdown);
};
