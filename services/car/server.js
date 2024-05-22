const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const HOST_DB_CAR = process.env.HOST_DB_CAR;
const DB_PASSWORD = process.env.DB_PASSWORD;

/*	Set up MySQL connection 
*/
const connection = mysql.createPool({
    host: HOST_DB_CAR,
    user: "root",
    password: DB_PASSWORD,
    database: "car",
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

/*	ENDPOINT - Fetches for either all elements or a single element
    All elements is primarily for backend views
    Single element is obsolete ... no need for car information without part-information!
    Singleconfigured is for storing a configured car object in session cache
*/
app.get('/all', async (req, res) => {
    let sqlResponse = await connection.promise().query(`SELECT * from cars`);
    let responseDTO = sqlResponse[0];
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        "cars": responseDTO
    }));
    console.log(`DB fetch: ${responseDTO.length} results`);	
});

/*	OBSOLETE! WAS REPLACED BY /carInfo!!!!
*/
app.post('/single', async (req, res) => {
    if (!req.body.ID) {
        console.log(`\x1b[41m ERROR: Wrong Data-Format - ${JSON.stringify(req.body)} \x1b[0m`);
        res.sendStatus(401);
    } else {
        let sqlResponse = await connection.promise().query(`
            SELECT * 
            FROM cars 
            WHERE carID = ${req.body.ID}
            LIMIT 1
        `);
        let carInfoArray = sqlResponse[0];
        if (carInfoArray.length == 0) {
            console.log(`\x1b[41m ERROR: No matching DB-Entry \x1b[0m`);
            res.sendStatus(401);
        } else {
            console.log(`Found matching DB-Entry`);
            res.status(200);
            res.setHeader('Content-Type', 'application/json');
            res.send(carInfoArray[0]);
        };
    };
});

app.post('/singleConfigured', async (req, res) => {
    if (!req.body.ID) {
        console.log(`\x1b[41m ERROR: Wrong Data-Format - ${JSON.stringify(req.body)} \x1b[0m`);
        res.sendStatus(401);
    } else {
        Promise.all([
            connection.promise().query(`SELECT * FROM cars WHERE carID = ${req.body.ID} LIMIT 1`)
            .then(sqlResponse => {return sqlResponse[0][0]}),
            connection.promise().query(`SELECT * FROM colors WHERE colorID = ${req.body.config.colorID} LIMIT 1`)
            .then(sqlResponse => {return sqlResponse[0][0]}),
            connection.promise().query(`SELECT * FROM parts WHERE partID IN (${req.body.config.rimID}, ${req.body.config.spoilerID})`)
            .then(sqlResponse => {return sqlResponse[0]}),
        ])
        .then(responseArray => {
            let responseObject = responseArray[0];
            responseObject.basePrice = responseObject.price;
            responseObject.config = {
                "color": responseArray[1]
            };
            responseObject.config[responseArray[2][0].type] = responseArray[2][0];
            responseObject.config[responseArray[2][1].type] = responseArray[2][1];

            responseObject.price += responseObject.config.color.price;
            responseObject.price += responseObject.config.spoiler.price;
            responseObject.price += responseObject.config.rim.price;

            console.log("RESPONSEOBJECT: " +JSON.stringify(req.body));
            res.status(200);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(responseObject));
        });
    };
});

/*	USE THIS INSTEAD OF /single!!!
*/
app.post('/carInfo', async (req, res) => {
    if (!req.body.ID) {
        console.log(`\x1b[41m ERROR: Wrong Data-Format - ${JSON.stringify(req.body)} \x1b[0m`);
        res.sendStatus(401);
    } else {
        Promise.all([
            connection.promise().query(`SELECT * FROM cars WHERE carID = ${req.body.ID} LIMIT 1`)
            .then(sqlResponse => {return sqlResponse[0][0]}),
            connection.promise().query(`SELECT * FROM colors WHERE carID = ${req.body.ID}`)
            .then(sqlResponse => {return sqlResponse[0]}),
            connection.promise().query(`SELECT * FROM parts WHERE carID = ${req.body.ID} AND type = "spoiler"`)
            .then(sqlResponse => {return sqlResponse[0]}),
            connection.promise().query(`SELECT * FROM parts WHERE carID = ${req.body.ID} AND type = "rim"`)
            .then(sqlResponse => {return sqlResponse[0]}),
        ])
        .then(responseArray => {
            let responseObject = responseArray.shift();
            responseObject.colors = responseArray[0].reduce((obj, item) => {
                return { ...obj, [item["colorID"]]: item};}, {}
            );

            responseObject.parts = {};    
            responseObject.parts.spoiler = responseArray[1].reduce((obj, item) => {
                return { ...obj, [item["partID"]]: item};}, {}
            );
                
            responseObject.parts.rims = responseArray[2].reduce((obj, item) => {
                return { ...obj, [item["partID"]]: item};}, {}
            );
                
            res.status(200);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(responseObject));
        });
    };
});

/* 	Start and Graceful Shutdown
	Graceful shutdown ensures proper disconnect and speeds up shutdown process.
	Also returns 0 after shutdown, so no more errors in Docker!
*/
const server = app.listen(80, () =>{
	console.log('\x1b[42m\x1b[30m Car Microservice Running on Port 80  \x1b[0m');
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
