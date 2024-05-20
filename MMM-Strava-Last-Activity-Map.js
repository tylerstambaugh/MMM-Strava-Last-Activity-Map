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
			googleMapsScript.innerHTML = `
				(g => {
					var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
					b = b[c] || (b[c] = {});
					var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => {
						await (a = m.createElement("script"));
						e.set("libraries", [...r] + "");
						for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
						e.set("callback", c + ".maps." + q);
						a.src = \`https://maps.\${c}apis.com/maps/api/js?\` + e;
						d[q] = f;
						a.onerror = () => h = n(Error(p + " could not load."));
						a.nonce = m.querySelector("script[nonce]")?.nonce || "";
						m.head.append(a)
					}));
					d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n))
				})({
					key: "${this.config.googleMapsApiKey}",
					v: "weekly"
				});
			`;
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

		var self = this;

		const initializeMap = () => {
			if (typeof google === "undefined" || typeof google.maps === "undefined") {
				setTimeout(initializeMap, 100);
				return;
			}

			var map = new google.maps.Map(document.getElementById("map"), {
				zoom: self.config.zoom,
				mapTypeId: self.config.mapTypeId,
				center: {
					lat: self.config.lat,
					lng: self.config.lng
				},
				styles: self.styledMapType,
				disableDefaultUI: self.config.disableDefaultUI,
				backgroundColor: self.config.backgroundColor
			});

			var trafficLayer = new google.maps.TrafficLayer();
			trafficLayer.setMap(map);

			for (var i = 0; i < self.config.markers.length; i++) {
				var marker = self.config.markers[i];
				var markerOptions = {
					map: map,
					position: {
						lat: marker.lat,
						lng: marker.lng
					}
				};
				markerOptions.icon = {
					path: "M11 2c-3.9 0-7 3.1-7 7 0 5.3 7 13 7 13 0 0 7-7.7 7-13 0-3.9-3.1-7-7-7Zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5 0-1.4 1.1-2.5 2.5-2.5 1.4 0 2.5 1.1 2.5 2.5 0 1.4-1.1 2.5-2.5 2.5Z",
					scale: 1,
					anchor: new google.maps.Point(11, 22),
					fillOpacity: 1,
					fillColor: marker.fillColor,
					strokeOpacity: 0
				};
				var markerLayer = new google.maps.Marker(markerOptions);
			}
		};

		initializeMap();

		return wrapper;
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
		this.sendSocketNotification("GET_STRAVA_DATA", payload);
	},

	// this gets data from node_helper
	socketNotificationReceived (notification, payload) {
		if (notification === "ACCESS_TOKEN_ERROR") {
			this.accessTokenError(payload);
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
