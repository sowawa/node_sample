var fcgiApp = require("./fcgi"),
	http = require("http");


var myServer = http.createServer(function(req, res) {
	setTimeout(function() {
		res.writeHead(200, {"Content-type": "text/html"});
		res.end("It works!" + Date.now());
		console.log("Wrote response.");
	}, 1000);
	//throw new Error("Bollocks.");
});

// Instead of this:
//myServer.listen(12345);

// You do this:
fcgiApp.handle(myServer);