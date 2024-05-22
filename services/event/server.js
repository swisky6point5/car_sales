const http = require('http');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const HOST_DB_EVENTS = process.env.HOST_DB_EVENTS;
const DB_PASSWORD = process.env.DB_PASSWORD;

/*	Set up MySQL connection 
*/
const connection = mysql.createPool({
    host: HOST_DB_EVENTS,
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

/*	ENDPOINT - Test for  weather implementation
	Check API description at: https://open-meteo.com/en/docs
	works fine ... should this be a seperate microservice?
*/
app.get('/test', function(req, res) {
	fetch("https://api.open-meteo.com/v1/forecast?latitude=48.89&longitude=9.19&current=temperature_2m,relative_humidity_2m,apparent_temperature,rain,showers,snowfall,wind_speed_10m&timezone=Europe%2FBerlin&forecast_days=1")
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseObject => {
				console.log(JSON.stringify(responseObject));
				res.status(200);
				res.setHeader('Content-Type', 'application/json');
				res.send(responseObject);
			});
		} else {
			res.sendStatus(401);
		};
	})
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
