import {
  type UsersProfileGetResponse,
  type TeamProfileGetResponse,
} from "@slack/web-api";

const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, TEMPLATE_SLIDE_ID } =
  PropertiesService.getScriptProperties().getProperties();

type GetMeResponse =
  | { error: string }
  | {
      templateSlideURL: string;
      me:
        | {
            isAuthorized: false;
            authorizationURL: string;
          }
        | {
            isAuthorized: true;
            profile: NonNullable<UsersProfileGetResponse["profile"]>;
          };
    };

export function getMe(): GetMeResponse {
  if (!TEMPLATE_SLIDE_ID) {
    return { error: "Configuration error: TEMPLATE_SLIDE_ID is not set" };
  }

  const templateSlideURL = `https://docs.google.com/presentation/d/${TEMPLATE_SLIDE_ID}/edit`;
  const slackService = buildSlackOAuthService();
  if (slackService.hasAccess() === false) {
    return {
      templateSlideURL,
      me: {
        isAuthorized: false,
        authorizationURL: slackService.getAuthorizationUrl(),
      },
    };
  }

  const userProfile = requestSlackAPI<UsersProfileGetResponse>(
    slackService,
    "users.profile.get"
  );
  return {
    templateSlideURL,
    me: {
      isAuthorized: true,
      profile: userProfile.profile!,
    },
  };
}

export function logout() {
  const slackService = buildSlackOAuthService();
  slackService.reset();
}

function requestSlackAPI<T>(
  slackService: GoogleAppsScriptOAuth2.OAuth2Service,
  method: string,
  params?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
): T {
  const resp = UrlFetchApp.fetch(`https://slack.com/api/${method}`, {
    headers: {
      Authorization: `Bearer ${slackService.getAccessToken()}`,
    },
  });
  return JSON.parse(resp.getContentText()) as unknown as T;
}

export function doGet(): GoogleAppsScript.HTML.HtmlOutput {
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

export function createCard() {
  const slackService = buildSlackOAuthService();
  if (slackService.hasAccess() === false) {
    throw new Error("Not authorized");
  }

  const usersProfile = requestSlackAPI<UsersProfileGetResponse>(
    slackService,
    "users.profile.get"
  );
  if (!usersProfile.ok || !usersProfile.profile) {
    throw new Error(`users.profile.get: ${usersProfile.error}`);
  }

  const teamProfile = requestSlackAPI<TeamProfileGetResponse>(
    buildSlackOAuthService(),
    "team.profile.get"
  );
  if (!teamProfile.ok) {
    throw new Error(`team.profile.get: ${teamProfile.error}`);
  }

  const profile = usersProfile.profile;

  Logger.log("usersProfile", profile);
  Logger.log("teamProfile", teamProfile.profile);

  const originalSlide = DriveApp.getFileById(TEMPLATE_SLIDE_ID);
  const slide = originalSlide.makeCopy();
  const slideId = slide.getId();
  const requests: GoogleAppsScript.Slides.Schema.Request[] = [
    {
      replaceAllText: {
        containsText: { text: "{{name}}" },
        replaceText: profile.display_name || profile.real_name,
      },
    },
    {
      replaceAllText: {
        containsText: { text: "{{title}}" },
        replaceText: profile.title,
      },
    },
    // TODO: make failable
    {
      replaceAllShapesWithImage: {
        containsText: { text: "{{image}}" },
        imageUrl: profile.image_512 || profile.image_192,
      },
    },
  ];

  teamProfile.profile?.fields?.forEach((field) => {
    requests.push({
      replaceAllText: {
        containsText: { text: "{{" + field.label + "}}" },
        replaceText: profile.fields?.[field.id!]?.value ?? "",
      },
    });
  });

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
      `Authorized. <script>window.top.opener.__authorizedCallback()</script><a href="javascript:window.top.close()">Close</a>`
    );
  } else {
    return HtmlService.createHtmlOutput(
      `Failed to aurhorize. <a href="javascript:window.top.close()">Close</a>`
    );
  }
}
