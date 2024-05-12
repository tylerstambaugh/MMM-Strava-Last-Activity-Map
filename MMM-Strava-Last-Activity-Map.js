/* MagicMirror²
 * Module: MMM-Strava-Last-Activity-Map
 *
 * By Tyler Stambaugh
 */

Module.register("MMM-Strava-Last-Activity-Map", {
  baseUrl: "https://www.strava.com/api/v3/",
  tokenUrl: "https://www.strava.com/oauth/token?",
  accessTokenError: {},
  stravaStats: {
    totalDistance: 0,
    totalMinutes: 0,
    minutes: 0,
    hours: 0,
    totalElevation: 0,
  },

  // Module config defaults.
  defaults: {
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    header: "Strava Week in Bike",
    numberOfDaysToQuery: 7,
    maxWidth: "250px",
    initialLoadDelay: 4250,
    retryDelay: 2500,
    updateInterval: 60 * 15 * 1000,
    loading: true,
  },

  init: function () {
    this.stravaStats = {};
  },

  getHeader: function () {
    return this.config.header || "Strava Last Activity Map";
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.stravaStats = {};
    this.scheduleUpdate();
  },

  scheduleUpdate: function () {
    setInterval(() => {
      //this.getStravaStats();
    }, this.config.updateInterval);
    this.getStravaStats(this.config.initialLoadDelay);
    var self = this;
  },

  notificationReceived: function () {},

  getLastStravaActivity: function () {
    payload = {
      url: this.baseUrl,
      tokenUrl: this.tokenUrl,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken: this.config.refreshToken,
      numberOfDaysToQuery: this.config.numberOfDaysToQuery,
      after: Math.floor(
        new Date(
          Date.now() - this.config.numberOfDaysToQuery * 24 * 60 * 60 * 1000
        ).getTime() / 1000
      ),
      before: Math.floor(
        new Date(Date.now() - 1 * 2 * 60 * 60 * 1000).getTime() / 1000
      ),
    };
    this.sendSocketNotification("GET_LAST_STRAVA_ACTIVITY", payload);
  },

  // this gets data from node_helper
  socketNotificationReceived: function (notification, payload) {
    if (notification === "ACCESS_TOKEN_ERROR") {
      this.accessTokenError(payload);
    }
    if (notification === "STRAVA_STATS_RESULT") {
      this.loading = true;
      this.stravaStats = payload;
      this.loading = false;
      this.updateDom();
    }
  },

  getStyles: function () {
    return ["font-awesome.css", "MMM-Strava-Last-Activity-Map.css"];
  },

  getTemplate() {
    return "MMM-Strava-Last-Activity-Map.njk";
  },

  getTemplateData() {
    return {
      //   numberOfDaysToQuery: this.config.numberOfDaysToQuery,
      //   numberOfRides: this.stravaStats.numberOfRides,
      //   distance: this.stravaStats.totalDistance,
      //   totalTime: `${Math.floor(this.stravaStats.totalMinutes / 60)} hours ${
      //     this.stravaStats.totalMinutes % 60
      //   } minutes`,
      //   minutes: this.stravaStats.minutes,
      //   hours: this.stravaStats.hours,
      //   elevation: this.stravaStats.totalElevation,
      //   accessTokenError: this.accessTokenError,
      //   loading: this.loading,
    };
  },
});
