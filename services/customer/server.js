const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const redis = require('redis');
const crypto = require("crypto");

/* 	Initializing constants from nevironment variables from the docker compose file 
	- INITIALIZATION_VECTOR: Used for encryption/decryption must be a 16byte long Buffer, 
	  hence the MD5 Hash, which guarentees proper format when given an arbitrary string.
	  Drawback: If the string changes, all currently cached sessions cannot be decrypted anymore!!!
	- sessionTimeout: Timeout for session Information stored in Redis-Cache.
	  Cookies will have a TTL of 24hours ... sooo 24+1 should suffice?
*/ 
const INITIALIZATION_VECTOR = Buffer.from(crypto.createHash('md5').update(process.env.SESSION_SECRET).digest("hex"), "hex");
const HOST_DB_CUSTOMER = process.env.HOST_DB_CUSTOMER;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const REDIS_URL = 'redis://' +process.env.REDIS_HOST +':' +process.env.REDIS_PORT;
const sessionTimeout = 3600 * (24+1);

/* 	Connect to Redis-client 
*/
const redisClient = redis.createClient({
    url: REDIS_URL
});
redisClient.connect().catch(console.error)

/*	Set up MySQL connection 
*/
const sqlClient = mysql.createPool({
    host: HOST_DB_CUSTOMER,
    user: DB_USER,
    password: DB_PASSWORD,
    database: "customer",
});

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

/* 	ENDPOINT - User
	User related endpoints for register, login and logout,
	all endpoints are used by the clientside JS
	Also ... encryption and repetition, encryption and repetition everywhere!!!
	same problem as in the shopping-cart JS ... switch to OOP

*/
app.post('/user/register', async (req, res) => {
	const { userlogin, password, firstName, lastName } = req.body;
	const salt = crypto.randomBytes(16).toString("hex");
	const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
	const salthash = salt +":" +hash;

	sqlClient.promise().query(`SELECT * from customer WHERE email="${userlogin}" LIMIT 1`)
	.then(sqlResponse => {
		if (sqlResponse[0].length == 0) {
			console.log(`Userlogin available, saving new User "${userlogin}"`);
			sqlClient.promise().query(`INSERT INTO customer (email, firstName, lastName, password) VALUES ("${userlogin}", "${firstName}", "${lastName}", "${salthash}")`)
			.then(sqlResponse => {
				console.log("SQL Response: " +JSON.stringify(sqlResponse));	
				res.sendStatus(200);
			});
		} else {
			console.log("\x1b[41m ERROR: Userlogin already taken! \x1b[0m");	
			res.sendStatus(401);
		};
	});
});


app.post('/user/login', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;
	const sessionToken = Buffer.from(sess.sessionToken,"base64");
	const iv = INITIALIZATION_VECTOR;

	const { userlogin, password } = req.body;

	let sqlResponse = await sqlClient.promise().query(`SELECT * from customer WHERE email="${userlogin}" LIMIT 1`);
	if (sqlResponse[0].length == 0) {
		console.log("\x1b[41m ERROR: Login Failed: No User! \x1b[0m");
		res.sendStatus(401);
	} else {
		redisClient.get(sessionID).then(encryptedSession => {
			if (encryptedSession === null) {
				console.log("\x1b[41m ERROR: no matching session in Redis-DB! \x1b[0m");
				res.sendStatus(404);
			} else {
				const user = sqlResponse[0][0];
				const [dbSalt, dbHash] = user.password.split(":");

				const hash = crypto.pbkdf2Sync(password, dbSalt, 1000, 64, "sha512").toString("hex");
				const authSuccess = crypto.timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(dbHash,"hex"));
				if (authSuccess) {
					const cipher = crypto.createCipheriv("aes-256-cbc", sessionToken, iv);
					const decipher = crypto.createDecipheriv("aes-256-cbc", sessionToken, iv);
					let decryptedSession = decipher.update(encryptedSession, 'base64', 'utf8');
					decryptedSession += decipher.final('utf8');
		
					decryptedSession = JSON.parse(decryptedSession);
					console.log(`USER LOGIN: for Session: ${sess.sessionID}`);
					decryptedSession.user = {
						"email": user.email,
						"firstName": user.firstName,
						"lastName": user.lastName
					};
					decryptedSession = JSON.stringify(decryptedSession);
		
					encryptedSession = cipher.update(decryptedSession, 'utf8', 'base64');
					encryptedSession += cipher.final('base64');
		
					redisClient.set(sessionID, encryptedSession);
					res.sendStatus(200);
				} else {
					console.log("\x1b[41m ERROR: Password mismatch! \x1b[0m");
					res.sendStatus(401);
				};
			};
		});
	};
});

