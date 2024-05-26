/* MagicMirror²
 * Module: MMM-Strava-Last-Activity-Map
 *
 * By Tyler Stambaugh
 */

/* global google */

Module.register("MMM-Strava-Last-Activity-Map", {
	baseUrl: "https://www.strava.com/api/v3/",
	tokenUrl: "https://www.strava.com/oauth/token?",
	googleMapsApiUrl: "",
	accessTokenError: {},
	apiData: {
		title: "",
		activityDate: null,
		distance: 0,
		minutes: 0,
		hours: 0,
		latitude: -25.344,
		longitude: 131.031,
		summaryPolyLine: ""
	},

	// Module config defaults.
	defaults: {
		zoom: 10,
		mapTypeId: "roadmap",
		styledMapType: "standard",
		disableDefaultUI: true,
		header: "Last Activity on Strava",
		initialLoadDelay: 1000,
		retryDelay: 2500,
		updateInterval: 60 * 15 * 1000,
		loading: true,
		width: "250px",
		height: "250px"
	},

	init () {
	},

	getHeader () {
		return this.config.header || "Strava Last Activity Map";
	},

	start () {
		Log.info(`Starting module: ${this.name}`);
		this.sendSocketNotification("LOG", `Starting node_helper for: ${this.name}`);

		this.apiData = {};
		this.scheduleUpdate();
	},

	scheduleUpdate () {
		setInterval(() => {
			this.getApiData();
		}, this.config.updateInterval);
		this.getApiData();
	},

	notificationReceived () {},
	getDom () {
		var wrapper = document.createElement("div");

		if (this.accessTokenError && Object.keys(this.accessTokenError).length > 0) {
			var errorWrapper = document.createElement("div");
			errorWrapper.className = "small bright";
			errorWrapper.innerHTML = `Error fetching access token: ${JSON.stringify(this.accessTokenError)}`;
			wrapper.appendChild(errorWrapper);
		} else {
			// Display activity details below the map
			var detailsWrapper = document.createElement("div");
			detailsWrapper.className = "small bright";
			detailsWrapper.innerHTML = `
				<p>${this.apiData.name} - ${this.apiData.activityDate}</p>
				<p>Distance: <span classname="value">${this.apiData.distance} </span>miles</p>
				<p>Time: <span classname="value">${this.apiData.hours} </span> hours  <span classname="value">${this.apiData.minutes} </span> minutes</p>
			`;
			wrapper.appendChild(detailsWrapper);
		}
		var mapContainer = document.createElement("div");
		mapContainer.setAttribute("id", "map");
		mapContainer.style.height = `${this.config.height}`;
		mapContainer.style.width = `${this.config.width}`;

		wrapper.appendChild(mapContainer);


		this.initializeMap();

		return wrapper;
	},

	initializeMap () {
		if (typeof google === "undefined" || typeof google.maps === "undefined") {
			setTimeout(() => { this.initializeMap(); }, 100);
			return;
		}
		Log.info("initialize map function:", document.getElementById("map"));
		const map = new google.maps.Map(document.getElementById("map"), {
			zoom: this.config.zoom,
			center: { lat: this.apiData.latitude, lng: this.apiData.longitude },
			mapTypeId: this.config.mapTypeId,
			styles: this.styledMapType,
			disableDefaultUI: this.config.disableDefaultUI,
			backgroundColor: this.config.backgroundColor
		});

		const decodedPath = this.decodePolyline(this.apiData.summaryPolyLine);
		const polyline = new google.maps.Polyline({
			path: decodedPath,
			geodesic: true,
			strokeColor: "#FF0000",
			strokeOpacity: 1.0,
			strokeWeight: 2
		});
		polyline.setMap(map);

		// Calculate bounds of the polyline
		const bounds = new google.maps.LatLngBounds();
		decodedPath.forEach((point) => {
			bounds.extend(new google.maps.LatLng(point.lat, point.lng));
		});

		// Fit the map to the polyline bounds
		map.fitBounds(bounds);

		google.maps.event.addListenerOnce(map, "bounds_changed", () => {
			map.setZoom(map.getZoom() + 1);
		});
	},

	decodePolyline (encoded) {
		let points = [];
		let index = 0,
			len = encoded.length;
		let lat = 0,
			lng = 0;

		while (index < len) {
			let b,
				shift = 0,
				result = 0;
			do {
				b = encoded.charAt(index++).charCodeAt(0) - 63;
				result |= (b & 0x1f) << shift;
				shift += 5;
			} while (b >= 0x20);
			let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
			lat += dlat;

			shift = 0;
			result = 0;
			do {
				b = encoded.charAt(index++).charCodeAt(0) - 63;
				result |= (b & 0x1f) << shift;
				shift += 5;
			} while (b >= 0x20);
			let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
			lng += dlng;

			points.push({ lat: (lat / 1e5), lng: (lng / 1e5) });
		}

		return points;
	},

	getApiData () {
		let payload = {
			url: this.baseUrl,
			tokenUrl: this.tokenUrl,
			clientId: this.config.stravaClientId,
			clientSecret: this.config.stravaClientSecret,
			refreshToken: this.config.stravaRefreshToken,
			after: Math.floor(
				new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).getTime() / 1000
			),
			before: Math.floor(
				new Date(Date.now() - 1 * 2 * 60 * 60 * 1000).getTime() / 1000
			)
		};
		this.sendSocketNotification("GET_STRAVA_DATA", payload);
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "LOG") {
			Log.info("STRAVA-LAST-ACTIVITY-MAP NodeHelper log:", payload);
		}
		if (notification === "ACCESS_TOKEN_ERROR") {
			this.accessTokenError = payload;
			this.updateDom();
		}
		if (notification === "STRAVA_DATA_RESULT") {
			this.loading = true;
			this.apiData = payload;
			Log.info("LAST-ACTIVITY-MAP: Strava API response data in socketNotificationReceived:", this.apiData);
			this.loading = false;
			this.loadGoogleMapsScript();
			this.updateDom();
		}
	},


	loadGoogleMapsScript () {
		if (this.config.googleMapsApiKey === "") {
			Log.error("MMM-Strava-Last-Activity-Map: Google Maps API key not set!");
		} else {
			const googleMapsScript = document.createElement("script");
			Log.info("Google maps script:", googleMapsScript);
			googleMapsScript.type = "text/javascript";
			googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.googleMapsApiKey}&callback=initMap`;
			googleMapsScript.async = true;
			googleMapsScript.defer = true;
			window.initMap = this.initializeMap.bind(this);
			document.head.appendChild(googleMapsScript);
		}
	},

	getStyles () {
		return ["MMM-Strava-Last-Activity-Map.css"];
	}
});
