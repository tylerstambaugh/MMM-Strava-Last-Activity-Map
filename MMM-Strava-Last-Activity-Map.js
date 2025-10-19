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
            this.loadGoogleMapsScript();
        } else if (notification === "ACCESS_TOKEN_ERROR") {
            this.loading = false;
            this.updateDom();
            Log.error(`${this.name}: Access token error`, payload);
        } else if (notification === "LOG") {
            Log.info(`${this.name}: ${payload}`);
        }
    },

    getDom() {
        const wrapper = document.createElement("div");
        wrapper.className = "wrapper";

        if (this.loading) {
            wrapper.innerHTML = "Module Loading...";
            return wrapper;
        }

        if (!this.apiData || Object.keys(this.apiData).length === 0) {
            wrapper.innerHTML = "No activity data";
            return wrapper;
        }

        wrapper.innerHTML = `
            <div class="activityDetails">
                <p>${this.apiData.name}</p>
                <p>${this.apiData.activityDate}</p>
                <p>${this.apiData.distance} miles / ${this.apiData.hours}h ${this.apiData.minutes}m</p>
            </div>
            <div class="map-container-wrapper">
                <div id="map" style="width:${this.config.width};height:${this.config.height}"></div>
            </div>
        `;

        return wrapper;
    },

    loadGoogleMapsScript() {
        if (!this.config.googleMapsApiKey) return;
        if (document.getElementById("google-maps-script")) return;

        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.googleMapsApiKey}&callback=initMap`;
        script.async = true;
        script.defer = true;

        window.initMap = this.initializeMap.bind(this);
        document.head.appendChild(script);
    },

    initializeMap() {
        if (!this.apiData || !this.apiData.latitude || !this.apiData.longitude) return;

        const map = new google.maps.Map(document.getElementById("map"), {
            zoom: this.config.zoom,
            center: { lat: this.apiData.latitude, lng: this.apiData.longitude },
            mapTypeId: this.config.mapTypeId,
            styles: this.config.styledMapType,
            disableDefaultUI: true,
        });

        const decodedPath = this.decodePolyline(this.apiData.summaryPolyLine);
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
