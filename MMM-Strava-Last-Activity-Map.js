/* MagicMirror²
 * Module: MMM-Strava-Last-Activity-Map
 *
 * By Tyler Stambaugh
 */

Module.register("MMM-Strava-Last-Activity-Map", {
  baseUrl: "https://www.strava.com/api/v3/",
  tokenUrl: "https://www.strava.com/oauth/token?",
  googleMapsApiUrl: "",
  accessTokenError: {},
  stravaData: {
    totalDistance: 0,
    totalMinutes: 0,
    minutes: 0,
    hours: 0,
    totalElevation: 0,
  },
  googleMap: null,

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
    this.stravaData = {};
  },

  getHeader: function () {
    return this.config.header || "Strava Last Activity Map";
  },

  start: function () {
    var self = this;
    Log.info("Starting module: " + this.name);
    this.stravaData = {};
    this.scheduleUpdate();

    if (this.config.googleMapsApiKey === "") {
      Log.error("MMM-GoogleMapsTraffic: key not set!");
      return;
    }
  },

  scheduleUpdate: function () {
    setInterval(() => {
      this.getLastStravaActivity();
    }, this.config.updateInterval);
    this.getLastStravaActivity(this.config.initialLoadDelay);
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
      after: Math.floor(
        new Date(
          Date.now() - 10 * 24 * 60 * 60 * 1000
        ).getTime() / 1000
      ),
      before: Math.floor(
        new Date(Date.now() - 1 * 2 * 60 * 60 * 1000).getTime() / 1000
      ),
    };
    this.sendSocketNotification("GET_LAST_STRAVA_ACTIVITY", payload);
  },

  getGoogleMap: function () {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = ((g) => {
      var h,
        a,
        k,
        p = "The Google Maps JavaScript API",
        c = "google",
        l = "importLibrary",
        q = "__ib__",
        m = document,
        b = window;
      b = b[c] || (b[c] = {});
      var d = b.maps || (b.maps = {}),
        r = new Set(),
        e = new URLSearchParams(),
        u = () =>
          h ||
          (h = new Promise(async (f, n) => {
            await (a = m.createElement("script"));
            e.set("libraries", [...r] + "");
            for (k in g)
              e.set(
                k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()),
                g[k]
              );
            e.set("callback", c + ".maps." + q);
            a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
            d[q] = f;
            a.onerror = () => (h = n(Error(p + " could not load.")));
            a.nonce = m.querySelector("script[nonce]")?.nonce || "";
            m.head.append(a);
          }));
      d[l]
        ? console.warn(p + " only loads once. Ignoring:", g)
        : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
    })({
      key: this.config.googleMapsApiKey,
      v: "weekly",
    });
    document.body.appendChild(script);

    //var self = this;

    script.onload = function () {
      let map;
      // initMap is now async
      async function initMap() {
        // Request libraries when needed, not in the script tag.
        const { Map } = await google.maps.importLibrary("maps");
        // Short namespaces can be used.
        map = new Map(document.getElementById("map"), {
          center: { lat:this.stravaData., lng: 150.644 },
          zoom: 8,
        });
      }

      initMap();
    };
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
      time: `${Math.floor(this.stravaStats.totalMinutes / 60)} hours ${
        this.stravaStats.totalMinutes % 60
      } minutes`,
      distance: this.stravaStats.totalDistance,
      date: "12/12/2025",
      accessTokenError: this.accessTokenError,
      loading: this.loading,
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
