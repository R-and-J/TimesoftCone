import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import IndexPage from "@/pages/Index";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import AuctionListGridPage from "@/pages/AuctionListGrid";
import AuctionListRowPage from "@/pages/AuctionListRow";
import AuctionListTimelinePage from "@/pages/AuctionListTimeline";
import AuctionDetailPage from "@/pages/AuctionDetail";
import BidInteractionsPage from "@/pages/BidInteractions";
import MyActivityPage from "@/pages/MyActivity";
import DividendPage from "@/pages/Dividend";
import RedemptionPage from "@/pages/Redemption";
import AdminOpsPage from "@/pages/AdminOps";
import AdminLedgerPage from "@/pages/AdminLedger";
import AdminMembersPage from "@/pages/AdminMembers";
import AdminRedemptionPage from "@/pages/AdminRedemption";
import AdminAuctionsPage from "@/pages/AdminAuctions";
import { useAuth } from "@/lib/current-user";
import { isAdmin } from "@/lib/roles";

// 로그인 안 된 상태로 보호된 페이지 접근 시 /login으로. 보호된 페이지는
// 이 가드 안에서만 렌더되므로 useCurrentUser()가 항상 사용자 보장.
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// 관리 영역(/admin/*) — 관리자 계열(ADMIN/EZPASS_ADMIN/EXAM_ADMIN)만. 일반은 대시보드로.
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Entry — real app flow always starts at login. */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/auction" element={<RequireAuth><AuctionListGridPage /></RequireAuth>} />
        <Route path="/auction/row" element={<RequireAuth><AuctionListRowPage /></RequireAuth>} />
        <Route path="/auction/timeline" element={<RequireAuth><AuctionListTimelinePage /></RequireAuth>} />
        <Route path="/auction/detail" element={<RequireAuth><AuctionDetailPage /></RequireAuth>} />
        <Route path="/auction/detail/:id" element={<RequireAuth><AuctionDetailPage /></RequireAuth>} />
        <Route path="/auction/bid-variants" element={<RequireAuth><BidInteractionsPage /></RequireAuth>} />
        <Route path="/activity" element={<RequireAuth><MyActivityPage /></RequireAuth>} />
        <Route path="/dividend" element={<RequireAuth><DividendPage /></RequireAuth>} />
        <Route path="/redemption" element={<RequireAuth><RedemptionPage /></RequireAuth>} />
        <Route path="/admin/ops" element={<RequireAdmin><AdminOpsPage /></RequireAdmin>} />
        <Route path="/admin/ledger" element={<RequireAdmin><AdminLedgerPage /></RequireAdmin>} />
        <Route path="/admin/members" element={<RequireAdmin><AdminMembersPage /></RequireAdmin>} />
        <Route path="/admin/redemption" element={<RequireAdmin><AdminRedemptionPage /></RequireAdmin>} />
        <Route path="/admin/auctions" element={<RequireAdmin><AdminAuctionsPage /></RequireAdmin>} />

        {/* Developer escape hatch — full 12-screen catalog. */}
        <Route path="/_screens" element={<IndexPage />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
