import { useEffect } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { convex, convexEnabled } from "./convexClient";
import { useGameStore } from "./store/gameStore";
import { useOnlineGame } from "./hooks/useOnlineGame";
import { Welcome } from "./components/Welcome";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { Table } from "./components/Table";
import { Result } from "./components/Result";
import { getAppearance } from "./theme/appearanceThemes";
import { getUiTheme } from "./theme/uiThemes";

function OnlineGameSync() {
  useOnlineGame();
  return null;
}

function GameRouter() {
  const screen = useGameStore((s) => s.screen);
  const onboarded = useGameStore((s) => s.onboarded);
  const initializeStore = useGameStore((s) => s.initializeStore);

  // Initialize store from localStorage on mount
  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  // Route to auth landing if not onboarded and Convex is enabled
  const showWelcome = convexEnabled && !onboarded;

  if (showWelcome) {
    return <Welcome />;
  }

  switch (screen) {
    case "lobby":
      return <Lobby />;
    case "game":
      return <Table />;
    case "result":
      return <Result />;
    case "home":
    default:
      return <Home />;
  }
}

function AppContent() {
  const playMode = useGameStore((s) => s.playMode);
  const onlineRoomId = useGameStore((s) => s.onlineRoomId);
  const cardDesign = useGameStore((s) => s.cardDesign);
  const { isAuthenticated } = useConvexAuth();

  const preset = getAppearance(cardDesign);
  const uiTheme = getUiTheme(cardDesign);

  const style = {
    background: preset.table.backgroundGradient
      ? `radial-gradient(ellipse at center, ${preset.table.backgroundGradient[0]} 0%, ${preset.table.backgroundGradient[1]} 100%)`
      : preset.table.backgroundColor,
    "--panel": uiTheme.panelBg,
    "--panel-border": uiTheme.panelBorder,
    "--panel-border-inner": uiTheme.panelBorderSoft,
    "--gold": uiTheme.accent,
    "--gold-bright": uiTheme.accent,
    "--suit-red": preset.card.suitRed,
    "--suit-black": preset.card.suitBlack,
    "--text-muted": uiTheme.textMuted,
    "--text-faint": uiTheme.textFaint,
    "--text-light": uiTheme.textPrimary,
  } as React.CSSProperties;

  return (
    <div className="table-background" style={style}>
      <div className="table-vignette" />
      
      {/* Header bar */}
      <header className="game-header">
        <div className="header-logo">
          ♠️ ♥️ DURAK ♣️ ♦️
        </div>
        
        <div style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "500" }}>
          {playMode === "online" && onlineRoomId
            ? `Multiplayer Room: ${onlineRoomId.slice(0, 8)}...`
            : "Offline vs Bots Mode"}
        </div>
      </header>

      {/* Online sync triggers */}
      {convexEnabled && isAuthenticated && <OnlineGameSync />}

      <GameRouter />
    </div>
  );
}

export default function App() {
  // Bypasses Convex Auth Provider if Convex client failed to initialize or is disabled
  if (!convex) {
    return <AppContent />;
  }

  return (
    <ConvexAuthProvider client={convex}>
      <AppContent />
    </ConvexAuthProvider>
  );
}
