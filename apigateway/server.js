const http = require('http');
const express = require('express');
const cors = require('cors');

/* 	Initializing constants from nevironment variables from the docker compose file
*/ 
const HOST_MICROSERVICE_EVENT = "http://" + process.env.HOST_MICROSERVICE_EVENT;
const HOST_MICROSERVICE_CAR = "http://" + process.env.HOST_MICROSERVICE_CAR;
const HOST_MICROSERVICE_MERCH = "http://" + process.env.HOST_MICROSERVICE_MERCH;
const HOST_MICROSERVICE_CUSTOMER = "http://" + process.env.HOST_MICROSERVICE_CUSTOMER;
const HOST_MICROSERVICE_SHOPPINGCART = "http://" + process.env.HOST_MICROSERVICE_SHOPPINGCART;

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
})

/*	ENDPOINT - servicecheck
	Checking for microservices ... this is old ... not used, thus should be improved or discarded
*/
app.get('/checkservices', async (req, res) => {
	const MICROSERVICES_HOSTS = [HOST_MICROSERVICE_EVENT,HOST_MICROSERVICE_CAR,HOST_MICROSERVICE_MERCH,HOST_MICROSERVICE_CUSTOMER];
	let DTOobject = {};

	let sendDTO = (Objkey,Objvalue) => {
		DTOobject[Objkey] = Objvalue;
		if (Object.keys(DTOobject).length == 4) {
			res.setHeader('Content-Type', 'application/json');
			res.send(DTOobject);
			DTOobject = {};
		};
	};

	MICROSERVICES_HOSTS.forEach(host => {
		fetch(host + ":80/health", {
			method: 'GET',
		})
		.then(response => {
			sendDTO(host,response.statusText);
			console.log(`"${host}": ${response.statusText}`);
		});
	});
});

/*	ENDPOINT - User
	user related endpoints, all endpoints which are accessible should have been
	sanitized in the backend, so no data-verification in POST-requests
*/
app.get('/event', (req, res) => {
	const sess = req.get("session");
	fetch(HOST_MICROSERVICE_CUSTOMER + "/user", {
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
				console.log(responseObject);
			});
		} else {
			res.sendStatus(response.status);
		};
	});

});


/*	ENDPOINT - Event
	boilerplate
*/
app.get('/content/event', (req, res) => {
	const sess = req.get("session");
	fetch(HOST_MICROSERVICE_EVENT + "/test", {
		method: "GET",
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
				res.send(JSON.stringify(responseObject));
			});
		} else {
			res.sendStatus(response.status);
		};
	});

});

app.post('/user/register', async (req, res) => {
	fetch(HOST_MICROSERVICE_CUSTOMER + "/user/register", {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(req.body)
	})
	.then(response => {
		res.sendStatus(response.status);
	});
});

app.post('/user/login', async (req, res) => {
	const sess = req.get("session");
	fetch(HOST_MICROSERVICE_CUSTOMER + "/user/login", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		},
		body: JSON.stringify(req.body)
	})
	.then(response => {
		res.sendStatus(response.status);
	});
});

app.get('/user/logout', async (req, res) => {
	const sess = req.get("session");
	fetch(HOST_MICROSERVICE_CUSTOMER + "/user/logout", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		}
	})
	.then(response => {
		res.sendStatus(response.status);
	});
});

app.get('/session/get', async (req, res) => {
	const sess = req.get("session");
	fetch( HOST_MICROSERVICE_CUSTOMER + "/session/get", {
		"method": "GET",
		"headers": {
			"Accept": "application/json",
			"session": sess
		}
	})
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseObject => {
				res.status(200);
				res.setHeader('Content-Type', 'application/json');
				res.send(JSON.stringify(responseObject));
			});
		} else {
			res.sendStatus(response.status);
		};
	});
});

app.get('/session/create', async (req, res) => {
	fetch( HOST_MICROSERVICE_CUSTOMER + "/session/create", {
		"method": "GET",
		"headers": {
			"Accept": "application/json"
		}
	})
	.then(response => {
		if (response.status == 200) {
			responseObject = response.json()
			.then(responseObject => {
				console.log(responseObject);
				res.status(200);
				res.setHeader('Content-Type', 'application/json');
				res.send(JSON.stringify(responseObject));
			});
		};
	});
});

