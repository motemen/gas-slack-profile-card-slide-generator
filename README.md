Slack Profile Card Generator
============================

Deployment
----------

First, follow the instruction at [@google/clasp](https://www.npmjs.com/package/@google/clasp) to set it up.

Then use `yarn setup` to create a Google Apps Script project. Use script editor or clasp to deploy it as a webapp.

Configuration
-------------

Click `🔧Slack App Manifest` to obtain a manifest to create a new Slack app at https://api.slack.com/apps.

|Name|Description|
|--|--|
|`SLACK_CLIENT_ID`|Slack app client ID|
|`SLACK_CLIENT_SECRET`|Slack app client secret|
|`TEMPLATE_SLIDE_ID`|A Google Slide ID (`https://docs.google.com/presentation/d/<here>/edit`）|

Creating Template Slide
-----------------------

Consult the [example template](https://docs.google.com/presentation/d/1jwKNAl-MaMhfRSufmoTT3VX1g5Q-_q-EGkCszQo74Xc/edit#slide=id.p).

Available template variables can be viewed at `🔧Template Variables`.
