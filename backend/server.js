const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const HOST_API = "http://" + process.env.HOST_API_GATEWAY;


/* Express + Middleware 
*/
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(cookieParser());

/*	Cookie/Session check ... this middleware-function executes on EVERY fetch!
	Checks if session-cookie is present, otherwise creates a session in Redis and stores
	credentials in a new session-cookie
*/
app.use((req, res, next) => {
	const sessCookie = req.cookies.carshop_session;
	if (sessCookie === undefined) {
		console.log("COOKIE-CHECK: No Session-Cookie present, creating new session ...");
		fetch(HOST_API +"/session/create", {
			method: "GET",
			headers: { "Accept": "application/json" }
		}).then(response => {
			response.json()
			.then(responseObject => {
				responseString = JSON.stringify(responseObject);
				res.cookie("carshop_session", responseString, {maxAge: 24 * 3600 * 1000});
				req.cookies.carshop_session = responseString;
				console.log("COOKIE-CHECK: Session-Cookie created successfully");
				next();
			})
		})
	} else {
		next();
	}
});
app.use(express.static(__dirname + '/public'));
app.set('views', './views');
app.set('view engine', 'ejs');

/*	ENDPOINT - Healthcheck 
	Used by docker to determine container health
*/
app.get('/health', (req, res) => {
	res.sendStatus(200);
});

/* 	ENDPOINT - Views
	Fetches all necessary data for rendering the three views /car /merch and /event
*/
app.get("/", async (req, res) => {
	res.redirect("/car");
});

app.get("/car", async (req, res) => {
	const sess = req.cookies.carshop_session;
	
	fetch(HOST_API + "/content/car", {
		headers: {
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseArray => {
				let responseObject = {};
				responseArray.forEach(element => {
					responseObject[Object.keys(element)[0]] = Object.values(element)[0];
				});
				res.render("car",{...responseObject});
			});
		} else {
			throw new Error(`\x1b[41m ERROR: GET:/car: Failed load necessary data for Car-View! \x1b[0m`);
		};
	})
	.catch(error => {
		res.sendStatus(401);
		console.log(error);
	});
});


app.get("/merch", async (req, res) => {
	const sess = req.cookies.carshop_session;
	
	fetch(HOST_API + "/content/merch", {
		headers: {
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseArray => {
				let responseObject = {};
				responseArray.forEach(element => {
					responseObject[Object.keys(element)[0]] = Object.values(element)[0];
				});
				res.render("merch",{...responseObject});
			});
		} else {
			throw new Error(`\x1b[41m ERROR: GET:/merch: Failed load necessary data for Merch-View! \x1b[0m`);
		};
	})
	.catch(error => {
		res.sendStatus(401);
		console.log(error);
	});
});


app.get("/event", async (req, res) => {
	const sess = req.cookies.carshop_session;
	
	fetch(HOST_API + "/content/event", {
		headers: {
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseObject => {
				res.status(200);
				res.setHeader('Content-Type', 'application/json');
				res.send(responseObject);
			});
		} else {
			throw new Error(`\x1b[41m ERROR: GET:/event: Failed load necessary data for Event-View! \x1b[0m`);
		}
	})
	.catch(error => {
		res.sendStatus(401);
		console.log(error);
	});
});


/* 	ENDPOINT - Users
	Used by clientside JS for register / login / logout
*/
app.post("/user/register", (req, res) => {
	const { userlogin, password, firstName, lastName } = req.body;
	if (userlogin && password && firstName && lastName) {
		fetch(HOST_API + "/user/register", {
			method: "POST",
			body: JSON.stringify(req.body),
			"headers": {
				"Content-Type": "application/json",
			}
		})
		.then(response => {
			res.sendStatus(response.status);
		});
	} else {
		console.log(`\x1b[41m ERROR - POST:/user/register: invalid request-body! \x1b[0m`);
		res.sendStatus(401);
	};
});

