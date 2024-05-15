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

  processData: function (data) {
    let distance = 0;
    let minutes = 0;
    let latitude;
    let longitude;
    let summaryPolyLine;
    if (data instanceof Array) {
      if (data.length > 0) {
        let activity = data[0];

        distance = Math.floor(activity.distance * 0.000621371);
        minutes = Math.floor(activity.moving_time / 60);
        (latitude = activity.startLatLng[0]),
          (longitude = activity.startLatLng[1]),
          (summaryPolyLine = activity.map.summaryPolyLine);
      }
    }

    return {
      distance: distance,
      minutes: minutes % 60,
      hours: Math.floor(minutes / 60),
      latitude: latitude,
      longitute: longitute,
      summaryPolyLine: summaryPolyLine,
    };
  },

  getStravaData: async function (payload) {
    const filePath = path.join(__dirname, "access_token.json");
    let localAccessTokenData = {};
    try {
      if (fs.existsSync(filePath)) {
        let localAccessTokenFileData = await fs.promises.readFile(filePath);
        try {
          localAccessTokenData = JSON.parse(localAccessTokenFileData);
          if (
            localAccessTokenData.access_token &&
            localAccessTokenData.expires_at < Math.floor(Date.now() / 1000)
          ) {
            this.accessTokenData = localAccessTokenData;
          } else {
            await this.getAccessToken({
              ...payload,
              refreshToken: localAccessTokenData.refresh_token,
            });
          }
        } catch (parseError) {
          await this.getAccessToken(payload);
        }
      } else {
        await this.getAccessToken(payload);
      }

      let url =
        payload.url +
        "athlete/activities?before=" +
        payload.before +
        "&after=" +
        payload.after;

      await axios
        .get(url, {
          headers: {
            Authorization: `Bearer ${this.accessTokenData.access_token}`,
          },
        })
        .then((response) => {
          const processedData = this.processData(response.data);
        })
        .then((data) => {
          setGoogleMap(data);
        });
    } catch (error) {
      console.error(
        "MMM-StravaWeekInBike - Node helper getStravaStats - Error fetching data from API:",
        error
      );
      return null;
    }
  },

  loadGoogleMaps: function () {
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
  },

  //var self = this;

  setGoogleMap: async function (data) {
    let map;
    // initMap is now async
    async function initMap() {
      // Request libraries when needed, not in the script tag.
      const { Map } = await google.maps.importLibrary("maps");
      // Short namespaces can be used.
      map = new Map(document.getElementById("map"), {
        center: { lat: data.latitude, lng: data.longitude },
        zoom: 8,
      });
    }

    await initMap();

    let responseData = {
      map: map,
      distance: data.distance,
      hours: data.hours,
      minutes: data.minutes,
    };

    // Send the notification with the responseData
    this.sendSocketNotification("PROCESS_DATA_RESULT", responseData);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "GET_STRAVA_DATA") {
      this.getStravaData(payload);
    }
  },
});