/*	ENDPOINT - content
	used by the backend-views ... this just fetches a bit of everything
	plain data from merch/car microservices and session info from customer microservice
	Promise.all is the way to aggregate promises!
	No more counting fetch requests in arrays
*/
app.get('/content/car', async (req, res) => {
	const sess = req.get("session");

	Promise.all([
		fetch(HOST_MICROSERVICE_CAR + "/all")
		.then(response => {
			if (response.status == 200) {
				return response.json();
			}
			throw new Error(`\x1b[41m ERROR: Failed to fetch Items from Car-Service! \x1b[0m`);
		})
		.catch(error => {
			console.log(error);
		}),
		fetch(HOST_MICROSERVICE_CUSTOMER + "/session/get", {
		headers: {
			"session": sess
			}
		})
		.then(response => {
			if (response.status == 200) {
				return response.json();
			}
			throw new Error(`\x1b[41m ERROR: Failed to fetch Session! \x1b[0m`);
		})
		.catch(error => {
			console.log(error);
		}),
	])
	.then(DTOArray => {
		console.log("Car Content Request fulfilled!");
		res.status(200);
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(DTOArray));
	});
});

/*	carInfo endpoint is used by clientside JS configurator function
*/
app.post('/carInfo', async (req, res) => {
	fetch(HOST_MICROSERVICE_CAR + "/carInfo", {
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
			res.sendStatus(401);
		};
	});
});


app.get('/content/merch', async (req, res) => {
	const sess = req.get("session");

	Promise.all([
		fetch(HOST_MICROSERVICE_MERCH + "/all")
		.then(response => {
			if (response.status == 200) {
				return response.json();
			}
			throw new Error(`\x1b[41m ERROR: Failed to fetch Items from Merch-Service! \x1b[0m`);
		})
		.catch(error => {
			console.log(error);
		}),
		fetch(HOST_MICROSERVICE_CUSTOMER + "/session/get", {
		headers: {
			"session": sess
			}
		})
		.then(response => {
			if (response.status == 200) {
				return response.json();
			}
			throw new Error(`\x1b[41m ERROR: Failed to fetch Session! \x1b[0m`);
		})
		.catch(error => {
			console.log(error);
		}),
	])
	.then(DTOArray => {
		console.log("Car Content Request fulfilled!");
		res.status(200);
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(DTOArray));
	});
});


/*	ENDPOINT - shopping cart
	self-explanatory except for the post, which collects info from the merch/car database,
	since backend only transmits the IDs (and sometimes a bit of config) of items which are pushed
	to the shoppingcart ... remaining info is directly fetched from db
*/
app.delete('/shoppingcart', async (req, res) => {
	const sess = req.get("session");
	fetch(HOST_MICROSERVICE_SHOPPINGCART + "/shoppingCart", {
		method: "DELETE",
		headers: {
			"Content-Type": "application/json",
			"session": sess
		}
	})
	.then(response => res.sendStatus(response.status));
});

app.get('/shoppingcart', async (req, res) => {
	fetch(HOST_MICROSERVICE_SHOPPINGCART + "/shoppingCart", {
		method: "GET",
	})
	.then(response => res.sendStatus(response.status));
});

app.post('/shoppingcart', async (req, res) => {
	const sess = req.get("session");
	const { itemType, itemID, config } = req.body;
	let endpointUrl;
	let fetchBody;
	console.log("CONFIG: " +config);

	if (itemType == "merch") {
		endpointUrl = HOST_MICROSERVICE_MERCH + "/single";
		fetchBody = JSON.stringify({ "ID": itemID });
	} else if (itemType == "car") {
		endpointUrl = HOST_MICROSERVICE_CAR + "/singleConfigured";
		fetchBody = JSON.stringify({ "ID": itemID, "config": config });
	};

	console.log(`Fetching Info for ${itemType} with ID: ${itemID} from ${endpointUrl}`);
	fetch(endpointUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: fetchBody
	})
	.then(response => {
		if (response.status == 200) {
			response.json()
			.then(responseObject => {
				fetch(HOST_MICROSERVICE_SHOPPINGCART + "/shoppingCart", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"session": sess
					},
					body: JSON.stringify(responseObject)
				})
				.then(response => {
					res.sendStatus(response.status);
				});
			});
		} else {
			console.log(`\x1b[41m ERROR: Failed to fetch item! \x1b[0m`);
			res.sendStatus(401);
		};
	});
});

/* 	Start and Graceful Shutdown
	Graceful shutdown ensures proper disconnect and speeds up shutdown process.
	Also returns 0 after shutdown, so no more errors in Docker!
*/
const server = app.listen(80, () =>{
	console.log('\x1b[42m\x1b[30m API-Gateway Running on Port 80  \x1b[0m');
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
