const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const HOST_DB_MERCH = process.env.HOST_DB_MERCH;
const DB_PASSWORD = process.env.DB_PASSWORD;

/* Express + Middleware 
*/
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

/*	Set up MySQL connection 
*/
const connection = mysql.createPool({
    host: HOST_DB_MERCH,
    user: "root",
    password: DB_PASSWORD,
    database: "merch",
});

/*	ENDPOINT - Healthcheck 
	Used by docker to determine container health
*/
app.get('/health', (req, res) => {
    res.sendStatus(200);
});
  
/*	ENDPOINT - Fetches for either all elements or a single element
    All elements is primarily for backend views
    Single element is for fetching item info for storage in the session
*/
app.get('/all', async (req, res) => {
    let sqlResponse = await connection.promise().query(`SELECT * from merch`);
    let responseDTO = sqlResponse[0];
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        "merch": responseDTO
    }));
    console.log(`DB fetch: ${responseDTO.length} results`);	
});

app.post('/single', async (req, res) => {
    if (!req.body.ID) {
        console.log(`\x1b[41m ERROR: Wrong Data-Format, body: ${JSON.stringify(req.body)} \x1b[0m`);
        res.sendStatus(401);
    } else {
        let sqlResponse = await connection.promise().query(`SELECT * from merch WHERE merchID = ${req.body.ID}`);
        let items = sqlResponse[0];
        if (items.length == 0) {
            console.log("\x1b[41m ERROR: No matching entry found \x1b[0m");
            res.sendStatus(401);
        } else {
            console.log("Matching SQL-entry found");
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(items[0]));
        };
    };
});


/* 	Start and Graceful Shutdown
	Graceful shutdown ensures proper disconnect and speeds up shutdown process.
	Also returns 0 after shutdown, so no more errors in Docker!
*/
const server = app.listen(80, () =>{
	console.log('\x1b[42m\x1b[30m Merchandise Microservice Running on Port 80  \x1b[0m');
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
