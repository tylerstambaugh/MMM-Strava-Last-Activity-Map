const path = require("node:path");
const fs = require("node:fs");
// const { Console } = require("node:console"); // Likely not needed
const NodeHelper = require("node_helper");
const axios = require("axios");
const Log = require("logger"); // Ensure 'logger' is correct, might need adjustment based on core MM logging

module.exports = NodeHelper.create({
	accessTokenData: {},

	start () {
		console.log(`Starting node_helper for: ${this.name}`);
		// Memory usage interval (optional)
		// setInterval(() => {
		// 	const memoryUsage = process.memoryUsage();
		// 	this.sendSocketNotification("LOG", `memory usage: ${JSON.stringify(memoryUsage)}`);
		// }, 60000); // Check less frequently
	},

	async getAccessToken (payload) {
		try {
			const url = `${payload.tokenUrl}client_id=${payload.clientId}&client_secret=${payload.clientSecret}&refresh_token=${payload.refreshToken}&grant_type=refresh_token`;
			const response = await axios.post(url);
			const filePath = path.join(__dirname, "..", "strava_access_token.json");
			try {
				fs.writeFileSync(filePath, JSON.stringify(response.data));
			} catch (error) {
				this.sendSocketNotification("LOG", `Error writing token file: ${error}`);
			}
			this.accessTokenData = response.data;
		} catch (error) {
			this.sendSocketNotification("LOG", `Error fetching access token: ${error}`);
            // Send error message or simple object
			this.sendSocketNotification("ACCESS_TOKEN_ERROR", { message: error.message || "Failed to fetch token"});
		}
	},

    // --- Updated processData ---
    processData (data, unitsConfig) { // Accept unitsConfig
        let name = null,
            activityDate = null,
            distance = null, // Holds formatted distance number string
            distanceUnits = (unitsConfig === "imperial") ? "mi" : "km", // Set units label based on config
            minutes = null,
            hours = null,
            latitude = null,
            longitude = null,
            summaryPolyLine = null,
            formattedPace = null, // Will include units
            activityId = null;

        if (Array.isArray(data) && data.length > 0) {
            this.sendSocketNotification("LOG", `Processing activity data. Count: ${data.length}`);
            const activity = data[0];

            activityId = activity.id || null;
            name = activity.name;
            const date = new Date(activity.start_date);
            const month = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            const year = date.getUTCFullYear();
            activityDate = `${month}/${day}/${year}`;

            // --- Conditional Distance Calculation ---
            let distanceInMeters = 0;
            if (typeof activity.distance === 'number') {
                distanceInMeters = activity.distance;
                if (unitsConfig === "imperial") {
                    distance = (distanceInMeters * 0.000621371).toFixed(1); // Miles
                    distanceUnits = "mi"; // Ensure units label is correct
                } else {
                    distance = (distanceInMeters / 1000).toFixed(1); // Kilometers
                    distanceUnits = "km"; // Ensure units label is correct
                }
            } else {
                this.sendSocketNotification("LOG", `Notice: Activity '${activity.name}' lacks distance data.`);
                distanceUnits = ""; // No units if no distance
            }
            // --- End Distance Calculation ---

            // Time Calculation
            let movingTimeInSeconds = 0;
            if (typeof activity.moving_time === 'number') {
                movingTimeInSeconds = activity.moving_time;
                const totalMinutes = Math.floor(movingTimeInSeconds / 60);
                minutes = totalMinutes % 60;
                hours = Math.floor(totalMinutes / 60);
            } else {
                this.sendSocketNotification("LOG", `Notice: Activity '${activity.name}' lacks moving time data.`);
            }

            // --- Conditional Pace Calculation ---
			// Optrional parameter to only show pace for certain activities
            //const isPaceRelevant = ['Run', 'Walk', 'Hike', 'Trail Run', 'Ride', 'Virtual Run'].includes(activity.type); 
            if (/*isPaceRelevant &&*/ distanceInMeters > 0 && movingTimeInSeconds > 0) {
                let paceInSecondsPerUnit = 0;

                if (unitsConfig === "imperial") {
                    const distanceInMiles = distanceInMeters * 0.000621371;
                    paceInSecondsPerUnit = movingTimeInSeconds / distanceInMiles;
                } else {
                    const distanceInKm = distanceInMeters / 1000;
                    paceInSecondsPerUnit = movingTimeInSeconds / distanceInKm;
                }
                const paceMinutes = Math.floor(paceInSecondsPerUnit / 60);
                const paceSeconds = Math.round(paceInSecondsPerUnit % 60);
                const formattedSeconds = String(paceSeconds).padStart(2, '0');
                formattedPace = `${paceMinutes}:${formattedSeconds}`;
            } else if (distanceInMeters <= 0 || movingTimeInSeconds <= 0) {
                this.sendSocketNotification("LOG", "Could not calculate pace due to zero distance or time.");
            } else {
                this.sendSocketNotification("LOG", `Pace calculation not relevant for activity type: ${activity.type}`);
            }
            // --- End Pace Calculation ---

            // Map Data Handling (Simplified with optional chaining)
            latitude = activity.start_latlng?.[0] ?? null;
            longitude = activity.start_latlng?.[1] ?? null;
            summaryPolyLine = activity.map?.summary_polyline ?? null;

            this.sendSocketNotification("LOG", `Processed ID: ${activityId}, Distance: ${distance} ${distanceUnits}, Pace: ${formattedPace}, Lat: ${latitude}, Lng: ${longitude}, Polyline Exists: ${!!summaryPolyLine}`);

        } else {
            this.sendSocketNotification("LOG", "Warning: Received empty data array from Strava API.");
        }

        // Return the processed data object
        return {
            id: activityId,
            name,
            activityDate,
            distance,       // Formatted distance number string
            distanceUnits,  // "km" or "mi"
            minutes,
            hours,
            latitude,
            longitude,
            summaryPolyLine,
            formattedPace   // Formatted pace string with units or null
        };
    }, // End of processData

    // --- Updated getStravaData ---
    async getStravaData (payload) { // Receives full payload from frontend
        const filePath = path.join(__dirname, "..", "strava_access_token.json");
        // Extract units from payload, default to metric if not provided
        const units = payload.units || "metric";

        try {
            let justRefreshedToken = false;
            let localAccessTokenData;

            if (fs.existsSync(filePath)) {
                try {
                    const localFileData = await fs.promises.readFile(filePath);
                    localAccessTokenData = JSON.parse(localFileData);
                    if (localAccessTokenData?.access_token && localAccessTokenData.expires_at > Math.floor(Date.now() / 1000)) {
                        this.accessTokenData = localAccessTokenData;
                        this.sendSocketNotification("LOG", "Using existing valid token from file.");
                    } else {
                        this.sendSocketNotification("LOG", "Local token expired or invalid, refreshing...");
                        const refreshToken = localAccessTokenData?.refresh_token || payload.refreshToken;
                        if (!refreshToken) throw new Error("No refresh token available.");
                        await this.getAccessToken({...payload, refreshToken: refreshToken });
                        justRefreshedToken = true;
                    }
                } catch (fileError) {
                    this.sendSocketNotification("LOG", `Error reading/parsing token file: ${fileError}. Fetching new token.`);
                    await this.getAccessToken(payload); // Use initial refresh token from payload
                    justRefreshedToken = true;
                }
            } else {
                this.sendSocketNotification("LOG", "Token file not found, fetching initial token.");
                await this.getAccessToken(payload); // Use initial refresh token from payload
                justRefreshedToken = true;
            }

            if (justRefreshedToken) {
                this.sendSocketNotification("LOG", "Token refreshed/obtained. Waiting before data fetch...");
                await new Promise(resolve => setTimeout(resolve, 5000));
                this.sendSocketNotification("LOG", "Proceeding after delay.");
            }

            if (!this.accessTokenData?.access_token) {
                 throw new Error("Failed to obtain a valid access token.");
            }

            const beforeTimestamp = payload.before || Math.floor(Date.now() / 1000);
            const afterTimestamp = payload.after || Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
            const activitiesUrl = `${payload.url}athlete/activities?before=${beforeTimestamp}&after=${afterTimestamp}&per_page=1`;

            this.sendSocketNotification("LOG", `Fetching Strava activities from: ${activitiesUrl}`);
            const response = await axios.get(activitiesUrl, {
                headers: { Authorization: `Bearer ${this.accessTokenData.access_token}` }
            });

            this.sendSocketNotification("LOG", `Raw Strava API Response Data:\n${JSON.stringify(response.data, null, 2)}`);

            // --- Pass units to processData ---
            const processedData = this.processData(response.data, units);
            this.sendSocketNotification("STRAVA_DATA_RESULT", processedData);

        } catch (error) {
            if (error.response?.status === 401) {
                this.sendSocketNotification("LOG", "Access token invalid (401), attempting refresh...");
                try {
                    let refreshTokenToUse = payload.refreshToken; // Default to config/initial
                    if (fs.existsSync(filePath)) { // Try to get latest from file
                        try {
                            const fileData = JSON.parse(await fs.promises.readFile(filePath));
                            if (fileData?.refresh_token) refreshTokenToUse = fileData.refresh_token;
                        } catch (readError) { /* Ignore error reading file during recovery */ }
                    }
                    if (!refreshTokenToUse) throw new Error("No refresh token available for 401 recovery.");
                    await this.getAccessToken({...payload, refreshToken: refreshTokenToUse }); // Refresh
                    this.sendSocketNotification("LOG", "Token refreshed after 401. Waiting before retry...");
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    this.sendSocketNotification("LOG", "Retrying getStravaData after 401 delay.");
                    this.getStravaData(payload); // <<<< Pass original payload in recursive call
                } catch (tokenError) {
                     this.sendSocketNotification("LOG", `Failed to refresh token after 401: ${tokenError}`);
                     this.sendSocketNotification("ACCESS_TOKEN_ERROR", `Failed 401 recovery: ${tokenError.message || tokenError}`);
                }
            } else if (error.response?.status === 429) {
                this.sendSocketNotification("LOG",`Strava API rate limit (429). Error: ${error}`);
                this.sendSocketNotification("STRAVA_FETCH_ERROR", "Rate limit hit (429).");
            } else {
               this.sendSocketNotification("LOG", `Error fetching/processing Strava data: ${error}`);
               this.sendSocketNotification("STRAVA_FETCH_ERROR", `API/Processing Error: ${error.message || error}`);
            }
        }
    }, // End of getStravaData

    // --- Updated socketNotificationReceived ---
	socketNotificationReceived (notification, payload) {
		if (notification === "GET_STRAVA_DATA") {
            // Pass the entire payload received from the frontend
			this.getStravaData(payload);
		}
	}
}); // End of module.exports