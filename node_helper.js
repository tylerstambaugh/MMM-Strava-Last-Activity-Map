const path = require("node:path");
const fs = require("node:fs");
const { Console } = require("node:console");
const NodeHelper = require("node_helper");
const axios = require("axios");
const Log = require("logger");

module.exports = NodeHelper.create({
	accessTokenData: {},

	start () {
		console.log(`Starting node_helper for: ${this.name}`);
	},

	async getAccessToken (payload) {
		try {
			const url = `${payload.tokenUrl}client_id=${payload.clientId}&client_secret=${payload.clientSecret}&refresh_token=${payload.refreshToken}&grant_type=refresh_token`;
			const response = await axios.post(url);
			const filePath = path.join(__dirname, "access_token.json");

			try {
				fs.writeFileSync(filePath, JSON.stringify(response.data));
			} catch (error) {
				this.sendSocketNotification("LOG", `Error writing to file access_token.json: ${error}`);
			}

			this.accessTokenData = response.data;
		} catch (error) {
			this.sendSocketNotification("LOG", `Error fetching access token from API: ${error}`);
			this.sendSocketNotification("ACCESS_TOKEN_ERROR", error);
		}
	},

	processData (data) {
		let activityDate, distance, minutes, latitude, longitude, summaryPolyLine;

		if (Array.isArray(data) && data.length > 0) {
			this.sendSocketNotification("LOG", `response data count: ${data.length}`);
			const activity = data[0];
			const date = new Date(activity.start_date);

			const month = String(date.getUTCMonth() + 1).padStart(2, "0");
			const day = String(date.getUTCDate()).padStart(2, "0");
			const year = date.getUTCFullYear();

			activityDate = `${month}/${day}/${year}`;
			distance = Math.floor(activity.distance * 0.000621371); // Convert meters to miles
			minutes = Math.floor(activity.moving_time / 60);
			latitude = activity.start_latlng[0];
			longitude = activity.start_latlng[1];
			summaryPolyLine = activity.map.summary_polyline;
		}

		return {
			activityDate,
			distance,
			minutes: minutes % 60,
			hours: Math.floor(minutes / 60),
			latitude,
			longitude,
			summaryPolyLine
		};
	},

	async getStravaData (payload) {
		this.sendSocketNotification("LOG", "Fetching Strava data");
		const filePath = path.join(__dirname, "access_token.json");

		try {
			if (fs.existsSync(filePath)) {
				const localAccessTokenFileData = await fs.promises.readFile(filePath);
				const localAccessTokenData = JSON.parse(localAccessTokenFileData);

				if (localAccessTokenData.access_token && localAccessTokenData.expires_at > Math.floor(Date.now() / 1000)) {
					this.accessTokenData = localAccessTokenData;
				} else {
					await this.getAccessToken({ ...payload, refreshToken: localAccessTokenData.refresh_token });
				}
			} else {
				await this.getAccessToken(payload);
			}

			const url = `${payload.url}athlete/activities?before=${payload.before}&after=${payload.after}`;
			const response = await axios.get(url, {
				headers: {
					Authorization: `Bearer ${this.accessTokenData.access_token}`
				}
			});
			this.sendSocketNotification("LOG", `strava activity response: ${JSON.stringify(response.data)}`);
			const processedData = this.processData(response.data);
			this.sendSocketNotification("LOG", `strava activity response post processing: ${JSON.stringify(processedData)}`);
			this.sendSocketNotification("STRAVA_DATA_RESULT", processedData);
		} catch (error) {
			this.sendSocketNotification("LOG", `Error fetching data from Strava API: ${error}`);
		}
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "GET_STRAVA_DATA") {
			console.error("Socket notification received: GET_STRAVA_DATA");
			this.getStravaData(payload);
		}
	}
});
