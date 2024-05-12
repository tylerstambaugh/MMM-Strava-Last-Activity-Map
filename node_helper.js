const NodeHelper = require("node_helper");
const axios = require("axios");
const Log = require("logger");
const path = require("path");
const fs = require("fs");

module.exports = NodeHelper.create({
  accessTokenData: {},

  start: function () {
    console.log("Starting node_helper for: " + this.name);
  },

  getAccessToken: async function (payload) {
    try {
      url =
        payload.tokenUrl +
        "client_id=" +
        payload.clientId +
        "&client_secret=" +
        payload.clientSecret +
        "&refresh_token=" +
        payload.refreshToken +
        "&grant_type=refresh_token";
      await axios.post(url).then((response) => {
        try {
          const filePath = path.join(__dirname, "access_token.json");
          fs.writeFileSync(filePath, JSON.stringify(response.data));
        } catch (error) {
          Log.info(
            "MMM-StravaWeekInBike Error writing to file access_token.json:",
            error
          );
        }
        this.accessTokenData = response.data;
      });
    } catch (error) {
      console.error(
        "MMM-Strava-WeekInBike - Access token Error fetching data from API:",
        error
      );
      this.sendSocketNotification("ACCESS_TOKEN_ERROR", error);
    }
  },

  socketNotificationReceived: function (notification, payload) {
    // if (notification === "GET_STRAVA_STATS") {
    //  this.getStravaStats(payload);
  },
});
