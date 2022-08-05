import React, { useState } from "react";
import {
  Container,
  Navbar,
  Button,
  Nav,
  Modal,
  Spinner,
  Stack,
  Alert,
  ButtonProps,
} from "react-bootstrap";
import useSWRImmutable from "swr/immutable";
import { GASClient } from "gas-client";
import type * as server from "../server";

const { serverFunctions: remote } = new GASClient<typeof server>();

declare var window: Window &
  typeof globalThis & {
    __authorizedCallback: () => void;
  };

const LoadingButton = (
  props: ButtonProps & { dispatch: () => Promise<void> }
) => {
  const [loading, setLoading] = useState<boolean>(false);
  return (
    <Button
      {...props}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await props.dispatch();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <Spinner as="span" size="sm" animation="border" className="me-2" />
      ) : null}
      {props.children}
    </Button>
  );
};

const App = () => {
  const getMe = useSWRImmutable("me", remote.getMe);

  const [errorMessage, setErrorMessage] = useState<string>();
  const [slideURL, setSlideURL] = useState<string>();
  const [manifest, setManifest] = useState<string>();
  const [manifestModalShown, setManifestModalShown] = useState<boolean>(false);

  const showManifest = async () => {
    setManifestModalShown(true);
    setManifest(await remote.getAppManifest());
  };

  if (getMe.error) {
    setErrorMessage(`getMe: ${getMe.error}`);
  }

  const AppMain = () => {
    if (!getMe.data) {
      return (
        <div>
          <Spinner animation="border" />
        </div>
      );
    }

    if ("error" in getMe.data) {
      return (
        <div>
          <Alert variant="danger">{getMe.data.error}</Alert>
        </div>
      );
    }

    if (!getMe.data.me.isAuthorized) {
      const authorizationURL = getMe.data.me.authorizationURL;
      return (
        <div>
          <a
            href={authorizationURL}
            target="_blank"
            onClick={(ev) => {
              ev.preventDefault();
              window.__authorizedCallback = () => {
                getMe.mutate();
              };
              window.open(authorizationURL, "_blank");
            }}
          >
            <img
              src="https://platform.slack-edge.com/img/sign_in_with_slack.png"
              srcSet="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack@2x.png 2x"
            />
          </a>
        </div>
      );
    }

    return (
      <>
        <div>
          Authorized as{" "}
          <strong>
            @
            {getMe.data.me.profile.display_name ||
              getMe.data.me.profile.real_name}
          </strong>{" "}
          <LoadingButton
            variant="secondary"
            size="sm"
            dispatch={async () => {
              await remote.logout();
              getMe.mutate();
            }}
          >
            Logout
          </LoadingButton>
        </div>
        {slideURL ? (
          <>
            <div>
              <h2>Created your card!</h2>
              <p>
                <a href={slideURL} target="_blank">
                  Open Slide
                </a>
              </p>
              <p>
                <a href={slideURL} target="_blank">
                  <img
                    style={{ maxWidth: 640, border: "1px solid #DDD" }}
                    src={slideURL.replace(/\/edit.*$/, "/export/svg")}
                  />
                </a>
              </p>
            </div>
          </>
        ) : (
          <div>
            <LoadingButton
              variant="primary"
              dispatch={async () => {
                try {
                  const { url } = await remote.createCard();
                  setSlideURL(url);
                } catch (err) {
                  setErrorMessage(`createCard: ${err}`);
                }
              }}
            >
              Create Card
            </LoadingButton>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <Navbar bg="dark" variant="dark">
        <Container fluid>
          <Navbar.Brand>Slack Profile Card Generator</Navbar.Brand>
          <Nav>
            {getMe.data && "templateSlideURL" in getMe.data ? (
              <Nav.Link target="_blank" href={getMe.data.templateSlideURL}>
                View template
              </Nav.Link>
            ) : null}
            <Nav.Item>
              <Button
                variant="link"
                onClick={showManifest}
                className="nav-link"
              >
                🔧 Slack app manifest
              </Button>
            </Nav.Item>
          </Nav>
        </Container>
      </Navbar>
      <Container fluid>
        <Stack gap={2} className="p-3">
          {errorMessage ? (
            <div>
              <Alert variant="danger">{errorMessage}</Alert>
            </div>
          ) : null}

          <AppMain></AppMain>
        </Stack>
      </Container>
      <Modal
        show={manifestModalShown}
        onHide={() => setManifestModalShown(false)}
      >
        <Modal.Header closeButton>Slack App Manifest</Modal.Header>
        <Modal.Body>
          {manifest ? (
            <pre>{manifest}</pre>
          ) : (
            <Spinner animation="border" variant="secondary"></Spinner>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default App;
