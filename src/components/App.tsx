import React, { useState } from "react";
import useSWRImmutable from "swr/immutable";
import { GASClient } from "gas-client";
import type * as server from "../server";

const { serverFunctions: remote } = new GASClient<typeof server>();

const App = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const { data: me, error, mutate } = useSWRImmutable("me", remote.getMe);
  const [manifest, setManifest] = useState<string | null>(null);
  const [slideURL, setSlideURL] = useState<string | null>(null);

  console.log(me);

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-light">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            Slack Profile Card Generator
          </span>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              setManifest(await remote.getAppManifest());
            }}
          >
            Slack app manifest
          </button>
        </div>
      </nav>
      <div className="container-fluid p-3">
        {error ? (
          <div className="alert alert-danger">{error}</div>
        ) : me ? (
          me.isAuthorized ? (
            <>
              <p>
                Authorized as{" "}
                <strong>
                  @{me.profile.display_name || me.profile.real_name}
                </strong>{" "}
                <button
                  className="btn btn-secondary btn-sm ms-2"
                  onClick={async () => {
                    await remote.logout();
                    mutate();
                  }}
                >
                  Logout
                </button>
              </p>
              <p>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    setSlideURL((await remote.createSlide()).url);
                  }}
                >
                  Create Card
                </button>
              </p>
            </>
          ) : (
            <a href={me.authorizationURL} target="_top">
              <img
                src="https://platform.slack-edge.com/img/sign_in_with_slack.png"
                srcSet="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack@2x.png 2x"
              />
            </a>
          )
        ) : (
          <p>Loading...</p>
        )}
      </div>
      {slideURL && (
        <>
          <hr />
          <div className="container-fluid p-3">
            <h2>Created your card!</h2>
            <p>
              <a href={slideURL} target="_blank">
                View Slide
              </a>
            </p>
            <p>
              <img
                style={{ maxWidth: 640, border: "1px solid #DDD" }}
                src={slideURL.replace(/\/edit.*$/, "/export/svg")}
              />
            </p>
          </div>
        </>
      )}
      {manifest && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Slack App Manifest</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => {
                      setManifest(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <pre>{manifest}</pre>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </>
  );
};

export default App;
