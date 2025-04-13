/* MagicMirror²
 * Module: MMM-Strava-Last-Activity-Map
 *
 * By Tyler Stambaugh
 * Modified for conditional map display, pace, units
 */

Module.register("MMM-Strava-Last-Activity-Map", {
    currentActivityId: null, // Store the ID of the activity currently displayed
	baseUrl: "https://www.strava.com/api/v3/",
	tokenUrl: "https://www.strava.com/oauth/token?",
	accessTokenError: {},
	apiData: null, // Initialize as null to better check if data has arrived
	loading: true,
    mapsApiLoaded: false, // Flag to track Google Maps script loading
    updateTimer: null, // Added for scheduleUpdate fix

	defaults: {
		units: "imperial", // "metric" or "imperial"
		zoom: 10,
		mapTypeId: "roadmap",
		styledMapType: "standard", // Note: 'styles' property expects an array, not a string name
		disableDefaultUI: true,
		header: "Last Activity on Strava",
		initialLoadDelay: 2500,
		// retryDelay: 2500, // Not currently used
		updateInterval: 60 * 15 * 1000, // 15 minutes
		width: "250px",
		height: "250px",
		googleMapsApiKey: "" // Make sure API Key is set in config.js
	},

	// --- Existing init/getHeader ---
	init () {},
	getHeader () {
		return this.config.header || "Strava Last Activity Map";
	},

	// --- Corrected start ---
	start () {
		Log.info(`Starting module: ${this.name}`);
        this.currentActivityId = null; // Reset on start
		this.apiData = null; // Reset data
		this.loading = true;
        this.mapsApiLoaded = false; // Reset flag on start
        this.updateTimer = null; // Initialize timer variable
		this.scheduleUpdate(this.config.initialLoadDelay); // Use initial delay for first fetch
	},

	// --- Corrected scheduleUpdate to avoid multiple intervals ---
	scheduleUpdate (delay) {
        // Clear any existing interval first
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null; // Reset timer ID
        }

		// Set timeout for the first execution if delay is provided
        if (typeof delay !== "undefined" && delay >= 0) {
            setTimeout(() => {
                this.getApiData();
                 // Then set the regular interval after the first delayed execution
                 this.updateTimer = setInterval(() => {
                    this.getApiData();
                 }, this.config.updateInterval);
            }, delay);
        } else {
             // If no delay, fetch immediately and set interval
             this.getApiData();
             this.updateTimer = setInterval(() => {
                 this.getApiData();
             }, this.config.updateInterval);
        }
	},

	notificationReceived () {}, // Keep empty unless needed

    // --- Modified getDom for conditional map display and units ---
	getDom () {
		var wrapper = document.createElement("div");
		wrapper.className = `wrapper ${this.identifier}`; // Use identifier

		if (this.loading) {
			var loadingMessage = document.createElement("div");
			loadingMessage.className = "loading dimmed small";
			loadingMessage.innerHTML = "Loading Activity Data...";
			wrapper.appendChild(loadingMessage);
            return wrapper;
		}

		if (this.accessTokenError && Object.keys(this.accessTokenError).length > 0) {
			var errorWrapper = document.createElement("div");
			errorWrapper.className = "small bright error";
			errorWrapper.innerHTML = `Strava API Token Error: ${JSON.stringify(this.accessTokenError)}`;
			wrapper.appendChild(errorWrapper);
            return wrapper;
		}

        // Use optional chaining ?. for safer access
        if (!this.apiData || this.apiData.error || !this.apiData.name) {
             var noDataMessage = document.createElement("div");
             noDataMessage.className = "dimmed small no-activity";
             noDataMessage.innerHTML = this.apiData?.error ? `Error: ${this.apiData.error}` : "No recent activity data found.";
             wrapper.appendChild(noDataMessage);
             return wrapper;
        }

        // Display Activity Details
		var detailsWrapper = document.createElement("div");
		detailsWrapper.className = "small bright activityDetails";
        detailsWrapper.innerHTML = `
            ${this.apiData.name ? `<p class="name">${this.apiData.name}</p>` : ""}
            ${this.apiData.activityDate ? `<p class="date value">${this.apiData.activityDate}</p>` : ""}
        `;
		wrapper.appendChild(detailsWrapper);

        // Conditionally Display Map or "Map Not Available"
        if (this.apiData.summaryPolyLine) {
            if (this.mapsApiLoaded) {
                var mapContainerWrapper = document.createElement("div");
                mapContainerWrapper.className = "map-container-wrapper";
                var mapContainer = document.createElement("div");
                mapContainer.className = "map";
                mapContainer.setAttribute("id", this.identifier + "_map");
                mapContainer.style.height = `${this.config.height}`;
                mapContainer.style.width = `${this.config.width}`;
                mapContainerWrapper.appendChild(mapContainer);
                wrapper.appendChild(mapContainerWrapper);
                setTimeout(() => this.initializeMap(), 0);
            } else {
                var mapLoadingMessage = document.createElement("div");
                mapLoadingMessage.className = "small dimmed map-loading";
                mapLoadingMessage.innerHTML = "Loading map...";
                wrapper.appendChild(mapLoadingMessage);
            }
        } else {
            var mapMessageWrapper = document.createElement("div");
            mapMessageWrapper.className = "small dimmed map-message";
            mapMessageWrapper.innerHTML = "Map not available for this activity.";
            wrapper.appendChild(mapMessageWrapper);
        }

        // Display Distance/Time/Pace Details
		var detailsWrapper2 = document.createElement("div");
		detailsWrapper2.className = "small bright activityDetails";
        // Use distanceUnits from apiData
        detailsWrapper2.innerHTML = `
             <p>
                ${(this.apiData.distance !== null && this.apiData.distance !== undefined) ? `<span class="value">${this.apiData.distance}</span> ${this.apiData.distanceUnits || ''}` : ""}
                ${(typeof this.apiData.hours === 'number' && typeof this.apiData.minutes === 'number') ? ` / <span class="value">${this.apiData.hours}</span>h <span class="value">${this.apiData.minutes}</span>m` : ""}
                ${(this.apiData.formattedPace) ? ` / <span class="pace value">${this.apiData.formattedPace}</span> /${this.apiData.distanceUnits}` : ""}
             </p>
        `;
		wrapper.appendChild(detailsWrapper2);

		return wrapper;
	}, // End of getDom function

    shouldDisplayMap: function(data) {
        if (!data || data.error) return false;
        return !!data.summaryPolyLine &&
               typeof data.latitude === 'number' &&
               typeof data.longitude === 'number';
    },

	initializeMap () {
        if (typeof google === "undefined" || typeof google.maps === "undefined" || typeof google.maps.geometry === "undefined") {
            Log.warn(`${this.name}: initializeMap called but Google Maps or geometry library not ready yet.`);
			return;
		}
        const mapElementId = this.identifier + "_map";
        const mapElement = document.getElementById(mapElementId);
        if (!mapElement) {
             Log.error(`${this.name}: Map container element #${mapElementId} not found! Cannot initialize map.`);
             return;
        }
        const self = this; // Use self for consistent context
        if (!self.apiData || !self.apiData.summaryPolyLine || typeof self.apiData.latitude !== 'number' || typeof self.apiData.longitude !== 'number') {
            Log.error(`${self.name}: initializeMap called without valid data (lat/lng/polyline).`);
            return;
        }
        Log.info(`${self.name}: Initializing map in element #${mapElementId}`);
        try {
            const map = new google.maps.Map(mapElement, {
                zoom: self.config.zoom,
                center: { lat: self.apiData.latitude, lng: self.apiData.longitude },
                mapTypeId: self.config.mapTypeId,
                disableDefaultUI: self.config.disableDefaultUI,
            });
            const decodedPath = google.maps.geometry.encoding.decodePath(self.apiData.summaryPolyLine);
            if (!decodedPath || decodedPath.length === 0) {
                Log.warn(`${self.name}: Decoded polyline path is empty.`);
                mapElement.innerHTML = "Error decoding map path.";
                return;
            }
            const polyline = new google.maps.Polyline({
                path: decodedPath, geodesic: true, strokeColor: "#FF0000", strokeOpacity: 1.0, strokeWeight: 2
            });
            polyline.setMap(map);
            const bounds = new google.maps.LatLngBounds();
            decodedPath.forEach((point) => { bounds.extend(point); });

            map.fitBounds(bounds);

            google.maps.event.addListenerOnce(map, "bounds_changed", () => {
				map.setZoom(map.getZoom());
			});
        } catch (error) {
            Log.error(`${self.name}: Error initializing Google Map:`, error);
            mapElement.innerHTML = "Error loading map.";
        }
	}, // End of initializeMap

	getApiData () {
        this.accessTokenError = {};
		let payload = {
			url: this.baseUrl,
			tokenUrl: this.tokenUrl,
			clientId: this.config.stravaClientId,
			clientSecret: this.config.stravaClientSecret,
			refreshToken: this.config.stravaRefreshToken,
            units: this.config.units, // <<< Pass units config
            before: this.config.activityBefore,
            after: this.config.activityAfter,
            // Remove hardcoded before/after unless needed for specific reason
			// after: Math.floor(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).getTime() / 1000),
			// before: Math.floor(new Date(Date.now() - 1 * 2 * 60 * 60 * 1000).getTime() / 1000)
		};
		this.sendSocketNotification("GET_STRAVA_DATA", payload);
	}, // End of getApiData

	socketNotificationReceived (notification, payload) {
		if (notification === "LOG") {
			Log.log(`${this.name} NodeHelper: ${payload}`);
		} else if (notification === "ACCESS_TOKEN_ERROR") {
			Log.error(`${this.name}: Access Token Error received:`, payload);
			this.accessTokenError = payload; this.loading = false; this.updateDom();
		} else if (notification === "STRAVA_FETCH_ERROR") {
			 Log.error(`${this.name}: Strava Fetch Error received:`, payload);
			 this.apiData = { error: payload }; this.currentActivityId = null; this.loading = false; this.updateDom();
		} else if (notification === "STRAVA_DATA_RESULT") {
            Log.info(`${this.name}: Strava data received.`);
            if (!payload || payload.error || !payload.id) {
                 Log.warn(`${this.name}: Received invalid, incomplete, or error payload.`, payload);
                 this.apiData = payload || { error: "Invalid data received." };
                 this.currentActivityId = null; this.loading = false; this.updateDom();
                 return;
            }
            if (this.currentActivityId !== null && this.currentActivityId === payload.id) {
                 Log.info(`${this.name}: Received data for same activity ID (${payload.id}). Skipping map reload.`);
                 this.apiData = payload; this.loading = false; this.accessTokenError = {};
                 this.updateDom(); // Refresh text data just in case
                 return;
            }
            Log.info(`${this.name}: New activity data received (ID: ${payload.id}). Processing.`);
            this.apiData = payload; this.currentActivityId = payload.id;
            this.loading = false; this.accessTokenError = {};

            if (this.shouldDisplayMap(this.apiData)) {
                if (!this.mapsApiLoaded) {
                     Log.info(`${this.name}: Map data present, Google Maps API not loaded yet. Requesting script.`);
                    this.loadGoogleMapsScript();
                } else {
                    Log.info(`${this.name}: Map data present, Google Maps API loaded. Initializing/Updating map.`);
                    // Ensure loadMap is called if API is already loaded
                    this.initializeMap(); // Or call loadMap if you separate init and update logic
                }
            } else {
                Log.info(`${this.name}: No map data for new activity (ID: ${payload.id}). Hiding map.`);
                this.map = null; this.poly = null; // Assuming map/poly are stored on 'this' if needed elsewhere
                this.updateDom();
            }
		}
	}, // End of socketNotificationReceived

    // --- Use simplified GLOBAL callback approach for loadGoogleMapsScript ---
    loadGoogleMapsScript () {
        if (window.googleMapsApiLoadingInitiated) {
            Log.info(`${this.name}: Google Maps script loading already initiated.`);
            return;
        }
        if (typeof google === 'object' && typeof google.maps === 'object') {
            Log.info(`${this.name}: Google Maps script seems already loaded.`);
             MM.getModules().withClass("MMM-Strava-Last-Activity-Map").enumerate((inst) => { inst.mapsApiLoaded = true; });
             this.updateDom(); return;
        }
        if (!this.config.googleMapsApiKey) {
            Log.error(`${this.name}: Google Maps API key not set!`); return;
        }
        Log.info(`${this.name}: Initiating load for Google Maps API script.`);
        window.googleMapsApiLoadingInitiated = true;
        window.magicMirrorStravaMapApiLoaded = () => {
            Log.info("Global Google Maps API script loaded (magicMirrorStravaMapApiLoaded).");
            MM.getModules().withClass("MMM-Strava-Last-Activity-Map").enumerate((inst) => {
                inst.mapsApiLoaded = true;
                setTimeout(() => inst.updateDom(), 0);
            });
            // delete window.magicMirrorStravaMapApiLoaded; // Optional cleanup
        };
        Log.info(`Global callback magicMirrorStravaMapApiLoaded defined on window: ${typeof window.magicMirrorStravaMapApiLoaded}`);
        const googleMapsScript = document.createElement("script");
        googleMapsScript.id = "googleMapsScript_Strava";
        googleMapsScript.type = "text/javascript";
        googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.googleMapsApiKey}&libraries=geometry&callback=magicMirrorStravaMapApiLoaded`;
        googleMapsScript.async = true;
        document.head.appendChild(googleMapsScript);
        googleMapsScript.onerror = () => {
            Log.error(`${this.name}: Failed to load Google Maps script!`);
            window.googleMapsApiLoadingInitiated = false;
            delete window.magicMirrorStravaMapApiLoaded;
        };
    }, // End of loadGoogleMapsScript 

	getStyles () {
		return ["MMM-Strava-Last-Activity-Map.css"];
	}
});