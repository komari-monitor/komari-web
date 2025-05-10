import { Callout, Text, Box } from "@radix-ui/themes";
import ThemeSwitch from "./components/ThemeSwitch";
import Node from "./components/Node";
import type { NodeBasicInfo, NodeResponse } from "./types/NodeBasicInfo";
import Footer from "./components/Footer";
import ColorSwitch from "./components/ColorSwitch";
import React from "react";
import type { LiveDataResponse } from "./types/LiveData";
import LanguageSwitch from "./components/Language";
import Login from "./components/Login";

const Index = () => {
  const [showCallout, setShowCallout] = React.useState(false);

  const ishttps = window.location.protocol === "https:";
  //#region 节点数据
  const [node, setNode] = React.useState<NodeResponse | null>(null);

  React.useEffect(() => {
    fetch("./api/nodes")
      .then((res) => res.json())
      .then((data) => setNode(data))
      .catch((err) => console.error(err));
  }, []);
  //#endregion

  //#region WS
  const [live_data, setLiveData] = React.useState<LiveDataResponse | null>(
    null
  );
  // WebSocket connection effect
  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let interval: number;
    let reconnectTimeout: number;

    const connect = () => {
      ws = new WebSocket("./api/clients");
      ws.onopen = () => {
        // 连接成功时，隐藏 Callout
        setShowCallout(true);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
        } catch (e) {}
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        // 断开连接时，显示 Callout
        setShowCallout(false);
        reconnectTimeout = window.setTimeout(connect, 2000);
      };
    };

    connect();

    interval = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("get");
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);
  //#endregion

  return (
    <>
      <div
        style={{ backgroundColor: "var(--accent-1)" }}
        className="flex justify-center min-w-dvw min-h-dvh"
      >
        <div className="flex flex-col md:w-3/5 w-full min-h-full">
          <nav className="flex items-center gap-3 max-h-16 justify-end min-w-full p-2">
            <div className="mr-auto flex">
              <label className="text-3xl font-bold ">Komari</label>
              <div className="flex flex-row items-end">
                <div
                  style={{ color: "var(--accent-3)" }}
                  className="border-solid border-r-2 mr-1 mb-1 w-2 h-2/3"
                />
                <label
                  className="text-base font-bold"
                  style={{ color: "var(--accent-4)" }}
                >
                  Komari Monitor
                </label>
              </div>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="55%"
              viewBox="0 0 24 24"
              color="var(--accent-7)"
            >
              <path
                fill="currentColor"
                d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
              ></path>
            </svg>
            <ThemeSwitch
              icon={
                <svg
                  height="42%"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  color="var(--accent-7)"
                >
                  <path
                    d="M7.5 0C7.77614 0 8 0.223858 8 0.5V2.5C8 2.77614 7.77614 3 7.5 3C7.22386 3 7 2.77614 7 2.5V0.5C7 0.223858 7.22386 0 7.5 0ZM2.1967 2.1967C2.39196 2.00144 2.70854 2.00144 2.90381 2.1967L4.31802 3.61091C4.51328 3.80617 4.51328 4.12276 4.31802 4.31802C4.12276 4.51328 3.80617 4.51328 3.61091 4.31802L2.1967 2.90381C2.00144 2.70854 2.00144 2.39196 2.1967 2.1967ZM0.5 7C0.223858 7 0 7.22386 0 7.5C0 7.77614 0.223858 8 0.5 8H2.5C2.77614 8 3 7.77614 3 7.5C3 7.22386 2.77614 7 2.5 7H0.5ZM2.1967 12.8033C2.00144 12.608 2.00144 12.2915 2.1967 12.0962L3.61091 10.682C3.80617 10.4867 4.12276 10.4867 4.31802 10.682C4.51328 10.8772 4.51328 11.1938 4.31802 11.3891L2.90381 12.8033C2.70854 12.9986 2.39196 12.9986 2.1967 12.8033ZM12.5 7C12.2239 7 12 7.22386 12 7.5C12 7.77614 12.2239 8 12.5 8H14.5C14.7761 8 15 7.77614 15 7.5C15 7.22386 14.7761 7 14.5 7H12.5ZM10.682 4.31802C10.4867 4.12276 10.4867 3.80617 10.682 3.61091L12.0962 2.1967C12.2915 2.00144 12.608 2.00144 12.8033 2.1967C12.9986 2.39196 12.9986 2.70854 12.8033 2.90381L11.3891 4.31802C11.1938 4.51328 10.8772 4.51328 10.682 4.31802ZM8 12.5C8 12.2239 7.77614 12 7.5 12C7.22386 12 7 12.2239 7 12.5V14.5C7 14.7761 7.22386 15 7.5 15C7.77614 15 8 14.7761 8 14.5V12.5ZM10.682 10.682C10.8772 10.4867 11.1938 10.4867 11.3891 10.682L12.8033 12.0962C12.9986 12.2915 12.9986 12.608 12.8033 12.8033C12.608 12.9986 12.2915 12.9986 12.0962 12.8033L10.682 11.3891C10.4867 11.1938 10.4867 10.8772 10.682 10.682ZM5.5 7.5C5.5 6.39543 6.39543 5.5 7.5 5.5C8.60457 5.5 9.5 6.39543 9.5 7.5C9.5 8.60457 8.60457 9.5 7.5 9.5C6.39543 9.5 5.5 8.60457 5.5 7.5ZM7.5 4.5C5.84315 4.5 4.5 5.84315 4.5 7.5C4.5 9.15685 5.84315 10.5 7.5 10.5C9.15685 10.5 10.5 9.15685 10.5 7.5C10.5 5.84315 9.15685 4.5 7.5 4.5Z"
                    fill="currentColor"
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                  ></path>
                </svg>
              }
            />
            <ColorSwitch
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="48%"
                  viewBox="0 0 24 24"
                  color="var(--accent-7)"
                >
                  <path
                    fill="currentColor"
                    d="M3.839 5.858c2.94-3.916 9.03-5.055 13.364-2.36c4.28 2.66 5.854 7.777 4.1 12.577c-1.655 4.533-6.016 6.328-9.159 4.048c-1.177-.854-1.634-1.925-1.854-3.664l-.106-.987l-.045-.398c-.123-.934-.311-1.352-.705-1.572c-.535-.298-.892-.305-1.595-.033l-.351.146l-.179.078c-1.014.44-1.688.595-2.541.416l-.2-.047l-.164-.047c-2.789-.864-3.202-4.647-.565-8.157m12.928 4.722a1.25 1.25 0 1 0 2.415-.647a1.25 1.25 0 0 0-2.415.647m.495 3.488a1.25 1.25 0 1 0 2.414-.647a1.25 1.25 0 0 0-2.414.647m-2.474-6.491a1.25 1.25 0 1 0 2.415-.647a1.25 1.25 0 0 0-2.415.647m-.028 8.998a1.25 1.25 0 1 0 2.415-.647a1.25 1.25 0 0 0-2.415.647m-3.497-9.97a1.25 1.25 0 1 0 2.415-.646a1.25 1.25 0 0 0-2.415.646"
                  />
                </svg>
              }
            />
            <LanguageSwitch
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="48%"
                  viewBox="0 0 24 24"
                  color="var(--accent-7)"
                >
                  <g fill="none">
                    <path
                      d="M17.25 1a.75.75 0 0 1 .75.75V3h4.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V4.5h-9.5v.75a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 11.5 3h5V1.75a.75.75 0 0 1 .75-.75zm-3.5 5a.75.75 0 0 0 0 1.5h4.428L16.77 8.674a.75.75 0 0 0-.27.576v.25h-4.75a.75.75 0 0 0 0 1.5h4.75v2.734a.75.75 0 0 1-.966.718l-.569-.17a.75.75 0 0 0-.43 1.436l.569.171A2.25 2.25 0 0 0 18 13.734V11h4.25a.75.75 0 0 0 0-1.5h-4.128l2.608-2.174A.75.75 0 0 0 20.25 6h-6.5zm-5.361.477l-.049-.104a.73.73 0 0 0-1.315.087l-5.964 14.5l-.032.096a.754.754 0 0 0 .426.886a.73.73 0 0 0 .963-.402l1.547-3.76l.094.006h7.087l1.433 3.737l.042.092a.73.73 0 0 0 .91.334a.755.755 0 0 0 .418-.972l-5.56-14.5zm-3.74 9.809L7.81 8.747l2.947 7.539h-6.11z"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              }
            />
            <Login />
          </nav>
          <main className="m-1">
            <Callout.Root m="2" hidden={ishttps} color="red">
              <Callout.Icon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M10.03 3.659c.856-1.548 3.081-1.548 3.937 0l7.746 14.001c.83 1.5-.255 3.34-1.969 3.34H4.254c-1.715 0-2.8-1.84-1.97-3.34zM12.997 17A.999.999 0 1 0 11 17a.999.999 0 0 0 1.997 0m-.259-7.853a.75.75 0 0 0-1.493.103l.004 4.501l.007.102a.75.75 0 0 0 1.493-.103l-.004-4.502z"
                  />
                </svg>
              </Callout.Icon>
              <Callout.Text>
                <Text size="2" weight="medium">
                  The current connection is not HTTPS! Your sensitive data is at
                  serious risk. Take immediate action to secure the connection!
                </Text>
              </Callout.Text>
            </Callout.Root>

            <Callout.Root
              m="2"
              hidden={showCallout}
              id="callout"
              color="tomato"
            >
              <Callout.Icon>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M21.707 3.707a1 1 0 0 0-1.414-1.414L18.496 4.09a4.25 4.25 0 0 0-5.251.604l-1.068 1.069a1.75 1.75 0 0 0 0 2.474l3.585 3.586a1.75 1.75 0 0 0 2.475 0l1.068-1.068a4.25 4.25 0 0 0 .605-5.25zm-11 8a1 1 0 0 0-1.414-1.414l-1.47 1.47l-.293-.293a.75.75 0 0 0-1.06 0l-1.775 1.775a4.25 4.25 0 0 0-.605 5.25l-1.797 1.798a1 1 0 1 0 1.414 1.414l1.798-1.797a4.25 4.25 0 0 0 5.25-.605l1.775-1.775a.75.75 0 0 0 0-1.06l-.293-.293l1.47-1.47a1 1 0 0 0-1.414-1.414l-1.47 1.47l-1.586-1.586z"
                  />
                </svg>
              </Callout.Icon>
              <Callout.Text>
                <Text size="2" weight="medium">
                  Websocket is not connected
                </Text>
              </Callout.Text>
            </Callout.Root>

            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "1.5rem",
                padding: "1rem",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {node &&
                node.data &&
                node.data.map((n: NodeBasicInfo) => (
                  <Node
                    key={n.uuid}
                    basic={n}
                    live={live_data?.data.data[n.uuid]}
                    online={!!live_data?.data.online?.includes(n.uuid)}
                  />
                ))}
            </Box>
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
};

export default Index;
