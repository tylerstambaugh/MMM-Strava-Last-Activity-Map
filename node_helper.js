const path = require("node:path");
const fs = require("node:fs");
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
			let url
        = `${payload.tokenUrl}
        client_id= ${payload.clientId}
        &client_secret=${payload.clientSecret}
        &refresh_token=${payload.refreshToken}
        &grant_type=refresh_token`;
			await axios.post(url).then((response) => {
				try {
					const filePath = path.join(__dirname, "access_token.json");
					fs.writeFileSync(filePath, JSON.stringify(response.data));
				} catch (error) {
					Log.info(
						"MMM-Strava-Last-Activity-Map Error writing to file access_token.json:",
						error
					);
				}
				this.accessTokenData = response.data;
			});
		} catch (error) {
			console.error(
				"MMM-Strava-Strava-Last-Activity-Map - Access token Error fetching data from API:",
				error
			);
			this.sendSocketNotification("ACCESS_TOKEN_ERROR", error);
		}
	},

	processData (data) {
		let activityDate;
		let distance = 0;
		let minutes = 0;
		let latitude;
		let longitude;
		let summaryPolyLine;
		if (data instanceof Array) {
			if (data.length > 0) {
				let activity = data[0];

				let date = new Date(activity.start_date);

				let month = String(date.getUTCMonth() + 1).padStart(2, "0"); // Months are zero-indexed, so add 1
				let day = String(date.getUTCDate()).padStart(2, "0");
				let year = date.getUTCFullYear();

				activityDate = `${month}/${day}/${year}`;

				distance = Math.floor(activity.distance * 0.000621371);
				minutes = Math.floor(activity.moving_time / 60);
				(latitude = activity.start_latlng[0]),
				(longitude = activity.start_latlng[1]),
				(summaryPolyLine = activity.map.summary_polyline);
			}
		}

		return {
			activityDate: activityDate,
			distance: distance,
			minutes: minutes % 60,
			hours: Math.floor(minutes / 60),
			latitude: latitude,
			longitute: longitude,
			summaryPolyLine: summaryPolyLine
		};
	},

	async getStravaData (payload) {
		const filePath = path.join(__dirname, "access_token.json");
		let localAccessTokenData = {};
		try {
			if (fs.existsSync(filePath)) {
				let localAccessTokenFileData = await fs.promises.readFile(filePath);
				try {
					localAccessTokenData = JSON.parse(localAccessTokenFileData);
					if (
						localAccessTokenData.access_token
						&& localAccessTokenData.expires_at < Math.floor(Date.now() / 1000)
					) {
						this.accessTokenData = localAccessTokenData;
					} else {
						await this.getAccessToken({
							...payload,
							refreshToken: localAccessTokenData.refresh_token
						});
					}
				} catch (parseError) {
					await this.getAccessToken(payload);
				}
			} else {
				await this.getAccessToken(payload);
			}

			let url
        = `${payload.url}athlete/activities?
        before=${payload.before}
        &after=${payload.after}`;

			await axios
				.get(url, {
					headers: {
						Authorization: `Bearer ${this.accessTokenData.access_token}`
					}
				})
				.then((response) => {
					const processedData = this.processData(response.data);
				})
				.then((data) => {
					this.sendSocketNotification("STRAVA_STATS_RESULTS", data);
				});
		} catch (error) {
			console.error(
				"MMM-Strav-Last-Activity-Map - Node helper getStravaStats - Error fetching data from API:",
				error
			);
			return null;
		}
	},


	socketNotificationReceived (notification, payload) {
		if (notification === "GET_STRAVA_DATA") {
			this.getStravaData(payload);
		}
	}
});
