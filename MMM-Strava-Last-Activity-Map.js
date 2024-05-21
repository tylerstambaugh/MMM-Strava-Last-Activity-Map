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
		map: null,
		distance: 0,
		minutes: 0,
		hours: 0,
		summaryPolyLine: ""
	},

	// Module config defaults.
	defaults: {
		stravaClientId: "",
		stravaClientSecret: "",
		stravaRefreshToken: "",
		googleMapsApiKey: "",
		zoom: 10,
		mapTypeId: "roadmap",
		styledMapType: "standard",
		disableDefaultUI: true,
		header: "Last Activity on Strava",
		numberOfDaysToQuery: 7,
		maxWidth: "250px",
		initialLoadDelay: 4250,
		retryDelay: 2500,
		updateInterval: 60 * 15 * 1000,
		loading: true
	},

	init () {
		this.apiData = {};
	},

	getHeader () {
		return this.config.header || "Strava Last Activity Map";
	},

	start () {
		var self = this;
		Log.info(`Starting module: ${this.name}`);
		this.apiData = {};
		this.scheduleUpdate();

		if (this.config.googleMapsApiKey === "") {
			Log.error("MMM-Strava-Last-Activity-Map: Google Maps API key not set!");
		} else {
			// Add the Google Maps API script
			const googleMapsScript = document.createElement("script");
			googleMapsScript.type = "text/javascript";
			googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.googleMapsApiKey}&callback=initMap`;
			googleMapsScript.async = true;
			googleMapsScript.defer = true;
			window.initMap = function () {
				self.initializeMap();
			};
			document.head.appendChild(googleMapsScript);
		}
	},

	scheduleUpdate () {
		setInterval(() => {
			this.getApiData();
		}, this.config.updateInterval);
		this.getApiData(this.config.initialLoadDelay);
		var self = this;
	},

	notificationReceived () {},

	getDom () {
		var lat = this.config.lat;
		var lng = this.config.lng;

		var wrapper = document.createElement("div");
		wrapper.setAttribute("id", "map");

		wrapper.style.height = this.config.height;
		wrapper.style.width = this.config.width;

		return wrapper;
	},

	initializeMap () {
		var self = this;
		if (typeof google === "undefined" || typeof google.maps === "undefined") {
			setTimeout(() => { self.initializeMap(); }, 100);
			return;
		}

		const position = { lat: -25.344, lng: 131.031 };
		const map = new google.maps.Map(document.getElementById("map"), {
			zoom: self.config.zoom,
			center: { lat: self.config.lat, lng: self.config.lng },
			mapTypeId: self.config.mapTypeId,
			styles: self.styledMapType,
			disableDefaultUI: self.config.disableDefaultUI,
			backgroundColor: self.config.backgroundColor
		});

		const decodedPath = self.decodePolyline(self.apiData.summaryPolyLine);
		const polyline = new google.maps.Polyline({
			path: decodedPath,
			geodesic: true,
			strokeColor: "#FF0000",
			strokeOpacity: 1.0,
			strokeWeight: 2
		});
		polyline.setMap(map);
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
			clientId: this.config.clientId,
			clientSecret: this.config.clientSecret,
			refreshToken: this.config.refreshToken,
			after: Math.floor(
				new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).getTime() / 1000
			),
			before: Math.floor(
				new Date(Date.now() - 1 * 2 * 60 * 60 * 1000).getTime() / 1000
			)
		};
		console.error(
			"Sending request to node helper to get strava data"
		);
		this.sendSocketNotification("GET_STRAVA_DATA", payload);
	},

	// this gets data from node_helper
	socketNotificationReceived (notification, payload) {
		if (notification === "ACCESS_TOKEN_ERROR") {
			this.accessTokenError = payload;
		}
		if (notification === "STRAVA_DATA_RESULT") {
			this.loading = true;
			this.apiData = payload;
			this.loading = false;
			this.updateDom();
		}
	},

	getStyles () {
		return ["font-awesome.css", "MMM-Strava-Last-Activity-Map.css"];
	}

	// getTemplate () {
	// 	return "MMM-Strava-Last-Activity-Map.njk";
	// },

	// getTemplateData () {
	// 	return {
	// 		activityDate: this.apiData.activityDate,
	// 		hours: this.apiData.hours,
	// 		minutes: this.apiData.minutes,
	// 		distance: this.apiData.distance,
	// 		summaryPolyLine: this.apiData.summaryPolyLine,
	// 		accessTokenError: this.accessTokenError,
	// 		loading: this.loading
	// 	};
	// }
});