app.get('/user/logout', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;
	const sessionToken = Buffer.from(sess.sessionToken,"base64");
	const iv = INITIALIZATION_VECTOR;

	redisClient.get(sessionID).then(encryptedSession => {
		if (encryptedSession === null) {
			console.log("\x1b[41m ERROR: no matching session in Redis-DB! \x1b[0m");
			res.sendStatus(404);
		} else {
			const cipher = crypto.createCipheriv("aes-256-cbc", sessionToken, iv);
			const decipher = crypto.createDecipheriv("aes-256-cbc", sessionToken, iv);
			let decryptedSession = decipher.update(encryptedSession, 'base64', 'utf8');
			decryptedSession += decipher.final('utf8');

			decryptedSession = JSON.parse(decryptedSession);
			console.log(`USER LOGOUT: for Session: ${sess.sessionID}`);

			decryptedSession.user = {};

			decryptedSession = JSON.stringify(decryptedSession);
			encryptedSession = cipher.update(decryptedSession, 'utf8', 'base64');
			encryptedSession += cipher.final('base64');

			redisClient.set(sessionID, encryptedSession);
			res.sendStatus(200);
		};
	});
});

/* 	Get session, only for debugging ... available via backend: /session
*/
app.get('/session/get', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;
	const sessionToken = Buffer.from(sess.sessionToken,"base64");
	const iv = INITIALIZATION_VECTOR;

	redisClient.get(sessionID).then(encryptedSession => {
		if (encryptedSession === null) {
			console.log("\x1b[41m ERROR: no matching session in Redis-DB! \x1b[0m");
			res.sendStatus(401);
		} else {
			const decipher = crypto.createDecipheriv("aes-256-cbc", sessionToken, iv);
			let decryptedSession = decipher.update(encryptedSession, 'base64', 'utf8');
			decryptedSession += decipher.final('utf8');
			
			decryptedSession = JSON.parse(decryptedSession);
			["customerID", "password"].forEach(key => delete decryptedSession.user[key]);

			res.status = 200;
			res.setHeader('Content-Type', 'application/json');
			res.send(JSON.stringify({"session": decryptedSession}));
		};
	});
});

/* 	Create session, used by the cookie/session checker middleware in the backend
	Will create an empty session and returns newly created sessionID and sessionToken to the browser
*/
app.get('/session/create', async (req, res) => {
	const sessionID = crypto.randomUUID();
	const sessionToken = crypto.randomBytes(32);
	const iv = INITIALIZATION_VECTOR;
	const cipher = crypto.createCipheriv("aes-256-cbc", sessionToken, iv);
	const emptySession = JSON.stringify({
		"cart": [],
		"user": {}
	});

	let encryptedSession = cipher.update(emptySession, 'utf8', 'base64');
	encryptedSession += cipher.final('base64');

	redisClient.set(sessionID, encryptedSession, {EX: sessionTimeout});
	console.log("New Session created: " +sessionID)
	res.status(200);
	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify({
		"sessionID": sessionID,
		"sessionToken": sessionToken.toString("base64")
	}));
});

/* 	Destroy session, made for testing purposes, endpoint is not used anymore ...
*/
app.get('/session/destroy', async (req, res) => {
	const sess = JSON.parse(req.get("session"));
	const sessionID = sess.sessionID;

	redisClient.del(sessionID)
	.then(response => {
		console.log(`Session "${sessionID}" deleted, redis response: ${response}`);
		res.status(200);
		res.setHeader('Content-Type', 'application/json');
		res.send("{}");
	});
});


/* 	Start and Graceful Shutdown
	Graceful shutdown ensures proper disconnect and speeds up shutdown process.
	Also returns 0 after shutdown, so no more errors in Docker!
*/
const server = app.listen(80, () =>{
	console.log('\x1b[42m\x1b[30m Session & User Microservice Running on Port 80  \x1b[0m');
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
