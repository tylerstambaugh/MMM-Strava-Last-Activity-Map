# MMM-Strava-Last-Activity-Map

---

A simple magic mirror module for displaying a map of the last activity.  
![alt stravaLastActivityMap](./public/assets/images/StravaLastActivityMapScreenshot.JPG)

## Table of contents

1. [Setup](#setup)
2. [Configuration](#configuration)
3. [Updates](#updates)

## Setup

-In order to run the module, you'll need to [setup API access](https://developers.strava.com/docs/getting-started/#account) on your Strava account.

-You'll need to get your clientId, clientSecret, and initial refreshToken. Follow [these instructions](https://developers.strava.com/docs/getting-started/#oauth) to get those values.
-Scopes for the token should include: activity:read_all

-You'll need to get a Google Maps API key. Follow [thesee instructions](https://developers.google.com/maps/documentation/javascript/adding-a-google-map#key)

- If the module does not appear to work, check the console by running your MM with dev tools (npm start dev).

- Note: The access token and refresh tokens are kept in a file in the directory above the module. This is for the case where you are running both of my Strava MM modules, they'll share the token data between them allowing them to stay in sync and avoid "Unauthorized" errors

### The `strava_access_token.json` file

This module manages its own Strava access token automatically — you do not need to create this file yourself, and you should not edit it by hand.

- **Location:** `MagicMirror/modules/strava_access_token.json`, i.e. one directory *above* this module's folder. Because it lives in the shared `modules/` directory rather than inside `MMM-Strava-Last-Activity-Map/`, any other Strava module you install alongside this one (that follows the same convention, e.g. MMM-StravaWeekInBike) can read and write the same file, keeping their tokens in sync.
- **When it's created/updated:**
  - If the file doesn't exist yet, it's created the first time the module requests data, using the `stravaClientId`, `stravaClientSecret`, and `stravaRefreshToken` from your config to exchange for a new access token.
  - If the file exists, its `access_token` is reused as long as it hasn't expired (`expires_at` is in the future).
  - If the token is missing or expired, the module requests a new one from Strava (using the `refresh_token` stored in the file, or your configured `stravaRefreshToken` if the file has none) and overwrites the file with the response.
  - If a Strava API call returns a `401 Unauthorized`, the module will also refresh the token and rewrite the file before retrying once.
- **Contents:** the raw JSON response from Strava's `/oauth/token` endpoint, for example:
  ```json
  {
    "token_type": "Bearer",
    "access_token": "a4b945687g...",
    "expires_at": 1568775134,
    "expires_in": 21600,
    "refresh_token": "adfd345..."
  }
  ```
- Because this file contains a live access/refresh token pair, don't commit it to source control or share it.

## Configuration

```js
	{
			module: "MMM-Strava-Last-Activity-Map",
			position: "top_right",
			config: {
				stravaClientId: "[YOUR CLIENT ID]",
				stravaClientSecret: "[YOUR CLIENT SECRET]",
				stravaRefreshToken: "[YOUR REFRESH TOKEN]",
				googleMapsApiKey: "[YOUR GOOGLE MAPS API KEY]",
				mapTypeId: "roadmap",
				styledMapType: "standard",
				disableDefaultUI: true,
				header: "Last Activity on Strava",
				height: "300px",
				width: "300px",
				initialLoadDelay: 4250,
				retryDelay: 2500,
				updateInterval: 60 * 15 * 1000,
			}
		}
```

## Updates

I will likely continue to update the module. When you see that an update is available:

1. Open the command prompt and change to directory \MagicMirror\modules\MMM-Strava-Last-Activity-Map\
2. Run command `git pull`
3. Run command `npm install`
4. Restart the Magic Mirror
