const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, TEMPLATE_SLIDE_ID } =
  PropertiesService.getScriptProperties().getProperties();

type GetMeResponse =
  | {
      isAuthorized: false;
      authorizationURL: string;
    }
  | {
      isAuthorized: true;
      profile: SlackUserProfile;
    };

export function getMe(): GetMeResponse {
  const slackService = buildSlackOAuthService();
  if (slackService.hasAccess() === false) {
    return {
      isAuthorized: false,
      authorizationURL: slackService.getAuthorizationUrl(),
    };
  }

  const userProfile = requestSlackAPI<SlackUserProfileResponse>(
    slackService,
    "https://slack.com/api/users.profile.get"
  );
  return {
    isAuthorized: true,
    profile: userProfile?.profile,
  };
}

export function logout() {
  const slackService = buildSlackOAuthService();
  slackService.reset();
}

function requestSlackAPI<T>(
  slackService: GoogleAppsScriptOAuth2.OAuth2Service,
  url: string,
  params?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
): T {
  const resp = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: `Bearer ${slackService.getAccessToken()}`,
    },
  });
  return JSON.parse(resp.getContentText()) as unknown as T;
}

interface SlackUserProfile {
  display_name: string;
  real_name: string;
  title: string;
  image_512: string;
  image_192: string;
  image_72: string;
}

interface SlackUserProfileResponse {
  profile: SlackUserProfile;
}

function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile("dist/index.html").setTitle(
    "Slack Profile Card Generator"
  );
}

export function getAppManifest(): string {
  const slackService = buildSlackOAuthService();
  const manifest = {
    display_information: {
      name: "Slack Profile Card Generator",
    },
    oauth_config: {
      redirect_urls: [slackService.getRedirectUri()],
      scopes: {
        user: ["users.profile:read"],
      },
    },
    settings: {
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };

  return JSON.stringify(manifest, null, 2);
}

export function createSlide() {
  const me = getMe();
  if (me.isAuthorized === false) {
    throw new Error("Not authorized");
  }

  const userProfile = me.profile;

  const originalSlide = DriveApp.getFileById(
    "1jwKNAl-MaMhfRSufmoTT3VX1g5Q-_q-EGkCszQo74Xc"
  );
  const slide = originalSlide.makeCopy();
  const slideId = slide.getId();
  const requests: GoogleAppsScript.Slides.Schema.Request[] = [
    {
      replaceAllText: {
        containsText: { text: "{{name}}" },
        replaceText: userProfile.display_name || userProfile.real_name,
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

  return {
    url: slide.getUrl(),
  };
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

function authCallback(request: object) {
  const slackService = buildSlackOAuthService();
  const isAuthorized = slackService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput(
      `Authorized. <a href="${ScriptApp.getService().getUrl()}">Back to app</a>`
    );
  } else {
    return HtmlService.createHtmlOutput(
      `Failed to aurhorize. <a href="${ScriptApp.getService().getUrl()}">Back to app</a>`
    );
  }
}
