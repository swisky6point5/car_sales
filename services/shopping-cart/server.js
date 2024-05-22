const http = require('http');
const express = require('express');
const cors = require('cors');
const redis = require('redis');
const crypto = require("crypto");

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const REDIS_URL = 'redis://' +process.env.REDIS_HOST +':' +process.env.REDIS_PORT;
const INITIALIZATION_VECTOR = Buffer.from(crypto.createHash('md5').update(process.env.SESSION_SECRET).digest("hex"), "hex");

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
	A lot of encryption / decryption ... on every update of the shopping cart
	Not sure if this produces too mcuh load?!
	Also ... much wow, very repetition, many possibility for fail, such shitty style *doge meme* -> switch to OOP next time
*/
app.get('/shoppingCart', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;
	const key = Buffer.from(sess.sessionToken,"base64");
	const iv = INITIALIZATION_VECTOR;

	console.log(`Get ShoppingCart for Session: ${sess.sessionID}`);
	redisClient.get(sess.sessionID)
	.then((encryptedSession) => {
		if (encryptedSession === null) {
			console.log("\x1b[43m ERROR: No matching session in Redis-DB! \x1b[0m");
			res.sendStatus(404);
		} else {
			const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
			let decryptedSession = decipher.update(encryptedSession, 'base64', 'utf8');
			decryptedSession += decipher.final('utf8');

			const DTOobject = JSON.parse(decryptedSession).cart;
			console.log("Cart content: " + JSON.stringify(DTOobject));
			res.send(JSON.stringify(DTOobject));
		};
	});
});

app.post('/shoppingCart', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const item = req.body;
	const sessionID = sess.sessionID;
	const key = Buffer.from(sess.sessionToken,"base64");
	const iv = INITIALIZATION_VECTOR;

	console.log(`Get ShoppingCart for Session: ${sess.sessionID}`);
	redisClient.get(sess.sessionID)
	.then((encryptedSession) => {
		if (encryptedSession === null) {
			console.log("\x1b[43m ERROR: No matching session in Redis-DB! \x1b[0m");
			res.sendStatus(404);
		} else {
			const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
			const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
			let decryptedSession = decipher.update(encryptedSession, 'base64', 'utf8');
			decryptedSession += decipher.final('utf8');

			decryptedSession = JSON.parse(decryptedSession);
			console.log(`Update ShoppingCart for Session: ${sess.sessionID}`);
			decryptedSession.cart.push(item);
			decryptedSession = JSON.stringify(decryptedSession);

			encryptedSession = cipher.update(decryptedSession, 'utf8', 'base64');
			encryptedSession += cipher.final('base64');

			redisClient.set(sessionID, encryptedSession);

			res.sendStatus(200);
		};
	});
});

app.delete('/shoppingCart', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;
	const key = Buffer.from(sess.sessionToken,"base64");
	const iv = INITIALIZATION_VECTOR;

	console.log(`Get ShoppingCart for Session: ${sess.sessionID}`);
	redisClient.get(sess.sessionID)
	.then((encryptedSession) => {
		if (encryptedSession === null) {
			console.log("\x1b[43m ERROR: No matching session in Redis-DB! \x1b[0m");
			res.sendStatus(404);
		} else {
			const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
			const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
			let decryptedSession = decipher.update(encryptedSession, 'base64', 'utf8');
			decryptedSession += decipher.final('utf8');

			decryptedSession = JSON.parse(decryptedSession);
			console.log(`Delete ShoppingCart for Session: ${sess.sessionID}`);
			decryptedSession.cart = [];
			decryptedSession = JSON.stringify(decryptedSession);

			encryptedSession = cipher.update(decryptedSession, 'utf8', 'base64');
			encryptedSession += cipher.final('base64');

			redisClient.set(sessionID, encryptedSession);

			res.sendStatus(200);
		};
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
