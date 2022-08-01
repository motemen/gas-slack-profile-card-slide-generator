import h from "vhtml";

// https://github.com/developit/vhtml/pull/33
const Fragment = ({ children }: { children: string[] }) =>
  h(null as any, null, ...children);

const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET } =
  PropertiesService.getScriptProperties().getProperties();

declare var globalThis: {
  doGet: typeof doGet;
  authCallback: typeof authCallback;
};

function requestSlackAPI<T>(
  slackService: GoogleAppsScriptOAuth2.OAuth2Service,
  url: string,
  params?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
): T | null {
  if (!slackService.hasAccess()) {
    return null;
  }
  const resp = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: `Bearer ${slackService.getAccessToken()}`,
    },
  });
  return JSON.parse(resp.getContentText()) as unknown as T;
}

interface SlackUserProfile {
  display_name: string;
  title: string;
  image_512: string;
  image_192: string;
  image_72: string;
}

interface SlackUserProfileResponse {
  profile: SlackUserProfile;
}

globalThis.doGet = doGet;
function doGet(
  ev: GoogleAppsScript.Events.DoGet
): GoogleAppsScript.HTML.HtmlOutput {
  const slackService = buildSlackOAuthService();

  if (ev.parameter.mode === "logout") {
    slackService.reset();
  }

  const userProfile = requestSlackAPI<SlackUserProfileResponse>(
    slackService,
    "https://slack.com/api/users.profile.get"
  );
  const indexHTML = (
    <html>
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC"
          crossorigin="anonymous"
        />
      </head>
      <body>
        <div className="container">
          <h1 className="mt-4 mb-4">Slack profile virtual wallpaper</h1>
          {userProfile ? (
            <>
              <p>
                Signed in as{" "}
                <img
                  src={
                    userProfile.profile.image_512 ||
                    userProfile.profile.image_192
                  }
                  height={24}
                />{" "}
                <strong>@{userProfile.profile.display_name}</strong>{" "}
                <a
                  href={ScriptApp.getService().getUrl() + "?mode=logout"}
                  className="btn btn-secondary btn-sm"
                  target="_top"
                >
                  Logout
                </a>
              </p>
              {(() => {
                const slide = createSlide(userProfile.profile);
                const url = slide.getUrl();
                return (
                  <>
                    <p>
                      <a href={url}>Slide</a>
                    </p>
                    <img src={url.replace(/\/edit.*$/, "/export/svg")} />
                  </>
                );
              })()}
            </>
          ) : (
            <p>
              <a href={slackService.getAuthorizationUrl()} target="_top">
                <img
                  src="https://platform.slack-edge.com/img/sign_in_with_slack.png"
                  srcset="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack@2x.png 2x"
                />
              </a>
            </p>
          )}
        </div>
      </body>
    </html>
  );

  return HtmlService.createHtmlOutput(`<!DOCTYPE html>${indexHTML}`);
}

function createSlide(
  userProfile: SlackUserProfile
): GoogleAppsScript.Drive.File {
  const originalSlide = DriveApp.getFileById(
    "1jwKNAl-MaMhfRSufmoTT3VX1g5Q-_q-EGkCszQo74Xc"
  );
  const slide = originalSlide.makeCopy();
  const slideId = slide.getId();
  const requests: GoogleAppsScript.Slides.Schema.Request[] = [
    {
      replaceAllText: {
        containsText: { text: "{{name}}" },
        replaceText: userProfile.display_name,
      },
    },
    {
      replaceAllText: {
        containsText: { text: "{{title}}" },
        replaceText: userProfile.title,
      },
    },
    // TODO: make failable
    {
      replaceAllShapesWithImage: {
        containsText: { text: "{{image}}" },
        imageUrl: userProfile.image_512 || userProfile.image_192,
      },
    },
  ];
  Slides.Presentations!.batchUpdate({ requests }, slideId);

  Logger.log(slide.getUrl());

  return slide;
}

// https://github.com/googleworkspace/apps-script-oauth2
function buildSlackOAuthService(): GoogleAppsScriptOAuth2.OAuth2Service {
  return OAuth2.createService("slack")
    .setAuthorizationBaseUrl("https://slack.com/oauth/authorize")
    .setTokenUrl("https://slack.com/api/oauth.access")
    .setClientId(SLACK_CLIENT_ID)
    .setClientSecret(SLACK_CLIENT_SECRET)
    .setCallbackFunction("authCallback")
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope("users.profile:read");
}

globalThis.authCallback = authCallback;
function authCallback(request: object) {
  const slackService = buildSlackOAuthService();
  const isAuthorized = slackService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("Authorized");
  } else {
    return HtmlService.createHtmlOutput("Failed to aurhorize");
  }
}
