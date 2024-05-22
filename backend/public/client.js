console.log("Clientside Merchandise JS loaded");

const merchNodes = document.querySelectorAll(".buyButton");
merchNodes.forEach((node) => {
    if (node.classList.contains("merch")) {
        node.addEventListener("click", () => {
            addToCart({
                "itemType": "merch",
                "itemID": node.attributes.getNamedItem("merch_id").value
            });
        })
    }
});

/*  too lazy to make this pretty ... alert windows to the rescue!!!
*/
async function register() {
    fetch("http://localhost:80/user/register", {
        "method": "POST",
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        "body": JSON.stringify({
            "userlogin": document.getElementById("inputEmailRegister").value,
            "password": document.getElementById("inputPasswordRegister").value,
            "firstName": document.getElementById("inputFirstNameRegister").value,
            "lastName": document.getElementById("inputLastNameRegister").value
        })
    })
    .then(response => {
        if (response.status == 200) {
            console.log("Register successful");
            alert("NEW USER REGISTERED SUCCESSFULLY! PLEASE LOG IN");
            location.reload();
        } else {
            alert("FAIL!!!!");
            console.log("Login failed");
        }
    })
}

async function login() {
    fetch("http://localhost:80/user/login", {
        "method": "POST",
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        "body": JSON.stringify({
            "userlogin": document.getElementById("inputEmail").value,
            "password": document.getElementById("inputPassword").value
        })
    })
    .then(response => {
        if (response.status == 200) {
            console.log("Login successful");
            location.reload();
        } else {
            const div = document.createElement("div");
            div.innerHTML = "falsch, lol";
            div.classList.add("fade-out");
            document.getElementById("login").appendChild(div);
            console.log("Login failed");
        }
    })
}

function logout() {
    fetch("http://localhost:80/user/logout")
    .then(response => {
        if (response.status == 200) {
            console.log("Logout successful");
            location.reload();
        } else {
            console.log("Logout failed");
        }
    })
}

function addToCart(item) {
    fetch("http://localhost:80/shoppingcart", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/json",
        },
        "body": JSON.stringify(item)
    })
    .then(response => {
        location.reload();
    })
}

function deleteCart() {
    fetch("http://localhost:80/shoppingcart", {
        "method": "DELETE"
    })
    .then(response => {
        location.reload();
    })
}

function testdrive(carID) {
    console.log(`Clicked on carID: ${carID}`);
}

/*  This shit is global! 
*/
var carObject = {}; 
var selectedCarColor;
var selectedCarRim;
var selectedCarSpoiler;


function openRegister() {
    document.getElementById("register").style.display = "block";
};

function openModal(carID) {
    console.log(`Fetching additional info for car "${carID}"`);
    fetch("http://localhost:80/carInfo", {
        "method": "POST",
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        "body": JSON.stringify({
            "ID": carID
        })
    })
    .then(response => {
        response.json()
        .then(responseObject => {
            console.log(responseObject);
            carObject = responseObject;

            selectedCarColor = carObject.colors[Object.keys(carObject.colors)[0]];
            selectedCarRim = carObject.parts.rims[Object.keys(carObject.parts.rims)[0]];
            selectedCarSpoiler = carObject.parts.spoiler[Object.keys(carObject.parts.spoiler)[0]];
            showPrices(carObject,selectedCarColor,selectedCarRim,selectedCarSpoiler);

            document.getElementById("configurator").style.display = "block";
            document.getElementById("configuratorCarName").innerText = carObject.name;
            document.getElementById("configuratorCarDescription").innerText = carObject.description;
            document.getElementById("configuratorImageLayerBase").src = selectedCarColor.pictureLink;
            document.getElementById("configuratorImageLayerSpoiler").src = selectedCarSpoiler.pictureLink;
            document.getElementById("configuratorImageLayerRims").src = selectedCarRim.pictureLink;

            document.getElementById("configuratorColors").replaceChildren();
            for (const color of Object.values(carObject.colors)) {
                let selectColor = document.createElement("option");
                selectColor.innerText = color.color;
                selectColor.value = color.colorID;
                document.getElementById("configuratorColors").append(selectColor);
            }

            document.getElementById("configuratorSpoiler").replaceChildren();
            for (const spoiler of Object.values(carObject.parts.spoiler)) {
                let selectSpoiler = document.createElement("option");
                selectSpoiler.innerText = spoiler.name;
                selectSpoiler.value = spoiler.partID;
                document.getElementById("configuratorSpoiler").append(selectSpoiler);
            }

            document.getElementById("configuratorRims").replaceChildren();
            for (let rim of Object.values(carObject.parts.rims)) {
                let selectRim = document.createElement("option");
                selectRim.innerText = rim.name;
                selectRim.value = rim.partID;
                document.getElementById("configuratorRims").append(selectRim);
            }
        })
    })

}

document.getElementById("configuratorColors").addEventListener("change", () => {
    selectedCarColor = carObject.colors[document.getElementById("configuratorColors").value];
    document.getElementById("configuratorImageLayerBase").src = selectedCarColor.pictureLink;
    showPrices(carObject,selectedCarColor,selectedCarRim,selectedCarSpoiler);
})

document.getElementById("configuratorSpoiler").addEventListener("change", () => {
    selectedCarSpoiler = carObject.parts.spoiler[document.getElementById("configuratorSpoiler").value];
    console.log(selectedCarSpoiler);
    document.getElementById("configuratorImageLayerSpoiler").src = selectedCarSpoiler.pictureLink;
    showPrices(carObject,selectedCarColor,selectedCarRim,selectedCarSpoiler);
})

document.getElementById("configuratorRims").addEventListener("change", () => {
    selectedCarRim = carObject.parts.rims[document.getElementById("configuratorRims").value];
    console.log(selectedCarRim);
    document.getElementById("configuratorImageLayerRims").src = selectedCarRim.pictureLink;
    showPrices(carObject,selectedCarColor,selectedCarRim,selectedCarSpoiler);
})

document.getElementById("addCarToCart").addEventListener("click", () => {
    const DTOObject = {
        "itemType": "car",
        "itemID": carObject.carID,
        "config": {
            "colorID": selectedCarColor.colorID,
            "rimID": selectedCarRim.partID,
            "spoilerID": selectedCarSpoiler.partID
        }
    };
    console.log(DTOObject);
    addToCart(DTOObject);
    closeModal();
})

function closeModal() {
    document.getElementById("configurator").style.display = "none";
    document.getElementById("register").style.display = "none";
}

function showPrices(car, color, rim, spoiler) {
    document.getElementById("priceCarBase").innerText = `Base Price: ${car.price} EUR`;
    document.getElementById("priceCarColor").innerText = `+ Coating: ${color.price} EUR`;
    document.getElementById("priceCarRims").innerText = `+ Rims: ${rim.price} EUR`;
    document.getElementById("priceCarSpoiler").innerText = `+ Spoiler: ${spoiler.price} EUR`;
    document.getElementById("priceCarTotal").innerText = `Total: ${(car.price + color.price + rim.price + spoiler.price).toFixed(2)} EUR`;
}

window.onclick = function(event) {
    if (event.target == document.getElementById("configurator")) {
        document.getElementById("configurator").style.display = "none";
    }
}

/*  >_< *weeps in OOP*
    Made this too late at night
*/