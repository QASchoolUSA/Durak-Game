import { useEffect } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthGateProvider } from "./auth/AuthGateProvider";
import { convex, convexEnabled } from "./convexClient";
import { EconomyBar } from "./components/EconomyBar";
import { useGameStore } from "./store/gameStore";
import { useOnlineGame } from "./hooks/useOnlineGame";
import { Welcome } from "./components/Welcome";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { Table } from "./components/Table";
import { Result } from "./components/Result";
import { getAppearance } from "./theme/appearanceThemes";
import { getUiTheme } from "./theme/uiThemes";
import { prewarmSounds, unlockAudio } from "./feedback/feedback";

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

  // Browsers gate audio behind a user gesture — unlock + prewarm on first input.
  useEffect(() => {
    const onFirstGesture = () => {
      void unlockAudio();
      prewarmSounds();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture);
    window.addEventListener("keydown", onFirstGesture);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

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
  const creditBalance = useGameStore((s) => s.creditBalance);
  const goldBalance = useGameStore((s) => s.goldBalance);
  const onboarded = useGameStore((s) => s.onboarded);
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

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
        
        <div className="header-right">
          {playMode === "online" && onlineRoomId && (
            <div className="header-room-label">
              {`Room: ${onlineRoomId.slice(0, 8)}…`}
            </div>
          )}
          {convexEnabled && onboarded && (
            <EconomyBar
              credits={creditBalance}
              gold={goldBalance}
              showSignOut={isAuthenticated}
              onSignOut={() => void signOut()}
            />
          )}
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
      <AuthGateProvider>
        <AppContent />
      </AuthGateProvider>
    </ConvexAuthProvider>
  );
}
