/* MagicMirror²
 * Module: MMM-Strava-Last-Activity-Map
 *
 * By Tyler Stambaugh
 */

//worked on configuring MM, no code today.
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
    loading: true,
  },

  init: function () {
    this.apiData = {};
  },

  getHeader: function () {
    return this.config.header || "Strava Last Activity Map";
  },

  start: function () {
    var self = this;
    Log.info("Starting module: " + this.name);
    this.apiData = {};
    this.scheduleUpdate();

    if (this.config.googleMapsApiKey === "") {
      Log.error("MMM-Strava-Last-Activity-Map: Google Maps API key not set!");
      return;
    }
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getApiData();
    }, this.config.updateInterval);
    this.getApiData(this.config.initialLoadDelay);
    var self = this;
  },

  notificationReceived: function () {},

  getApiDAta: function () {
    payload = {
      url: this.baseUrl,
      tokenUrl: this.tokenUrl,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken: this.config.refreshToken,
      googleMapsApiKey: this.config.googleMapsApiKey,
      after: Math.floor(
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).getTime() / 1000
      ),
      before: Math.floor(
        new Date(Date.now() - 1 * 2 * 60 * 60 * 1000).getTime() / 1000
      ),
    };
    this.sendSocketNotification("GET_API_DATA", payload);
  },

  // this gets data from node_helper
  socketNotificationReceived: function (notification, payload) {
    if (notification === "ACCESS_TOKEN_ERROR") {
      this.accessTokenError(payload);
    }
    if (notification === "PROCESS_DATA_RESULT") {
      this.loading = true;
      this.apiData = payload;
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
      activityDate: this.apiData.activityDate,
      hours: this.apiData.hours,
      minutes: this.apiData.minutes,
      distance: this.apiData.distance,
      map: this.apiData.map,
      accessTokenError: this.accessTokenError,
      loading: this.loading,
    };
  },
});