app.post("/user/login", (req, res) => {
	const sess = req.cookies.carshop_session;
	const { userlogin, password } = req.body;
	if (userlogin && password) {
		fetch(HOST_API + "/user/login", {
			method: "POST",
			body: JSON.stringify({
				userlogin: userlogin,
				password: password
			}),
			"headers": {
				"Content-Type": "application/json",
				"session": sess
			}
		})
		.then(response => {
			res.sendStatus(response.status);
		});
	} else {
		console.log(`\x1b[41m ERROR - POST:/user/login: invalid request-body! \x1b[0m`);
		res.sendStatus(401);
	};
});

app.get("/user/logout", (req, res) => {
	const sess = req.cookies.carshop_session;
	fetch(HOST_API + "/user/logout", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 200) {
			console.log("Logout successful");
		}
		res.sendStatus(response.status);
	});
});

/* 	ENDPOINT - Session
	Session related endpoints ... just a session GET for debugging via browser
*/
app.get("/session", (req, res) => {
	const sess = req.cookies.carshop_session;
	fetch(HOST_API + "/session/get", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseObject => {
				res.status(200);
				res.setHeader('Content-Type', 'application/json');
				res.send(responseObject);
			})
		} else if (response.status == 404) {
			console.log("\x1b[41m ERROR: GET:/session: Redis-DB Error! Deleting session cookie and forcing reload! \x1b[0m");
			res.clearCookie("carshop_session");
			res.redirect("/");
		} else {
			res.sendStatus(response.status);
		};
	});
});

/* 	ENDPOINT - Shoppingcart
	Used by clientside JS for updating / deleting shopping cart content
*/
app.post("/shoppingcart", (req, res) => {
	const sess = req.cookies.carshop_session;
	fetch(HOST_API + "/shoppingcart", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		},
		body: JSON.stringify(req.body)
	})
	.then(response => {
		if (response.status == 200) {
			res.sendStatus(200);
		} else if (response.status == 404) {
			console.log("\x1b[41m ERROR: POST:/shoppingcart: Redis-DB Error! Deleting session cookie and forcing reload! \x1b[0m");
			res.cookie("carshop_session", "deleted", {expires: "Thu, 01 Jan 1970 00:00:00 GMT"});
			res.redirect("/");
		} else if (response.status == 401) {
			console.log("\x1b[33m WARNING: POST:/shoppingcart: Could not fetch Item from DB \x1b[0m");
			res.sendStatus(401);
		} else {
			res.sendStatus(response.status);
		};
	});
});

app.delete("/shoppingcart", (req, res) => {
	const sess = req.cookies.carshop_session;
	fetch(HOST_API + "/shoppingcart", {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 404) {
			console.log("\x1b[41m ERROR: GET:/session: Redis-DB Error! Deleting session cookie and forcing reload! \x1b[0m");
			res.clearCookie("carshop_session");
		}
		res.redirect("/");
	});
});


/* 	ENDPOINT - CarInfo
	Used by clientside JS for configurator, fetches additional car information about colors and parts
*/
app.post("/carInfo", async (req, res) => {
	const { ID } = req.body;
		if (ID) { 
		fetch(HOST_API + "/carInfo", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(req.body)
		})
		.then(response => {
			if (response.status == 200) {
				response.json()
				.then(responseObject => {
					res.send(JSON.stringify(responseObject));
				});
			} else {
				console.log("\x1b[33m WARNING: Could not fetch Item from DB \x1b[0m");
				res.sendStatus(404);
			}
		});
	} else {
		console.log(`\x1b[41m ERROR - POST:/user/login: invalid request-body! \x1b[0m`);
		res.sendStatus(401);
	};
});


/* 	Start and Graceful Shutdown
	Graceful shutdown ensures proper disconnect and speeds up shutdown process.
	Also returns 0 after shutdown, so no more errors in Docker!
*/
const server = app.listen(80, () =>{
	console.log('\x1b[42m\x1b[30m Backend Running on Port 80  \x1b[0m');
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
