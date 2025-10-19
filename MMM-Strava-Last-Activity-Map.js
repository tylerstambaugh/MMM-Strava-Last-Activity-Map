Module.register("MMM-Strava-Last-Activity-Map", {
    defaults: {
        updateInterval: 60 * 1000,
        googleMapsApiKey: "",
        zoom: 10,
        mapTypeId: "roadmap",
        styledMapType: "standard",
        width: "250px",
        height: "250px",
        header: "Last Activity on Strava",
    },

    start() {
        this.loading = true;
        this.apiData = {};
        this.sendSocketNotification("LOG", `Starting module: ${this.name}`);
        this.scheduleUpdate();
    },

    scheduleUpdate() {
        this.getApiData();
        setInterval(() => this.getApiData(), this.config.updateInterval);
    },

	getStyles() {
    	return ["MMM-Strava-Last-Activity-Map.css"];
  	},

    getApiData() {
        if (!this.config.stravaClientId || !this.config.stravaClientSecret || !this.config.stravaRefreshToken) {
            Log.error(`${this.name}: Strava credentials missing`);
            return;
        }

        const payload = {
            url: "https://www.strava.com/api/v3/",
            tokenUrl: "https://www.strava.com/oauth/token?",
            clientId: this.config.stravaClientId,
            clientSecret: this.config.stravaClientSecret,
            refreshToken: this.config.stravaRefreshToken,
            after: Math.floor(Date.now() / 1000 - 10 * 24 * 60 * 60),
            before: Math.floor(Date.now() / 1000 - 2 * 60 * 60),
        };

        this.sendSocketNotification("GET_STRAVA_DATA", payload);
    },

    socketNotificationReceived(notification, payload) {
        if (notification === "STRAVA_DATA_RESULT") {
            this.apiData = payload;
            this.loading = false;
            this.updateDom();
        } else if (notification === "ACCESS_TOKEN_ERROR") {
            this.accessTokenError = payload;
            this.loading = false;
            this.updateDom();
            Log.error(`${this.name}: Access token error`, payload);
        } else if (notification === "LOG") {
            Log.info(`${this.name}: ${payload}`);
        }
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "MMM-Strava-Last-Activity-Map wrapper";

        // Handle loading state
        if (this.loading) {
            wrapper.innerHTML = `<div class="loading">Module Loading...</div>`;
            return wrapper;
        }

        // Handle access token error
        if (this.accessTokenError && Object.keys(this.accessTokenError).length > 0) {
            wrapper.innerHTML = `
                <div class="small bright activityDetails">
                    Strava API Access Token Error: ${JSON.stringify(this.accessTokenError)}
                </div>
            `;
            return wrapper;
        }

        // Main module UI
        wrapper.innerHTML = `
            <div class="activityDetails small bright">
                <p>${this.apiData.name} - ${this.apiData.activityDate}</p>
            </div>

            <div class="map-container-wrapper">
                <div id="map" class="map" style="width:${this.config.width};height:${this.config.height};"></div>
            </div>

            <div class="activityDetails small bright">
                <p>
                    <span class="value">${this.apiData.distance}</span> miles |
                    <span class="value">${this.apiData.hours}</span> hours
                    <span class="value">${this.apiData.minutes}</span> minutes
                </p>
            </div>
        `;

        // Load Google Maps asynchronously and initialize
        this.loadGoogleMapsScript(() => {
            this.initializeMap();
        });		

        return wrapper;
    },

    loadGoogleMapsScript(callback) {
        if (!this.config.googleMapsApiKey) {
            Log.error(`${this.name}: Missing Google Maps API key.`);
            return;
        }

        // If Google Maps already loaded
        if (window.google && window.google.maps) {
            callback();
            return;
        }

        // If script tag already present, wait for it
        const existing = document.getElementById("google-maps-script");
        if (existing) {
            const interval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(interval);
                    callback();
                }
            }, 200);
            return;
        }

        // Create and inject script
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.googleMapsApiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = callback;

        document.head.appendChild(script);
    },

    initializeMap() {
        const mapDiv = document.getElementById("map");
        if (!mapDiv || !this.apiData || !this.apiData.latitude || !this.apiData.longitude) return;

        const map = new google.maps.Map(mapDiv, {
            zoom: this.config.zoom,
            center: { lat: this.apiData.latitude, lng: this.apiData.longitude },
            mapTypeId: this.config.mapTypeId,
            styles: this.config.styledMapType,
            disableDefaultUI: true,
        });

        const decodedPath = this.decodePolyline(this.apiData.summaryPolyLine || "");
        if (decodedPath.length > 0) {
            const polyline = new google.maps.Polyline({
                path: decodedPath,
                geodesic: true,
                strokeColor: "#FF0000",
                strokeOpacity: 1.0,
                strokeWeight: 2,
            });
            polyline.setMap(map);

            const bounds = new google.maps.LatLngBounds();
            decodedPath.forEach((point) => bounds.extend(point));
            map.fitBounds(bounds);
        }
    },

    decodePolyline(encoded) {
        if (!encoded) return [];
        let points = [];
        let index = 0,
            lat = 0,
            lng = 0;

        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = result & 1 ? ~(result >> 1) : result >> 1;
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = result & 1 ? ~(result >> 1) : result >> 1;
            lng += dlng;

            points.push({ lat: lat / 1e5, lng: lng / 1e5 });
        }

        return points;
    },
});
