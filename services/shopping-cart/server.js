const http = require('http');
const express = require('express');
const cors = require('cors');
const redis = require('redis');
const crypto = require("crypto");

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const REDIS_URL = 'redis://' +process.env.REDIS_HOST +':' +process.env.REDIS_PORT;
const INITIALIZATION_VECTOR = Buffer.from(crypto.createHash('md5').update(process.env.SESSION_SECRET).digest("hex"), "hex");
const emptySession = {
	"cart": [],
	"user": {}
};

/* 	Connect to Redis-client 
*/
const redisClient = redis.createClient({
    url: REDIS_URL
});
redisClient.connect().catch(console.error)


/* Express + Middleware 
*/
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));


/*	ENDPOINT - Healthcheck 
	Used by docker to determine container health
*/
app.get('/health', (req, res) => {
	res.sendStatus(200);
});

/*	ENDPOINT - ShoppingCart
	removed all encryption/decryption!#
	also new session will be created if session cookie is present after cache-entry was deleted for whatever reason
	Also ... much wow, very repetition, many possibility for fail, such shitty style *doge meme* -> switch to OOP next time
*/
app.get('/shoppingCart', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;

	console.log(`Get ShoppingCart for Session: ${sessionID}`);
	redisClient.get(sessionID)
	.then((currentSession) => {
		if (currentSession === null) {

			console.log("\x1b[43m WARNING: No matching session in Redis-DB! New cache-entry will be created \x1b[0m");

			redisClient.set(sessionID, JSON.stringify(emptySession));
			currentSession = emptySession;
		} else {
			currentSession = JSON.parse(currentSession);
		};

		const DTOobject = currentSession.cart;
		console.log("Cart content: " + JSON.stringify(DTOobject));
		res.status(200);
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(DTOobject));
	});
});

app.post('/shoppingCart', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const item = req.body;
	const sessionID = sess.sessionID;

	console.log(`Get ShoppingCart for Session: ${sessionID}`);
	redisClient.get(sessionID)
	.then((currentSession) => {
		if (currentSession === null) {
			console.log("\x1b[43m WARNING: No matching session in Redis-DB! New cache-entry will be created \x1b[0m");
			redisClient.set(sessionID, JSON.stringify(emptySession));
			currentSession = emptySession;
		} else {
			currentSession = JSON.parse(currentSession);
		};

		console.log(`Update ShoppingCart for Session: ${sessionID}`);
		currentSession.cart.push(item);
		const currentSessionString = JSON.stringify(currentSession);

		redisClient.set(sessionID, currentSessionString);

		res.sendStatus(200);
	});
});

app.delete('/shoppingCart', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;

	console.log(`Get ShoppingCart for Session: ${sessionID}`);
	redisClient.get(sessionID)
	.then((currentSession) => {
		if (currentSession === null) {
			console.log("\x1b[43m WARNING: No matching session in Redis-DB! New cache-entry will be created \x1b[0m");
			redisClient.set(sessionID, JSON.stringify(emptySession));
			currentSession = emptySession;
		} else {
			currentSession = JSON.parse(currentSession);
			console.log(`Delete ShoppingCart for Session: ${sessionID}`);
			currentSession.cart = [];
			const currentSessionString = JSON.stringify(currentSession);

			redisClient.set(sessionID, currentSessionString);
		};

		res.sendStatus(200);
	});
});

/* 	Start and Graceful Shutdown
	Graceful shutdown ensures proper disconnect and speeds up shutdown process.
	Also returns 0 after shutdown, so no more errors in Docker!
*/
const server = app.listen(80, () =>{
	console.log('\x1b[42m\x1b[30m Shoppingcart Microservice Running on Port 80  \x1b[0m');
});

process.on('SIGTERM', () => {
	console.log('Goodnight sweet prince');
	server.close(() => {
	  	// Additional cleanup tasks go here
	});
	process.exit(0);
});
  
process.on('SIGINT', () => {
	console.log('Goodnight sweet prince');
	server.close(() => {
	  	// Additional cleanup tasks go here
	});
	process.exit(0);
});
